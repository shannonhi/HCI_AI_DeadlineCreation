import calendar
import json
import os
import re
from datetime import datetime

import ollama

MODEL = "gemma4:e2b"

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
LOG_FILE = os.path.join(LOG_DIR, "model_outputs.txt")

# Long documents are split into chunks so each model call stays short — JSON
# compliance and attention to the full chunk held up much better in testing
# than sending an entire long document in one call.
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200

SYSTEM_PROMPT_TEMPLATE = """You are a deadline extraction assistant. Your job is to identify all deadlines, due dates, submission dates, exam dates, and time-sensitive events from the provided content.

Return ONLY a JSON array with no additional text. Each item must follow this exact schema:
[
  {{
    "title": "Brief descriptive name of the deadline",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "description": "Additional context or details about this deadline",
    "year_inferred": true or false
  }}
]

Rules:
- "date" must always be YYYY-MM-DD format. If only a month/day is given without a year, infer the most logical upcoming year.
- "time" should be "HH:MM" in 24h format. Use "23:59" if no time is specified.
- "year_inferred" must be true if the source text did NOT explicitly state a year for this date (you had to assume/infer one), and false if the source text explicitly stated the year.
- If no deadlines exist, return an empty array [].
- Do not include any explanation, markdown fences, or extra text — only the JSON array.
- Today's date is {today}. Use this to resolve relative or partial dates ("next Friday", dates without a year) to the most logical upcoming date.

Examples:
"PDS due 9" -> [{{"title": "PDS", "date": "2026-08-09", "time": "23:59", "description": "PDS deadline", "year_inferred": true}}]
"report due on 4" -> [{{"title": "report", "date": "2026-08-04", "time": "23:59", "description": "Report deadline", "year_inferred": true}}]
"essay due 12 Sep" -> [{{"title": "essay", "date": "2026-09-12", "time": "23:59", "description": "Essay deadline", "year_inferred": true}}]
"see you next week" -> []
"""


