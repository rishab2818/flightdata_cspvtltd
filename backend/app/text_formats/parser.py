import codecs
import re
from collections.abc import Iterable

import pandas as pd

_NUM_TOKEN_RE = re.compile(r"^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$")
_LEADING_JUNK_RE = re.compile(r"^[\s#\$%&@!;:,._-]+")


def _strip_leading_junk(text: str) -> str:
    return _LEADING_JUNK_RE.sub("", text or "")


def _trim_trailing_empty(tokens: list[str]) -> list[str]:
    out = list(tokens)
    while out and out[-1] == "":
        out.pop()
    return out


def _split_line(line: str, delim: str | None) -> list[str]:
    cleaned = _strip_leading_junk(line)
    if not cleaned.strip():
        return []
    if delim:
        return _trim_trailing_empty([cell.strip() for cell in cleaned.strip().split(delim)])
    return [cell for cell in re.split(r"\s+", cleaned.strip()) if cell != ""]


def _token_count(tokens: list[str]) -> int:
    return sum(1 for token in tokens if token != "")


def _infer_delimiter(lines: list[str]) -> str | None:
    best_delim = None
    best_score = (-1, -1, -1)
    for delim in [None, ",", "\t", ";", "|"]:
        counts = [_token_count(_split_line(line, delim)) for line in lines if line.strip()]
        multi_counts = [count for count in counts if count >= 2]
        if not multi_counts:
            score = (0, 0, 0)
        else:
            frequencies: dict[int, int] = {}
            for count in multi_counts:
                frequencies[count] = frequencies.get(count, 0) + 1
            dominant_cols = max(frequencies, key=lambda key: (frequencies[key], key))
            score = (frequencies[dominant_cols], len(multi_counts), dominant_cols)
        if score > best_score:
            best_score = score
            best_delim = delim
    return best_delim


def _find_tabular_start(lines: list[str], delim: str | None) -> int:
    parsed = [_split_line(line, delim) for line in lines]
    counts = [_token_count(tokens) for tokens in parsed]

    first_multi = next((idx for idx, count in enumerate(counts) if count >= 2), 0)

    for idx, count in enumerate(counts):
        if count < 2:
            continue
        tolerance = max(1, int(count * 0.35))
        similar = 0
        for look_ahead in range(idx + 1, min(len(counts), idx + 6)):
            next_count = counts[look_ahead]
            if next_count >= 2 and abs(next_count - count) <= tolerance:
                similar += 1
        if similar >= 1:
            return idx
    return first_multi


def _line_has_string_tokens(line: str, delim: str | None) -> bool:
    tokens = _split_line(line, delim)
    if not tokens:
        return False
    return any(token and not _NUM_TOKEN_RE.match(token) for token in tokens)


def _mostly_numeric(tokens: list[str]) -> bool:
    values = [token for token in tokens if token != ""]
    if not values:
        return False
    numeric = sum(1 for token in values if _NUM_TOKEN_RE.match(token))
    return (numeric / len(values)) >= 0.6

def _looks_like_units_row(tokens: list[str]) -> bool:
    values = [str(token or "").strip() for token in tokens if str(token or "").strip()]
    if not values:
        return False

    allowed_units = {
        "m", "km", "cm", "mm", "s", "ms", "deg", "rad",
        "kg", "g", "pa", "kpa", "mpa", "n", "kn",
        "m/s", "km/h", "ft/s", "rpm", "hz"
    }

    unit_like_count = 0
    for token in values:
        lower = token.lower()
        if re.match(r"^[a-zA-Z%°/_\-0-9.]+$", token) and (
            "/" in lower or lower in allowed_units
        ):
            unit_like_count += 1

    return (unit_like_count / len(values)) >= 0.5


def _sanitize_header_value(value: str, idx: int) -> str:
    text = _strip_leading_junk(str(value or "")).strip()
    if not text:
        return f"column{idx + 1}"
    return text


def _make_unique_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    output: list[str] = []
    for idx, header in enumerate(headers):
        base = _strip_leading_junk(str(header or "")).strip() or f"column{idx + 1}"
        count = seen.get(base, 0) + 1
        seen[base] = count
        output.append(base if count == 1 else f"{base}_{count}")
    return output


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


