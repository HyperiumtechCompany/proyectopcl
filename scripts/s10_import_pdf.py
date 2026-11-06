"""Lector de ACU S10 en PDF. Extrae datos; no importa ni guarda en Laravel."""

import argparse
import json
import re
import sys
import unicodedata
from decimal import Decimal, ROUND_HALF_UP


SECTIONS = {
    "MANO DE OBRA": "mano_de_obra",
    "MATERIALES": "materiales",
    "EQUIPO": "equipos",
    "EQUIPOS": "equipos",
    "SUB-PARTIDAS": "subpartidas",
    "SUB-CONTRATOS": "subcontratos",
}
NUMBER = r"-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
START = re.compile(
    r"^\s*(?:Partida:\s*([\d.]+)|(CU\w+))\s+(.*?)\s+Rendimiento:\s*(.*)$"
)
COST = re.compile(rf"^\s*Costo unitario por\s+(.+?)\s+({NUMBER})\s*$")
SECTION = re.compile(rf"^\s*({'|'.join(SECTIONS)})\s+({NUMBER})\s*$")
RESOURCE = re.compile(
    rf"^\s*(\d{{6,}}|CU\w+)\s+(.*?)\s+(\S+)\s+(-|{NUMBER})"
    rf"\s+({NUMBER})\s+({NUMBER})\s+({NUMBER})\s*$"
)
RESOURCE_START = re.compile(r"^\s*(\d{6,}|CU\w+)\s+")
PAGE_METADATA = re.compile(
    r"^\s*(?:Analisis de Costos Unitarios|PROYECTO|PRESUPUESTO|PROPIETARIO|"
    r"UBICACION|FECHA PROYECTO|Código\s+Descripción|P[áa]gina\b|"
    r"Detalle de sub-partidas del presupuesto)", re.I
)


def reconstruct_rows(words):
    """Reconstruye columnas por sus encabezados y une celdas envueltas.

    Las palabras de PyMuPDF incluyen coordenadas: evita consumir la última palabra
    de la descripción como unidad cuando la celda está vacía.
    """
    lines = []
    for word in sorted(words, key=lambda w: (w[1], w[0])):
        if not lines or abs(word[1] - lines[-1][0][1]) > 1.5:
            lines.append([])
        lines[-1].append(word)
    columns = None
    pending = None
    output = []

    def flush():
        nonlocal pending
        if pending is not None:
            code, description, unit, resources, quantity, price, partial = pending
            output.append(" ".join([
                "".join(code), " ".join(description), "".join(unit) or "__UNIDAD_AUSENTE__",
                "".join(resources) or "__RECURSOS_AUSENTES__", "".join(quantity),
                "".join(price), "".join(partial),
            ]))
            pending = None

    for line in lines:
        line = sorted(line, key=lambda word: word[0])
        text = " ".join(word[4] for word in line)
        headers = {}
        for word in line:
            label = "".join(c for c in unicodedata.normalize("NFD", word[4].lower()) if not unicodedata.combining(c))
            if label.startswith("descrip"):
                headers["description"] = word
            elif label in ("unid.", "recursos", "cantidad", "precio", "parcial"):
                headers[label] = word
        if len(headers) == 6:
            flush()
            columns = [
                headers["description"][0] - 2,
                headers["unid."][0] - 8,
                (headers["unid."][2] + headers["recursos"][0]) / 2,
                (headers["recursos"][2] + headers["cantidad"][0]) / 2,
                (headers["cantidad"][2] + headers["precio"][0]) / 2,
                (headers["precio"][2] + headers["parcial"][0]) / 2,
            ]
            output.append(text)
            continue
        if columns is None and RESOURCE_START.match(text) and not START.match(text):
            output.append(text.split()[0] + " COLUMNAS_NO_IDENTIFICADAS")
            continue
        if columns is not None and not START.match(text):
            cells = [[] for _ in range(7)]
            for word in line:
                center = (word[0] + word[2]) / 2
                index = sum(center >= boundary for boundary in columns)
                cells[index].append(word[4])
            if cells[0] and re.fullmatch(r"\d{6,}|CU\w+", "".join(cells[0])):
                flush()
                pending = cells
                continue
            if pending is not None and not cells[0] and not COST.match(text):
                # Una continuación solo puede ampliar descripción o dígitos de la
                # misma celda. Otros textos siguen pendientes de revisión.
                numeric_fragments = all(not cell or re.fullmatch(r"\d+", "".join(cell)) for cell in cells[2:])
                if numeric_fragments:
                    for index, cell in enumerate(cells):
                        pending[index].extend(cell)
                    continue
        flush()
        output.append(text)
    flush()
    return "\n".join(output)


def decimal(text):
    return Decimal(text.replace(",", ""))