def _build_system_prompt() -> str:
    today = datetime.now().strftime("%A, %d %B %Y")
    return SYSTEM_PROMPT_TEMPLATE.format(today=today)


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks so each model call stays short.
    Overlap ensures a deadline mentioned right at a chunk boundary still
    appears whole in at least one chunk."""
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunks.append(text[start:end])
        if end == n:
            break
        start = end - overlap
    return chunks


def extract_deadlines(markdown_content: str, source_name: str = "unknown") -> dict:
    """Returns {"deadlines": [...], "unresolved": [...]}.

    Every item in "deadlines" has a date that is either verbatim from the
    source text or deterministically computed from a day number that IS
    verbatim in the source text. Items where no day-of-month could be
    grounded in the source text at all are moved to "unresolved" (title +
    description only, no fabricated date) for the user to fill in manually.

    Long documents are processed in chunks (see CHUNK_SIZE); results are
    merged and deduplicated across chunks. Slash-date format (DD/MM vs
    MM/DD) is inferred once from the whole document so it's applied
    consistently across chunks.
    """
    convention = _infer_document_date_convention(markdown_content)

    chunks = _chunk_text(markdown_content)
    multi_chunk = len(chunks) > 1

    all_resolved: list[dict] = []
    all_unresolved: list[dict] = []

    for i, chunk in enumerate(chunks):
        chunk_label = f"{source_name} [chunk {i + 1}/{len(chunks)}]" if multi_chunk else source_name
        resolved, unresolved = _extract_from_chunk(chunk, chunk_label, convention)
        all_resolved.extend(resolved)
        all_unresolved.extend(unresolved)

    return {
        "deadlines": _dedupe_resolved(all_resolved),
        "unresolved": _dedupe_unresolved(all_unresolved),
    }


def _extract_from_chunk(chunk_text: str, source_name: str, convention: str) -> tuple[list[dict], list[dict]]:
    content = (
        "The following is extracted text from a document (in Markdown):\n\n" + chunk_text
        if chunk_text.strip()
        else "No content provided."
    )

    response = ollama.chat(
        model=MODEL,
        messages=[
            {"role": "system", "content": _build_system_prompt()},
            {"role": "user", "content": content},
        ],
        options={"temperature": 0.1},
    )

    raw = response["message"]["content"].strip()
    _log_model_output(source_name, raw)
    parsed = _parse_json(raw)

    if not parsed:
        # The model is unreliable on day-only phrasing ("due the 9th") — the
        # same input can pass or fail across runs. If it returned nothing but
        # the source text still looks like a deadline, fall back to a
        # deterministic regex match instead of trusting the empty result.
        fallback = _find_fallback_deadlines(chunk_text, convention)
        if fallback:
            return fallback, []

    resolved: list[dict] = []
    unresolved: list[dict] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        item = _clean_inference_notes(_resolve_deadline_date(item, chunk_text, convention))
        if item.pop("needs_manual_date", False):
            unresolved.append({"title": item.get("title", ""), "description": item.get("description", "")})
        else:
            resolved.append(item)

    return resolved, unresolved


def _dedupe_resolved(items: list[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    deduped = []
    for item in items:
        key = (str(item.get("title", "")).strip().lower(), str(item.get("date", "")))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _dedupe_unresolved(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    deduped = []
    for item in items:
        key = str(item.get("title", "")).strip().lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _log_model_output(source_name: str, raw: str) -> None:
    timestamp = datetime.now().isoformat(timespec="seconds")
    entry = f"=== {timestamp} | {source_name} ===\n{raw}\n=== END ===\n\n"

    print(entry, flush=True)

    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry)


_MONTH_ALT = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?"
    r"|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_MONTH_RE = re.compile(rf"\b({_MONTH_ALT})\b", re.IGNORECASE)
_NUMERIC_DATE_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?\b")
_KEYWORD_DAY_RE = re.compile(
    r"\b(?:due|deadline|submit\w*|by|before|no later than|close[sd]?|end[s]?)\b"
    r"[^.\n]{0,30}?\b0?(\d{1,2})(?:st|nd|rd|th)?\b",
    re.IGNORECASE,
)

_MONTH_NUM = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _month_number(name: str) -> int:
    return _MONTH_NUM[name.strip().lower()[:3]]


_SLASH_DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b")

# Reasons a slash date's day/month assignment can come from — used to pick
# the right confirmation badge (or none) in the UI.
REASON_FORCED = "forced"          # only one interpretation is a valid month — not ambiguous
REASON_INFERRED = "inferred"      # ambiguous alone, resolved via document-wide convention
REASON_ASSUMED = "assumed"        # ambiguous, no document-wide evidence — defaulted to DD/MM
REASON_CONFLICTING = "conflicting"  # document has contradictory evidence elsewhere


def _infer_document_date_convention(source_text: str) -> str:
    """Scan the whole document for slash dates and infer its day/month
    convention from any unambiguous ones (where one number is >12 and so
    can only be a day). Returns "mm_dd", "dd_mm", "conflicting" (contradictory
    unambiguous evidence found), or "unknown" (no unambiguous evidence)."""
    if not source_text:
        return "unknown"

    has_mm_dd_only = False  # e.g. "7/22" — second number >12, must be day -> MM/DD
    has_dd_mm_only = False  # e.g. "25/08" — first number >12, must be day -> DD/MM

    for match in _SLASH_DATE_RE.finditer(source_text):
        a, b = int(match.group(1)), int(match.group(2))
        if a <= 12 and b > 12:
            has_mm_dd_only = True
        elif a > 12 and b <= 12:
            has_dd_mm_only = True

    if has_mm_dd_only and has_dd_mm_only:
        return "conflicting"
    if has_mm_dd_only:
        return "mm_dd"
    if has_dd_mm_only:
        return "dd_mm"
    return "unknown"


def _resolve_ambiguous_day_month(a: int, b: int, convention: str = "unknown") -> tuple[int, int, str] | None:
    """Given the two numbers of a slash/dash date (in the order they appear),
    decide which is day and which is month.

    - If only one of them can validly be a month (the other is >12), that
      assignment is forced regardless of convention — not ambiguous.
    - Otherwise (both <=12, genuinely ambiguous): resolved using the
      document-wide `convention` ("mm_dd" or "dd_mm") if known; if the
      document has conflicting evidence, still resolved (defaulting to
      DD/MM) but flagged "conflicting" so every slash date gets a badge;
      if there's no document-wide evidence at all, defaults to DD/MM and
      is flagged "assumed".

    Returns (day, month, reason), or None if neither number can be a valid
    month (both >12 — not a real date)."""
    if a > 12 and b > 12:
        return None

    if convention == "conflicting":
        if a > 12:
            return a, b, REASON_CONFLICTING
        if b > 12:
            return b, a, REASON_CONFLICTING
        return a, b, REASON_CONFLICTING  # DD/MM default, still flagged

    if a > 12 and b <= 12:
        return a, b, REASON_FORCED
    if b > 12 and a <= 12:
        return b, a, REASON_FORCED

    # Both <=12 — genuinely ambiguous on its own.
    if convention == "mm_dd":
        return b, a, REASON_INFERRED
    if convention == "dd_mm":
        return a, b, REASON_INFERRED
    return a, b, REASON_ASSUMED  # no document-wide evidence — DD/MM default


def _resolve_slash_date(source_text: str, model_day: int, convention: str = "unknown") -> tuple[str, str] | None:
    """Slash dates like "07/08/2026" (or "7/22" without a year) are
    ambiguous (DD/MM vs MM/DD) and the model flip-flops on them across
    runs. Resolve deterministically in code instead of trusting the model,
    using the document-wide `convention` when the date is ambiguous on its
    own. Returns (date_str, reason) or None if no usable match is found."""
    if not source_text:
        return None

    matches = list(_SLASH_DATE_RE.finditer(source_text))
    if not matches:
        return None

    match = matches[0]
    if len(matches) > 1:
        # Multiple slash dates in this document — only apply if we can
        # correlate this deadline with one of them via its day number.
        match = next(
            (m for m in matches if model_day in (int(m.group(1)), int(m.group(2)))),
            None,
        )
        if match is None:
            return None

    a, b = int(match.group(1)), int(match.group(2))

    resolved = _resolve_ambiguous_day_month(a, b, convention)
    if resolved is None:
        return None
    day, month, reason = resolved

    year_group = match.group(3)
    if year_group:
        year = int(year_group)
        if year < 100:
            year += 2000
        try:
            date = datetime(year, month, day)
        except ValueError:
            return None
    else:
        date = _next_occurrence_of_month_day(month, day, datetime.now())
        if not date:
            return None

    return date.strftime("%Y-%m-%d"), reason


def _day_verbatim_present(source_text: str, day: int) -> bool:
    """Whether this day-of-month appears anywhere in the text as a standalone
    number/ordinal — i.e. the model didn't just invent it."""
    if not source_text:
        return False
    return bool(re.search(rf"\b0?{day}(st|nd|rd|th)?\b", source_text, re.IGNORECASE))


