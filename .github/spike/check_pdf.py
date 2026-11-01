import sys, fitz  # pymupdf

doc = fitz.open(sys.argv[1])
print("pages:", doc.page_count)
print("metadata:", doc.metadata)
for i, page in enumerate(doc):
    r = page.rect
    print(f"page {i + 1}: {r.width:.2f} x {r.height:.2f} pt (A4 = 595.28 x 841.89), mediabox {page.mediabox}")
    print("  fonts:", [(f[3], f[2]) for f in page.get_fonts()])
    print("  text:", repr(page.get_text().strip()))
    print("  drawings (border box):", [str(d["rect"]) for d in page.get_drawings()][:4])
