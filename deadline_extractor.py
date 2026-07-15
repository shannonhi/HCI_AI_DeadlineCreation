import base64
import json
import re
import ollama

MODEL = "gemma4:e2b"

SYSTEM_PROMPT = """You are a deadline extraction assistant. Your job is to identify all deadlines, due dates, submission dates, exam dates, and time-sensitive events from the provided content.

Return ONLY a JSON array with no additional text. Each item must follow this exact schema:
[
  {
    "title": "Brief descriptive name of the deadline",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "description": "Additional context or details about this deadline"
  }
]

Rules:
- "date" must always be YYYY-MM-DD format. If only a month/day is given without a year, infer the most logical upcoming year.
- "time" should be "HH:MM" in 24h format. Use "23:59" if no time is specified.
- If no deadlines exist, return an empty array [].
- Do not include any explanation, markdown fences, or extra text — only the JSON array.
"""


def extract_deadlines(markdown_content: str, image_bytes: bytes | None = None) -> list[dict]:
    messages = []

    content_parts = []

    if markdown_content.strip():
        content_parts.append(
            "The following is extracted text from a PDF document (in Markdown):\n\n"
            + markdown_content
        )

    if image_parts := _build_image_content(image_bytes):
        content_parts.append("The following screenshot was also provided for additional context.")
        messages.append({
            "role": "user",
            "content": "\n\n".join(content_parts) if content_parts else "Extract deadlines from the screenshot.",
            "images": image_parts,
        })
    else:
        messages.append({
            "role": "user",
            "content": "\n\n".join(content_parts) if content_parts else "No content provided.",
        })

    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        options={"temperature": 0.1},
    )

    raw = response["message"]["content"].strip()
    return _parse_json(raw)


def _build_image_content(image_bytes: bytes | None) -> list[str]:
    if not image_bytes:
        return []
    return [base64.b64encode(image_bytes).decode("utf-8")]


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
