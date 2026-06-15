"""Simula la rasterización SVG→bitmap que hace el navegador antes de enviar el
payload al servidor (svgToPlanBitmap). MuPDF renderiza cada asset vectorial a
PNG dataUrl para que dompdf reciba lo mismo que en producción.

También reemplaza la captura 3D simulada por una imagen real renderizada.
"""

import base64
import json

import fitz

PAYLOAD = r"c:\laragon\www\proyectopcl\storage\app\dialux-test-payload.json"

COVER_SVG = """<svg xmlns='http://www.w3.org/2000/svg' width='900' height='585'>
<rect width='900' height='585' fill='#1c2740'/>
<rect x='80' y='90' width='740' height='400' fill='#2b3a5c' stroke='#5eead4' stroke-width='3'/>
<polygon points='180,420 450,300 720,420 450,520' fill='#34466e' stroke='#94a3b8' stroke-width='2'/>
<polygon points='180,250 450,150 720,250 450,340' fill='#3d5380' stroke='#94a3b8' stroke-width='2'/>
<circle cx='320' cy='240' r='12' fill='#fbbf24'/>
<circle cx='450' cy='215' r='12' fill='#fbbf24'/>
<circle cx='580' cy='240' r='12' fill='#fbbf24'/>
<text x='110' y='140' fill='#5eead4' font-size='28' font-family='sans-serif'>Vista 3D (captura simulada)</text>
</svg>"""


def svg_to_png_data_url(svg: str, scale: float = 2.0) -> tuple[str, int, int]:
    doc = fitz.open(stream=svg.encode("utf-8"), filetype="svg")
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(scale, scale))
    data = base64.b64encode(pix.tobytes("png")).decode("ascii")
    return f"data:image/png;base64,{data}", pix.width, pix.height


with open(PAYLOAD, encoding="utf-8") as f:
    payload = json.load(f)

converted = 0
for asset in payload["document"]["assets"]:
    if asset.get("kind") == "vector" and asset.get("svg"):
        try:
            data_url, w, h = svg_to_png_data_url(asset["svg"])
        except Exception as exc:  # noqa: BLE001
            print("no se pudo rasterizar", asset["id"], exc)
            continue
        asset["kind"] = "bitmap"
        asset["mimeType"] = "image/png"
        asset["dataUrl"] = data_url
        asset["width"] = w
        asset["height"] = h
        asset.pop("svg", None)
        converted += 1
    elif asset.get("id") == "viewer-capture-3d":
        data_url, w, h = svg_to_png_data_url(COVER_SVG)
        asset["dataUrl"] = data_url
        asset["width"] = w
        asset["height"] = h

with open(PAYLOAD, "w", encoding="utf-8") as f:
    json.dump(payload, f)

print("assets vectoriales rasterizados:", converted)
