use arrow_pyarrow::ToPyArrow;
use calamine::{open_workbook, Reader, Xlsx};
use csv::{ByteRecord, ReaderBuilder};
use matfile::MatFile;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::ProjectionMask;
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList, PyModule};
use pyo3::Py;
use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Serialize)]
struct Summary {
    columns: Vec<String>,
    sample_rows: Vec<HashMap<String, String>>,
    rows_seen: usize,
    metadata: Option<serde_json::Value>,
}

fn clamp_headers(header_mode: &str, provided: Option<Vec<String>>, count: usize) -> Vec<String> {
    match header_mode {
        "none" => (0..count).map(|i| format!("column_{}", i + 1)).collect(),
        "custom" => provided.unwrap_or_else(|| (0..count).map(|i| format!("column_{}", i + 1)).collect()),
        _ => Vec::new(),
    }
}

fn summarize_csv(
    path: &Path,
    delimiter: u8,
    header_mode: &str,
    custom_headers: Option<Vec<String>>,
) -> PyResult<Summary> {
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(header_mode != "none")
        .flexible(true)
        .from_path(path)
        .map_err(|err| PyValueError::new_err(format!("CSV open error: {err}")))?;

    let mut columns: Vec<String> = vec![];
    let mut sample_rows: Vec<HashMap<String, String>> = vec![];
    let mut rows_seen: usize = 0;

    if header_mode == "file" {
        columns = reader
            .headers()
            .map_err(|err| PyValueError::new_err(format!("Header read error: {err}")))?
            .iter()
            .map(|s| s.to_string())
            .collect();
    }

    let mut record = ByteRecord::new();
    while reader.read_byte_record(&mut record).unwrap_or(false) {
        if columns.is_empty() {
            let detected = record.len();
            columns = clamp_headers(header_mode, custom_headers.clone(), detected);
        }
        let mut row_map = HashMap::new();
        for (idx, value) in record.iter().enumerate() {
            let key = columns.get(idx).cloned().unwrap_or_else(|| format!("column_{idx}"));
            row_map.insert(key, String::from_utf8_lossy(value).to_string());
        }
        sample_rows.push(row_map);
        rows_seen += 1;
        if sample_rows.len() >= 5 {
            break;
        }
    }

    Ok(Summary {
        columns,
        sample_rows,
        rows_seen,
        metadata: None,
    })
}

fn summarize_excel(path: &Path, header_mode: &str, custom_headers: Option<Vec<String>>) -> PyResult<Summary> {
    let mut workbook: Xlsx<_> = open_workbook(path)
        .map_err(|err| PyValueError::new_err(format!("Excel open error: {err}")))?;
    let range = workbook
        .worksheet_range_at(0)
        .ok_or_else(|| PyValueError::new_err("No worksheet found"))?
        .map_err(|err| PyValueError::new_err(format!("Worksheet error: {err}")))?;

    let mut iter = range.rows();
    let mut columns: Vec<String> = vec![];
    let mut sample_rows: Vec<HashMap<String, String>> = vec![];

    if header_mode == "file" {
        if let Some(header_row) = iter.next() {
            columns = header_row
                .iter()
                .enumerate()
                .map(|(idx, cell)| {
                    let value = cell.to_string();
                    if value.is_empty() {
                        format!("column_{idx}")
                    } else {
                        value
                    }
                })
                .collect();
        }
    }

    let mut rows_seen = 0;
    for row in iter {
        if columns.is_empty() {
            columns = clamp_headers(header_mode, custom_headers.clone(), row.len());
        }
        let mut map = HashMap::new();
        for (idx, cell) in row.iter().enumerate() {
            let key = columns
                .get(idx)
                .cloned()
                .unwrap_or_else(|| format!("column_{idx}"));
            let value = cell.to_string();
            map.insert(key, value);
        }
        sample_rows.push(map);
        rows_seen += 1;
        if sample_rows.len() >= 5 {
            break;
        }
    }

    Ok(Summary {
        columns,
        sample_rows,
        rows_seen,
        metadata: None,
    })
}

