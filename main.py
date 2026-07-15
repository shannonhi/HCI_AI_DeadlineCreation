import os
import tempfile

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from deadline_extractor import extract_deadlines
from ics_generator import create_ics
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
    image_bytes = None

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

    try:
        deadlines = extract_deadlines(markdown_content, image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM error: {exc}")

    return {"deadlines": deadlines, "markdown": markdown_content}


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