def _has_explicit_month_for_day(source_text: str, day: int) -> bool:
    """Whether the source text states a month alongside this day-of-month, e.g.
    "August 9", "9 Aug", "8/9", "03-09" — as opposed to a bare "the 9th"."""
    if not source_text:
        return False

    for match in _NUMERIC_DATE_RE.finditer(source_text):
        a, b = int(match.group(1)), int(match.group(2))
        if day in (a, b):
            return True

    day_re = re.compile(rf"\b0?{day}(st|nd|rd|th)?\b", re.IGNORECASE)
    for match in day_re.finditer(source_text):
        window = source_text[max(0, match.start() - 25) : match.end() + 25]
        if _MONTH_RE.search(window):
            return True

    return False


def _extract_day_candidates(source_text: str) -> list[int]:
    """Day-of-month numbers that appear near deadline-context keywords
    ("due", "submit", "by", ...) in the source text, in order of appearance."""
    seen: list[int] = []
    for match in _KEYWORD_DAY_RE.finditer(source_text):
        day = int(match.group(1))
        if 1 <= day <= 31 and day not in seen:
            seen.append(day)
    return seen


def _next_occurrence_of_day(day: int, today: datetime) -> datetime | None:
    """The next date (on or after `today`) whose day-of-month is `day`."""
    year, month = today.year, today.month
    for _ in range(24):  # look up to 2 years ahead
        last_day_of_month = calendar.monthrange(year, month)[1]
        if day <= last_day_of_month:
            candidate = datetime(year, month, day)
            if candidate.date() >= today.date():
                return candidate
        month += 1
        if month > 12:
            month = 1
            year += 1
    return None


