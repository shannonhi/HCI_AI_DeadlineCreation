import pdfplumber


def pdf_to_markdown(pdf_path: str) -> str:
    sections = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            sections.append(f"## Page {page_num}\n")

            text = page.extract_text(x_tolerance=2, y_tolerance=2)
            if text:
                sections.append(text.strip())

            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                md_rows = []
                for i, row in enumerate(table):
                    cleaned = [cell.replace("\n", " ").strip() if cell else "" for cell in row]
                    md_rows.append("| " + " | ".join(cleaned) + " |")
                    if i == 0:
                        md_rows.append("| " + " | ".join(["---"] * len(row)) + " |")
                sections.append("\n".join(md_rows))

            sections.append("")

    return "\n".join(sections).strip()
