import re

import pandas as pd

_NUM_TOKEN_RE = re.compile(r"^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$")
_LEADING_JUNK_RE = re.compile(r"^[\s#\$%&@!;:,._-]+")


def _strip_leading_junk(text: str) -> str:
    return _LEADING_JUNK_RE.sub("", text or "")


def _infer_delimiter(lines: list[str]) -> str | None:
    for delim in [",", "\t", ";", "|"]:
        if any(delim in line for line in lines):
            return delim
    return None


def _split_line(line: str, delim: str | None) -> list[str]:
    cleaned = _strip_leading_junk(line)
    if delim:
        return [cell.strip() for cell in cleaned.strip().split(delim) if cell.strip()]
    return [cell for cell in re.split(r"\s+", cleaned.strip()) if cell != ""]


def _line_has_string_tokens(line: str, delim: str | None) -> bool:
    tokens = _split_line(line, delim)
    if not tokens:
        return False
    return any(token and not _NUM_TOKEN_RE.match(token) for token in tokens)


def _update_numeric_stats(stats: dict, frame: pd.DataFrame):
    for column in frame.columns:
        series = pd.to_numeric(frame[column], errors="coerce")
        if series.notna().any():
            min_value = float(series.min())
            max_value = float(series.max())
            if column not in stats:
                stats[column] = {"min": min_value, "max": max_value}
            else:
                stats[column]["min"] = min(stats[column]["min"], min_value)
                stats[column]["max"] = max(stats[column]["max"], max_value)


def text_range_to_parquet(
    txt_path: str,
    parquet_path: str,
    parse_range: dict | None,
):
    start_requested = int((parse_range or {}).get("start_line", 1) or 1)
    end_requested = (parse_range or {}).get("end_line")
    end_requested = int(end_requested) if end_requested is not None else None

    if start_requested < 1:
        start_requested = 1
    if end_requested is not None and end_requested < start_requested:
        end_requested = start_requested

    total_lines = 0
    selected_lines: list[str] = []
    last_line = ""

    with open(txt_path, "r", errors="ignore") as handle:
        for raw_line in handle:
            total_lines += 1
            line = raw_line.rstrip("\r\n")
            last_line = line

            if total_lines < start_requested:
                continue
            if end_requested is not None and total_lines > end_requested:
                break
            if line.strip():
                selected_lines.append(line)

    if total_lines == 0:
        raise ValueError("Selected file is empty")

    if start_requested > total_lines:
        selected_lines = [last_line] if last_line.strip() else []

    if not selected_lines:
        raise ValueError("Selected range is empty")

    delim = _infer_delimiter(selected_lines)
    header_is_present = _line_has_string_tokens(selected_lines[0], delim)
    data_lines = selected_lines[1:] if header_is_present else selected_lines

    rows: list[list[str | None]] = []
    max_cols = 0
    for line in data_lines:
        if not line.strip():
            continue
        cells = _split_line(line, delim)
        if not cells:
            continue
        rows.append(cells)
        max_cols = max(max_cols, len(cells))

    if not rows or max_cols == 0:
        raise ValueError("No data rows parsed from selected range")

    if header_is_present:
        raw_headers = _split_line(selected_lines[0], delim)
        headers = []
        for header in raw_headers:
            cleaned = _strip_leading_junk(header).strip()
            if cleaned:
                headers.append(cleaned)
        if len(headers) < max_cols:
            headers += [f"column_{idx + 1}" for idx in range(len(headers), max_cols)]
        headers = headers[:max_cols]
    else:
        headers = [f"column_{idx + 1}" for idx in range(max_cols)]

    normalized_rows = []
    for row in rows:
        if len(row) < max_cols:
            row = row + [None] * (max_cols - len(row))
        elif len(row) > max_cols:
            row = row[:max_cols]
        normalized_rows.append(row)

    frame = pd.DataFrame(normalized_rows, columns=headers)
    stats: dict = {}
    _update_numeric_stats(stats, frame)
    sample_rows = frame.head(10).to_dict(orient="records")
    row_count = len(frame)

    frame.to_parquet(parquet_path, index=False)
    return list(frame.columns), row_count, sample_rows, stats