def _next_occurrence_of_month_day(month: int, day: int, today: datetime) -> datetime | None:
    """The next date (on or after `today`) with this exact month and day
    (rolling the year forward as needed, e.g. for a leap-day that doesn't
    exist in the immediate next year)."""
    year = today.year
    for _ in range(8):
        try:
            candidate = datetime(year, month, day)
        except ValueError:
            year += 1
            continue
        if candidate.date() >= today.date():
            return candidate
        year += 1
    return None


# Fallback date-expression: tries month-aware forms first (so an explicit
# month/year in the text is used verbatim), then falls back to a bare day.
_FALLBACK_DATE_EXPR = (
    rf"(?:"
    rf"(?P<month1>{_MONTH_ALT})\s+(?P<day1>\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(?P<year1>\d{{4}}))?"
    rf"|(?P<day2>\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?(?P<month2>{_MONTH_ALT})(?:,?\s+(?P<year2>\d{{4}}))?"
    rf"|(?P<num_a>\d{{1,2}})[/-](?P<num_b>\d{{1,2}})(?:[/-](?P<num_year>\d{{2,4}}))?"
    rf"|(?P<day3>\d{{1,2}})(?:st|nd|rd|th)?"
    rf")"
)
_FALLBACK_DEADLINE_RE = re.compile(
    r"(?P<title>[^.\n]{0,60}?)\b(?P<keyword>due|submit(?:ted|ting)?|deadline)\b"
    r"\s*(?:on\s+|by\s+)?(?:the\s+)?" + _FALLBACK_DATE_EXPR,
    re.IGNORECASE,
)


def _resolve_fallback_match(match: re.Match, today: datetime, convention: str) -> tuple[str, bool, str | None] | None:
    """Turns a _FALLBACK_DEADLINE_RE match into (date_str, date_estimated,
    date_format_reason), or None if the matched date is invalid. Prefers
    an explicit month/year verbatim from the text over guessing; only falls
    back to deterministic next-occurrence resolution when the source truly
    has no month."""
    format_reason = None

    if match.group("month1"):
        month = _month_number(match.group("month1"))
        day = int(match.group("day1"))
        year = match.group("year1")
    elif match.group("month2"):
        month = _month_number(match.group("month2"))
        day = int(match.group("day2"))
        year = match.group("year2")
    elif match.group("num_a") and match.group("num_b"):
        a, b = int(match.group("num_a")), int(match.group("num_b"))
        resolved_pair = _resolve_ambiguous_day_month(a, b, convention)
        if resolved_pair is None:
            return None
        day, month, reason = resolved_pair
        format_reason = reason if reason != REASON_FORCED else None
        year = match.group("num_year")
    else:
        month = None
        day = int(match.group("day3"))
        year = None

    if not (1 <= day <= 31):
        return None

    if month is not None:
        # Explicit month present in the text — use it verbatim.
        if year:
            y = int(year)
            if y < 100:
                y += 2000
            try:
                date = datetime(y, month, day)
            except ValueError:
                return None
            return date.strftime("%Y-%m-%d"), False, format_reason

        date = _next_occurrence_of_month_day(month, day, today)
        if not date:
            return None
        return date.strftime("%Y-%m-%d"), False, format_reason

    # No month anywhere in the matched text — deterministic day-only
    # resolution, same function the model-driven path uses.
    date = _next_occurrence_of_day(day, today)
    if not date:
        return None
    return date.strftime("%Y-%m-%d"), True, None


