# Deadline Extractor

Deadline Extractor is a full-stack app that pulls deadlines out of syllabi, assignment sheets, and screenshots: upload a PDF, drop in a screenshot, or paste raw text, and a local LLM (via Ollama) scans the content and returns a structured list of deadlines — each with a title, date, and time — which you can review, correct, and export as an `.ics` calendar file. PDF text/tables are parsed with `pdfplumber` and screenshots are read with Tesseract OCR before being handed to the model, and the app runs entirely on your machine with no data sent to any external API.

## Prerequisites

Install these before continuing:

- **Python 3.11+** — https://www.python.org/downloads/windows/ (check "Add python.exe to PATH" during install)
- **Node.js 20+** — https://nodejs.org/en/download
- **Ollama** — https://ollama.com/download/windows
- **Tesseract OCR** — https://github.com/UB-Mannheim/tesseract/wiki (Windows installer, e.g. `tesseract-ocr-w64-setup-5.x.x.exe`)
  - During install, note the install path (default: `C:\Program Files\Tesseract-OCR`).
  - Add that folder to your `PATH` so the `tesseract` command is available, **or** just leave it at the default path — `image_processor.py` automatically falls back to `C:\Program Files\Tesseract-OCR\tesseract.exe` if `tesseract` isn't found on `PATH`.
  - Verify with `tesseract --version` in a new terminal.

## Pull the model

With Ollama installed and running, pull the model this app uses:

```
ollama pull gemma4:e2b
```

## Backend setup

From the project root:

```
pip install -r requirements.txt
```

Start the API server:

```
uvicorn main:app --reload
```

This serves the backend at `http://localhost:8000`.

## Frontend setup

In a separate terminal, from the project root:

```
cd frontend
npm install
npm run dev
```

This serves the frontend at `http://localhost:5173` (API requests to `/api` are proxied to the backend on port 8000).

## Open the app

With both servers running, open:

```
http://localhost:5173
```

## Try it

1. Paste some sample text into the text box, e.g. `Essay due 12 Sep, midterm exam 10/22, project proposal due the 9th.`
2. Click extract and confirm deadlines appear with titles, dates, and times.
3. Try uploading a PDF syllabus or a screenshot of an assignment page instead, and confirm text/OCR extraction populates the same way.
4. Select one or more deadlines and export them to download a `deadlines.ics` file; import it into any calendar app to confirm the events show up correctly.