fn summarize_mat(path: &Path) -> PyResult<Summary> {
    let file = File::open(path).map_err(|err| PyValueError::new_err(format!("MAT open error: {err}")))?;
    let mat = MatFile::parse(BufReader::new(file))
        .map_err(|err| PyValueError::new_err(format!("MAT load error: {err}")))?;
    let mut metadata = serde_json::Map::new();

    for array in mat.arrays() {
        let shape: Vec<usize> = array.size().iter().copied().collect();
        metadata.insert(
            array.name().to_string(),
            json!({"shape": shape, "class": format!("{:?}", array.data())}),
        );
    }

    Ok(Summary {
        columns: vec![],
        sample_rows: vec![],
        rows_seen: 0,
        metadata: Some(serde_json::Value::Object(metadata)),
    })
}

#[derive(Clone, Default)]
struct BinStats {
    count: u64,
    sum: f64,
    min: f64,
    max: f64,
}

fn ingest_bins(
    x: f64,
    y: f64,
    edges: &[f64],
    bins: &mut [BinStats],
) {
    if let Some(pos) = edges.windows(2).position(|w| x >= w[0] && x < w[1]) {
        let bin = &mut bins[pos];
        bin.count += 1;
        bin.sum += y;
        if y < bin.min {
            bin.min = y;
        }
        if y > bin.max {
            bin.max = y;
        }
    }
}

fn linspace(start: f64, end: f64, bins: usize) -> Vec<f64> {
    let step = (end - start) / bins as f64;
    (0..=bins).map(|i| start + step * i as f64).collect()
}

fn compute_lod_from_csv(
    path: &Path,
    delimiter: u8,
    x_idx: usize,
    y_idx: usize,
    bins: &[usize],
) -> PyResult<serde_json::Value> {
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .flexible(true)
        .from_path(path)
        .map_err(|err| PyValueError::new_err(format!("CSV open error: {err}")))?;

    let headers = reader
        .headers()
        .map_err(|err| PyValueError::new_err(format!("Header read error: {err}")))?
        .clone();

    if x_idx >= headers.len() || y_idx >= headers.len() {
        return Err(PyValueError::new_err("Axis index out of range"));
    }

    let mut x_min = f64::INFINITY;
    let mut x_max = f64::NEG_INFINITY;
    let mut rows = 0u64;
    let mut all_rows: Vec<(f64, f64)> = Vec::new();

    let mut record = ByteRecord::new();
    while reader.read_byte_record(&mut record).unwrap_or(false) {
        if let (Some(x_raw), Some(y_raw)) = (record.get(x_idx), record.get(y_idx)) {
            if let (Ok(x_val), Ok(y_val)) = (
                String::from_utf8_lossy(x_raw).parse::<f64>(),
                String::from_utf8_lossy(y_raw).parse::<f64>(),
            ) {
                x_min = x_min.min(x_val);
                x_max = x_max.max(x_val);
                all_rows.push((x_val, y_val));
                rows += 1;
            }
        }
    }

    if !x_min.is_finite() || !x_max.is_finite() {
        return Err(PyValueError::new_err("No numeric data found"));
    }
    if (x_max - x_min).abs() < f64::EPSILON {
        x_max += 1e-9;
    }

    let mut levels = vec![];
    for &bin_count in bins {
        let edges = linspace(x_min, x_max, bin_count);
        let mut stats = vec![BinStats { count: 0, sum: 0.0, min: f64::INFINITY, max: f64::NEG_INFINITY }; bin_count];
        for (x, y) in all_rows.iter().cloned() {
            ingest_bins(x, y, &edges, &mut stats);
        }
        let centers: Vec<f64> = edges.windows(2).map(|w| (w[0] + w[1]) / 2.0).collect();
        let mut level_rows = vec![];
        for (idx, bin) in stats.iter().enumerate() {
            if bin.count == 0 {
                continue;
            }
            level_rows.push(json!({
                "x": centers[idx],
                "count": bin.count,
                "y_mean": bin.sum / bin.count as f64,
                "y_min": bin.min,
                "y_max": bin.max,
            }));
        }
        levels.push(json!({"level": bin_count, "rows": level_rows}));
    }

    Ok(json!({
        "x_min": x_min,
        "x_max": x_max,
        "rows": rows,
        "levels": levels,
        "partitions": 1,
        "headers": headers.into_iter().map(|s| s.to_string()).collect::<Vec<_>>()
    }))
}