def _find_fallback_deadlines(source_text: str, convention: str = "unknown") -> list[dict]:
    """Deterministic regex fallback for when the model unreliably returns []
    on deadline phrasing it should have caught ("PDS due 9", "report due on
    4"). If a month (name or numeric) is present in the matched text it's
    used verbatim; only a bare day number triggers next-occurrence
    resolution. Uses the same date-resolution functions as the model-driven
    path, so both paths produce the same date for the same input."""
    if not source_text:
        return []

    results: list[dict] = []
    seen: set[tuple[str, str]] = set()
    today = datetime.now()

    for match in _FALLBACK_DEADLINE_RE.finditer(source_text):
        resolved = _resolve_fallback_match(match, today, convention)
        if not resolved:
            continue
        date_str, date_estimated, date_format_reason = resolved

        title = match.group("title").strip(" \t-:;,")
        if not title:
            title = match.group("keyword").capitalize()

        key = (title.lower(), date_str)
        if key in seen:
            continue
        seen.add(key)

        results.append(
            {
                "title": title,
                "date": date_str,
                "time": "23:59",
                "description": f"Deadline extracted from source text: \"{match.group(0).strip()}\"",
                "date_estimated": date_estimated,
                "date_format_ambiguous": date_format_reason is not None,
                "date_format_reason": date_format_reason,
            }
        )

    return results


def _resolve_deadline_date(deadline: dict, source_text: str, convention: str = "unknown") -> dict:
    year_inferred = deadline.pop("year_inferred", False)
    deadline["date_format_ambiguous"] = False
    deadline["date_format_reason"] = None

    try:
        date = datetime.strptime(deadline["date"], "%Y-%m-%d")
    except (KeyError, ValueError, TypeError):
        deadline["date_estimated"] = False
        return deadline

    model_day = date.day

    slash_resolved = _resolve_slash_date(source_text, model_day, convention)
    if slash_resolved:
        # An ambiguous DD/MM-vs-MM/DD slash date is present — the model
        # flip-flops on these across runs, so ignore its interpretation
        # entirely and resolve deterministically in code instead.
        date_str, reason = slash_resolved
        deadline["date"] = date_str
        deadline["date_estimated"] = False
        if reason == REASON_FORCED:
            deadline["date_format_ambiguous"] = False
        else:
            deadline["date_format_ambiguous"] = True
            deadline["date_format_reason"] = reason
        return deadline

    if _has_explicit_month_for_day(source_text, model_day):
        # Day is grounded in the text AND has a month next to it — trust it.
        deadline["date_estimated"] = False
        if year_inferred:
            today = datetime.now()
            while date.date() < today.date():
                try:
                    date = date.replace(year=date.year + 1)
                except ValueError:
                    # Feb 29 rolling into a non-leap year — shift to Feb 28
                    date = date.replace(year=date.year + 1, day=28)
            deadline["date"] = date.strftime("%Y-%m-%d")
        return deadline

    if _day_verbatim_present(source_text, model_day):
        # Day is grounded in the text but had no month next to it ("the 9th") —
        # the model's month is a guess we can't trust. Ignore it and compute
        # deterministically from the day we DID verify.
        estimated = _next_occurrence_of_day(model_day, datetime.now())
        if estimated:
            deadline["date"] = estimated.strftime("%Y-%m-%d")
        deadline["date_estimated"] = True
        return deadline

    # The model's day itself doesn't appear anywhere in the source text —
    # it's fabricated, not just under-specified. Look for the real day
    # number near deadline-context keywords instead of trusting the model.
    candidates = _extract_day_candidates(source_text)
    if candidates:
        real_day = candidates[0]
        estimated = _next_occurrence_of_day(real_day, datetime.now())
        if estimated:
            deadline["date"] = estimated.strftime("%Y-%m-%d")
        deadline["date_estimated"] = True
        return deadline

    # No day-of-month for this entry is grounded in the source text at all —
    # there is nothing verbatim or deterministic to compute from. Don't let
    # any fabricated date reach the UI; route this one to manual entry.
    deadline["needs_manual_date"] = True
    return deadline


_INFERENCE_NOTE_RE = re.compile(
    r"\s*\((?:[^()]*\b(?:infer(?:red|ence)?|assum(?:ed|ption)|guess(?:ed)?)\b[^()]*)\)",
    re.IGNORECASE,
)


def _clean_inference_notes(deadline: dict) -> dict:
    """Strip the model's leaked reasoning asides, e.g. "(Month inferred as July)"."""
    for field in ("title", "description"):
        value = deadline.get(field)
        if isinstance(value, str):
            deadline[field] = _INFERENCE_NOTE_RE.sub("", value).strip()
    return deadline


def _parse_json(raw: str) -> list[dict]:
    # Strip markdown code fences if the model adds them anyway
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE).strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        # Try to find a JSON array anywhere in the response
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return []
