import os
import tempfile

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from deadline_extractor import extract_deadlines
from ics_generator import create_ics
from image_processor import image_to_text, is_text_usable
from pdf_processor import pdf_to_markdown

app = FastAPI(title="Deadline Extractor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Deadline(BaseModel):
    title: str
    date: str
    time: str = "23:59"
    description: str = ""


@app.post("/api/extract")
async def extract(
    pdf: UploadFile | None = File(default=None),
    screenshot: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
):
    if not pdf and not screenshot and not text:
        raise HTTPException(status_code=400, detail="Provide at least one file or text.")

    markdown_content = text or ""
    source_names = [f.filename for f in (pdf, screenshot) if f] or ["pasted text"]
    source_name = " + ".join(source_names)

    if pdf:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await pdf.read())
            tmp_path = tmp.name
        try:
            markdown_content = pdf_to_markdown(tmp_path)
        finally:
            os.unlink(tmp_path)

    if screenshot:
        image_bytes = await screenshot.read()
        ocr_text = image_to_text(image_bytes)
        if is_text_usable(ocr_text):
            section = f"## Screenshot (OCR)\n\n{ocr_text}"
            markdown_content = f"{markdown_content}\n\n{section}" if markdown_content else section
        elif not markdown_content:
            return {"deadlines": [], "unresolved": [], "markdown": "", "unreadable_image": True}

    try:
        result = extract_deadlines(markdown_content, source_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM error: {exc}")

    return {
        "deadlines": result["deadlines"],
        "unresolved": result["unresolved"],
        "markdown": markdown_content,
        "unreadable_image": False,
    }


@app.post("/api/ics")
async def download_ics(deadlines: list[Deadline]):
    try:
        ics_bytes = create_ics([d.model_dump() for d in deadlines])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="deadlines.ics"'},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
