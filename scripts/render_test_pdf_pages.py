import sys

import fitz

doc = fitz.open(r"c:\laragon\www\proyectopcl\storage\app\dialux-test.pdf")
pages = [int(p) for p in sys.argv[1:]] if len(sys.argv) > 1 else list(range(1, len(doc) + 1))
print("total pages:", len(doc))
for p in pages:
    if p < 1 or p > len(doc):
        continue
    pix = doc[p - 1].get_pixmap(dpi=80)
    pix.save(rf"c:\laragon\www\proyectopcl\storage\app\testpdf_{p:02d}.png")
print("rendered:", pages)