def money(value):
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_pages(pages):
    """Formato Veterinaria: conserva estado entre páginas y evidencia de origen."""
    analyses, issues, empty_pages = [], [], []
    current = None
    section = None
    page_count = 0

    def issue(kind, page, message):
        issues.append({"kind": kind, "page": page,
                       "code": current["partida_code"] if current else None,
                       "message": message})

    for page_count, text in enumerate(pages, 1):
        if not text.strip():
            empty_pages.append(page_count)
        if "\ufffd" in text:
            issue("text_encoding", page_count, "Texto con caracteres no recuperables.")
        for line in text.splitlines():
            if not line.strip():
                continue
            start = START.match(line)
            if start:
                code, auxiliary, description, rendimiento = start.groups()
                rend = re.match(rf"^({NUMBER})(?:\s|$)", rendimiento)
                current = {
                    "partida_code": code or auxiliary,
                    "partida_desc": description.strip(),
                    "kind": "main" if code else "auxiliary",
                    "page": page_count,
                    "unidad": "",
                    "rendimiento": float(decimal(rend[1])) if rend else None,
                    "rendimiento_text": rendimiento,
                    "declared_cost": None,
                    "section_totals": {},
                    **{key: [] for key in set(SECTIONS.values())},
                }
                analyses.append(current)
                section = None
                continue
            if current is None:
                continue
            cost = COST.match(line)
            if cost:
                current["unidad"] = cost[1]
                current["declared_cost"] = float(decimal(cost[2]))
                continue
            heading = SECTION.match(line)
            if heading:
                section = SECTIONS[heading[1]]
                if section in current["section_totals"]:
                    issue("repeated_section", page_count, line.strip())
                current["section_totals"][section] = float(decimal(heading[2]))
                continue
            resource = RESOURCE.match(line)
            if resource:
                if section is None:
                    issue("resource_without_section", page_count, line.strip())
                    continue
                code, description, unit, resources, quantity, price, partial = resource.groups()
                if unit == "__UNIDAD_AUSENTE__":
                    unit = ""
                    issue("missing_unit", page_count, f"{code}: unidad vacía en el documento.")
                q, p, reported = map(decimal, (quantity, price, partial))
                percentage = unit.lower() in ("%mo", "%mt")
                expected = q * p / (100 if percentage else 1)
                component = {
                    "codigo": code, "proveedor": None,
                    "descripcion": description.strip(), "unidad": unit,
                    "recursos": None if resources == "-" else float(decimal(resources)),
                    "cantidad": float(q),
                    "precio_unitario": 0 if section == "equipos" else float(p),
                    "precio_hora": float(p) if section == "equipos" else 0,
                    "factor_desperdicio": 1,
                    "reported_partial": float(reported), "page": page_count,
                }
                current[section].append(component)
                if q < 0 or p < 0 or reported < 0:
                    issue("negative_value", page_count, line.strip())
                if unit.startswith("%") and not percentage:
                    issue("unknown_percentage", page_count, line.strip())
                if money(expected) != money(reported):
                    issue("component_partial_difference", page_count,
                          f"{code}: parcial {reported}; cantidad/precio {money(expected)}.")
                continue
            if RESOURCE_START.match(line):
                issue("unread_resource", page_count, line.strip())
            elif PAGE_METADATA.match(line):
                continue
            elif current["declared_cost"] is None and section is None:
                # Continuación de una descripción extensa antes del costo unitario.
                current["partida_desc"] += " " + line.strip()
            else:
                # No asumir que texto desconocido es irrelevante: queda para revisión.
                issue("unrecognized_text", page_count, line.strip())

    seen = set()
    for analysis in analyses:
        code = analysis["partida_code"]
        if code in seen:
            issues.append({"kind": "duplicate_analysis", "code": code,
                           "page": analysis["page"], "message": "Código de análisis repetido."})
        seen.add(code)
        totals = analysis["section_totals"]
        if analysis["declared_cost"] is None or not totals:
            issues.append({"kind": "incomplete_analysis", "code": code,
                           "page": analysis["page"], "message": "Falta costo o secciones."})
            continue
        if money(sum((Decimal(str(v)) for v in totals.values()), Decimal(0))) != money(Decimal(str(analysis["declared_cost"]))):
            issues.append({"kind": "analysis_total_difference", "code": code,
                           "page": analysis["page"], "message": "Subtotales no concilian con el costo."})
        for key, total in totals.items():
            row_sum = sum((Decimal(str(c["reported_partial"])) for c in analysis[key]), Decimal(0))
            if money(row_sum) != money(Decimal(str(total))):
                issues.append({"kind": "section_total_difference", "code": code,
                               "page": analysis["page"], "message": f"Componentes de {key} no concilian con subtotal."})

    if not analyses:
        issues.append({"kind": "no_analyses", "code": None,
                       "page": 1 if page_count else None,
                       "message": "No se reconocieron bloques de ACU del formato de prueba."})
    return {"pages": page_count, "empty_pages": empty_pages,
            "analyses": analyses, "issues": issues}


def read_pdf(filename=None, data=None):
    # Dependencia ya disponible localmente; no se instala ni se usa desde la aplicación.
    try:
        import fitz
    except ImportError as error:
        raise ValueError("Este laboratorio requiere el PyMuPDF ya disponible en el entorno local.") from error
    with (fitz.open(stream=data, filetype='pdf') if data is not None else fitz.open(filename)) as document:
        if not document.is_pdf or document.needs_pass:
            raise ValueError("Se requiere un PDF válido sin contraseña.")
        return parse_pages(reconstruct_rows(page.get_text("words")) for page in document)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", nargs='?')
    parser.add_argument('--stdin', action='store_true')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        if not args.stdin and not args.pdf:
            parser.error('Indica un PDF o --stdin.')
        result = read_pdf(data=sys.stdin.buffer.read()) if args.stdin else read_pdf(args.pdf)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    except (ValueError, RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
