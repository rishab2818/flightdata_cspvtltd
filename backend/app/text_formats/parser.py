import re

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


def _make_unique_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    output: list[str] = []
    for idx, header in enumerate(headers):
        base = _strip_leading_junk(str(header or "")).strip() or f"column_{idx + 1}"
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
    start_idx = _find_tabular_start(selected_lines, delim)
    candidate_lines = selected_lines[start_idx:] if start_idx < len(selected_lines) else selected_lines
    candidate_lines = [line for line in candidate_lines if line.strip()]
    if not candidate_lines:
        raise ValueError("No tabular data found in selected range")

    first_tokens = _split_line(candidate_lines[0], delim)
    second_tokens = _split_line(candidate_lines[1], delim) if len(candidate_lines) > 1 else []
    header_is_present = (
        _token_count(first_tokens) >= 2
        and _line_has_string_tokens(candidate_lines[0], delim)
        and (not second_tokens or _mostly_numeric(second_tokens))
    )
    data_lines = candidate_lines[1:] if header_is_present else candidate_lines

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
        raw_headers = _split_line(candidate_lines[0], delim)
        headers = []
        for header in raw_headers:
            cleaned = _strip_leading_junk(header or "").strip()
            if cleaned:
                headers.append(cleaned)
        if len(headers) < max_cols:
            headers += [f"column_{idx + 1}" for idx in range(len(headers), max_cols)]
        headers = headers[:max_cols]
    else:
        headers = [f"column_{idx + 1}" for idx in range(max_cols)]
    headers = _make_unique_headers(headers)

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