def _iter_text_lines_from_chunks(chunks: Iterable[bytes], on_chunk=None) -> Iterable[str]:
    decoder = codecs.getincrementaldecoder("utf-8")(errors="ignore")
    carry = ""
    for chunk in chunks:
        if not chunk:
            continue
        if on_chunk:
            on_chunk(len(chunk))
        text = decoder.decode(chunk)
        if not text:
            continue
        combined = carry + text
        segments = combined.split("\n")
        carry = segments.pop() if segments else ""
        for segment in segments:
            yield segment.rstrip("\r")

    tail = carry + decoder.decode(b"", final=True)
    if tail:
        yield tail.rstrip("\r")

def _parse_lines_to_parquet(
    lines: Iterable[str],
    parquet_path: str,
    parse_range: dict | None,
    header_mode: str = "file",
    custom_headers: list[str] | None = None,
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

    for raw_line in lines:
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
    start_idx = _find_tabular_start(selected_lines, delim)
    candidate_lines = selected_lines[start_idx:] if start_idx < len(selected_lines) else selected_lines
    candidate_lines = [line for line in candidate_lines if line.strip()]
    if not candidate_lines:
        raise ValueError("No tabular data found in selected range")

    parsed_rows = [_split_line(line, delim) for line in candidate_lines]
    parsed_rows = [row for row in parsed_rows if _token_count(row) > 0]
    if not parsed_rows:
        raise ValueError("No parsed rows found in selected range")

    first_tokens = parsed_rows[0]
    second_tokens = parsed_rows[1] if len(parsed_rows) > 1 else []
    third_tokens = parsed_rows[2] if len(parsed_rows) > 2 else []

    first_row_has_text = (
        _token_count(first_tokens) >= 2
        and any(token and not _NUM_TOKEN_RE.match(token) for token in first_tokens)
    )

    second_row_is_numeric = _mostly_numeric(second_tokens) if second_tokens else False
    second_row_is_units = _looks_like_units_row(second_tokens) if second_tokens else False
    third_row_is_numeric = _mostly_numeric(third_tokens) if third_tokens else False

    if header_mode == "custom":
        max_cols = max(len(row) for row in parsed_rows)
        if not custom_headers:
            raise ValueError("custom_headers required when header_mode=custom")
        if len(custom_headers) != max_cols:
            raise ValueError("Number of custom headers does not match detected columns")
        headers = [str(h).strip() for h in custom_headers]
        data_rows = parsed_rows

    elif header_mode == "none":
        max_cols = max(len(row) for row in parsed_rows)
        headers = [f"column{idx + 1}" for idx in range(max_cols)]
        data_rows = parsed_rows

    else:
        header_is_present = (
            first_row_has_text and (
                second_row_is_numeric
                or (second_row_is_units and third_row_is_numeric)
                or not second_tokens
            )
        )

        if header_is_present:
            data_rows = parsed_rows[2:] if second_row_is_units else parsed_rows[1:]
            max_cols = max(
                len(first_tokens),
                max((len(row) for row in data_rows), default=0),
            )
            raw_headers = [
                _sanitize_header_value(first_tokens[idx] if idx < len(first_tokens) else "", idx)
                for idx in range(max_cols)
            ]
            headers = _make_unique_headers(raw_headers)
        else:
            data_rows = parsed_rows
            max_cols = max(len(row) for row in data_rows)
            headers = [f"column{idx + 1}" for idx in range(max_cols)]

    if not data_rows or max_cols == 0:
        raise ValueError("No data rows parsed from selected range")

    normalized_rows = []
    for row in data_rows:
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


# def _parse_lines_to_parquet(
#     lines: Iterable[str],
#     parquet_path: str,
#     parse_range: dict | None,
# ):
#     start_requested = int((parse_range or {}).get("start_line", 1) or 1)
#     end_requested = (parse_range or {}).get("end_line")
#     end_requested = int(end_requested) if end_requested is not None else None

#     if start_requested < 1:
#         start_requested = 1
#     if end_requested is not None and end_requested < start_requested:
#         end_requested = start_requested

#     total_lines = 0
#     selected_lines: list[str] = []
#     last_line = ""

#     for raw_line in lines:
#         total_lines += 1
#         line = raw_line.rstrip("\r\n")
#         last_line = line

#         if total_lines < start_requested:
#             continue
#         if end_requested is not None and total_lines > end_requested:
#             break
#         if line.strip():
#             selected_lines.append(line)

#     if total_lines == 0:
#         raise ValueError("Selected file is empty")

#     if start_requested > total_lines:
#         selected_lines = [last_line] if last_line.strip() else []

#     if not selected_lines:
#         raise ValueError("Selected range is empty")

#     delim = _infer_delimiter(selected_lines)
#     start_idx = _find_tabular_start(selected_lines, delim)
#     candidate_lines = selected_lines[start_idx:] if start_idx < len(selected_lines) else selected_lines
#     candidate_lines = [line for line in candidate_lines if line.strip()]
#     if not candidate_lines:
#         raise ValueError("No tabular data found in selected range")

#     first_tokens = _split_line(candidate_lines[0], delim)
#     second_tokens = _split_line(candidate_lines[1], delim) if len(candidate_lines) > 1 else []
#     header_is_present = (
#         _token_count(first_tokens) >= 2
#         and _line_has_string_tokens(candidate_lines[0], delim)
#         and (not second_tokens or _mostly_numeric(second_tokens))
#     )
#     data_lines = candidate_lines[1:] if header_is_present else candidate_lines

#     rows: list[list[str | None]] = []
#     max_cols = 0
#     for line in data_lines:
#         if not line.strip():
#             continue
#         cells = _split_line(line, delim)
#         if not cells:
#             continue
#         rows.append(cells)
#         max_cols = max(max_cols, len(cells))

#     if not rows or max_cols == 0:
#         raise ValueError("No data rows parsed from selected range")

#     if header_is_present:
#         raw_headers = _split_line(candidate_lines[0], delim)
#         headers = []
#         for header in raw_headers:
#             cleaned = _strip_leading_junk(header or "").strip()
#             if cleaned:
#                 headers.append(cleaned)
#         if len(headers) < max_cols:
#             headers += [f"column{idx + 1}" for idx in range(len(headers), max_cols)]
#         headers = headers[:max_cols]
#     else:
#         headers = [f"column{idx + 1}" for idx in range(max_cols)]
#     headers = _make_unique_headers(headers)

#     normalized_rows = []
#     for row in rows:
#         if len(row) < max_cols:
#             row = row + [None] * (max_cols - len(row))
#         elif len(row) > max_cols:
#             row = row[:max_cols]
#         normalized_rows.append(row)

#     frame = pd.DataFrame(normalized_rows, columns=headers)
#     stats: dict = {}
#     _update_numeric_stats(stats, frame)
#     sample_rows = frame.head(10).to_dict(orient="records")
#     row_count = len(frame)

#     frame.to_parquet(parquet_path, index=False)
#     return list(frame.columns), row_count, sample_rows, stats


# def text_range_to_parquet(
#     txt_path: str,
#     parquet_path: str,
#     parse_range: dict | None,
# ):
#     with open(txt_path, "r", errors="ignore") as handle:
#         return _parse_lines_to_parquet(handle, parquet_path, parse_range)

def text_range_to_parquet(
    txt_path: str,
    parquet_path: str,
    parse_range: dict | None,
    header_mode: str = "file",
    custom_headers: list[str] | None = None,
):
    with open(txt_path, "r", errors="ignore") as handle:
        return _parse_lines_to_parquet(
            handle,
            parquet_path,
            parse_range,
            header_mode=header_mode,
            custom_headers=custom_headers,
        )

# def text_range_stream_to_parquet(
#     chunks: Iterable[bytes],
#     parquet_path: str,
#     parse_range: dict | None,
#     on_chunk=None,
# ):
#     return _parse_lines_to_parquet(
#         _iter_text_lines_from_chunks(chunks, on_chunk=on_chunk),
#         parquet_path,
#         parse_range,
#     )

def text_range_stream_to_parquet(
    chunks: Iterable[bytes],
    parquet_path: str,
    parse_range: dict | None,
    header_mode: str = "file",
    custom_headers: list[str] | None = None,
    on_chunk=None,
):
    return _parse_lines_to_parquet(
        _iter_text_lines_from_chunks(chunks, on_chunk=on_chunk),
        parquet_path,
        parse_range,
        header_mode=header_mode,
        custom_headers=custom_headers,
    )