#[pyfunction]
fn summarize_file(
    py: Python,
    path: String,
    file_type: String,
    header_mode: Option<String>,
    custom_headers: Option<Vec<String>>,
    delimiter: Option<String>,
) -> PyResult<Py<PyAny>> {
    let path_obj = Path::new(&path);
    let header_mode = header_mode.unwrap_or_else(|| "file".to_string());
    let delimiter_byte = delimiter
        .and_then(|d| d.as_bytes().first().copied())
        .unwrap_or(b',');

    let summary = match file_type.as_str() {
        "csv" | "txt" | "dat" => summarize_csv(path_obj, delimiter_byte, &header_mode, custom_headers)?,
        "excel" => summarize_excel(path_obj, &header_mode, custom_headers)?,
        "mat" => summarize_mat(path_obj)?,
        other => {
            return Err(PyValueError::new_err(format!("Unsupported file type {other}")));
        }
    };

    let py_dict = PyDict::new(py);
    let sample_rows_py = PyList::new(py, summary.sample_rows)?;
    py_dict.set_item("columns", summary.columns)?;
    py_dict.set_item("sample_rows", sample_rows_py)?;
    py_dict.set_item("rows_seen", summary.rows_seen)?;
    if let Some(meta) = summary.metadata {
        let json_mod = PyModule::import(py, "json")?;
        let meta_py = json_mod.call_method1("loads", (meta.to_string(),))?;
        py_dict.set_item("metadata", meta_py)?;
    }
    Ok(py_dict.into_any().unbind())
}

#[pyfunction]
fn lod_bins(
    py: Python,
    path: String,
    file_type: String,
    x_axis: String,
    y_axis: String,
    levels: Vec<usize>,
    delimiter: Option<String>,
) -> PyResult<Py<PyAny>> {
    let delimiter_byte = delimiter
        .and_then(|d| d.as_bytes().first().copied())
        .unwrap_or(b',');
    match file_type.as_str() {
        "csv" | "txt" | "dat" => {
            let lod = compute_lod_from_csv(
                Path::new(&path),
                delimiter_byte,
                x_axis.parse::<usize>().unwrap_or(0),
                y_axis.parse::<usize>().unwrap_or(1),
                &levels,
            )?;
            let json_mod = PyModule::import(py, "json")?;
            let lod_py = json_mod.call_method1("loads", (lod.to_string(),))?;
            Ok(lod_py.unbind())
        }
        other => Err(PyValueError::new_err(format!("LOD not supported for {other}"))),
    }
}

#[pyfunction]
fn parquet_batches(py: Python, path: String, columns: Vec<String>, batch_size: Option<usize>) -> PyResult<Vec<Py<PyAny>>> {
    let file = File::open(&path).map_err(|err| PyValueError::new_err(format!("Parquet open error: {err}")))?;
    let builder = ParquetRecordBatchReaderBuilder::try_new(file)
        .map_err(|err| PyValueError::new_err(format!("Parquet reader error: {err}")))?;

    let schema = builder.parquet_schema().clone();
    let projection = ProjectionMask::columns(&schema, columns.iter().map(|c| c.as_str()));
    let reader = builder
        .with_batch_size(batch_size.unwrap_or(1024 * 32))
        .with_projection(projection)
        .build()
        .map_err(|err| PyValueError::new_err(format!("Parquet build error: {err}")))?;
    let mut batches = vec![];
    for batch in reader {
        let b = batch.map_err(|err| PyValueError::new_err(format!("Parquet batch error: {err}")))?;
        let py_batch = b
            .to_pyarrow(py)
            .map_err(|err| PyValueError::new_err(format!("Arrow conversion error: {err}")))?;
        batches.push(py_batch.unbind());
    }
    Ok(batches)
}

#[pymodule]
fn flightdata_rust(_py: Python, m: &Bound<PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(summarize_file, m)?)?;
    m.add_function(wrap_pyfunction!(lod_bins, m)?)?;
    m.add_function(wrap_pyfunction!(parquet_batches, m)?)?;
    Ok(())
}
