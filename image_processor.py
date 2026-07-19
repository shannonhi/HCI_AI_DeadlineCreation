import io
import os
import shutil

import pytesseract
from PIL import Image

_DEFAULT_WINDOWS_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if not shutil.which("tesseract") and os.path.isfile(_DEFAULT_WINDOWS_PATH):
    pytesseract.pytesseract.tesseract_cmd = _DEFAULT_WINDOWS_PATH


def image_to_text(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes))
    return pytesseract.image_to_string(image).strip()


def is_text_usable(text: str, min_length: int = 20, min_alnum_ratio: float = 0.4) -> bool:
    stripped = text.strip()
    if len(stripped) < min_length:
        return False
    alnum_count = sum(c.isalnum() for c in stripped)
    return (alnum_count / len(stripped)) >= min_alnum_ratio
