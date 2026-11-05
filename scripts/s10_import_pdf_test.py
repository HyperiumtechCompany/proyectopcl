import unittest

from s10_import_pdf import parse_pages, reconstruct_rows


class PdfReaderTest(unittest.TestCase):
    def test_geometry_preserves_missing_units_and_joins_wrapped_price_digits(self):
        def word(x, y, text, width=10):
            return (x, y, x + width, y + 7, text, 0, 0, 0)

        words = [
            word(51, 10, "Código"), word(96, 10, "Descripción"),
            word(363, 10, "Unid.", 17), word(390, 10, "Recursos", 31),
            word(428, 10, "Cantidad", 29), word(472, 10, "Precio", 21), word(522, 10, "Parcial", 22),
            word(51, 20, "390011192", 36), word(96, 20, "GIGANTOGRAFIA"), word(180, 20, "DISEÑO"),
            word(419, 20, "-", 2), word(436, 20, "1.0000", 21),
            word(463, 20, "1,500.000", 30), word(518, 20, "1,500.00", 26),
            word(96, 29, "COMPLETO"), word(490, 29, "0", 3),
        ]
        text = reconstruct_rows(words)
        self.assertIn("GIGANTOGRAFIA DISEÑO COMPLETO __UNIDAD_AUSENTE__ - 1.0000 1,500.0000 1,500.00", text)
        result = parse_pages(["Partida: 1.1.1 AVISO Rendimiento:1 und/Día\nCosto unitario por und 1500.00\nMATERIALES 1500.00\n" + text])
        component = result["analyses"][0]["materiales"][0]
        self.assertEqual(component["unidad"], "")
        self.assertEqual(component["descripcion"], "GIGANTOGRAFIA DISEÑO COMPLETO")
        self.assertEqual(component["precio_unitario"], 1500)
        self.assertEqual([issue["kind"] for issue in result["issues"]], ["missing_unit"])

    def test_sections_percentages_and_auxiliary_are_preserved(self):
        result = parse_pages(["""
Partida: 1.10.1 SUMINISTRO Rendimiento:1 und/Día
Costo unitario por und 103.00
MANO DE OBRA 3.00
390010001 INSTALACION - EQUIPOS %mt - 3.0000 100.0000 3.00
MATERIALES 100.00
440010001 EQUIPO und - 1.0000 100.0000 100.00
CU0010012 CONCRETO Rendimiento:1 m²/Día
Costo unitario por m² 10.00
SUB-CONTRATOS 10.00
390010009 CONCRETO m² - 1.0000 10.0000 10.00
"""])
        self.assertEqual(result["issues"], [])
        main, auxiliary = result["analyses"]
        self.assertEqual(main["mano_de_obra"][0]["cantidad"], 3)
        self.assertIsNone(main["mano_de_obra"][0]["recursos"])
        self.assertEqual(auxiliary["kind"], "auxiliary")
        self.assertEqual(auxiliary["partida_code"], "CU0010012")

    def test_page_continuation_and_missing_rendimiento(self):
        result = parse_pages([
            "Partida: 1.1.1 AGUA Rendimiento:mes\nCosto unitario por mes 20.00\nMATERIALES 20.00",
            "Código Descripción Unid. Recursos Cantidad Precio Parcial\n440010001 AGUA mes - 1.0000 20.0000 20.00",
        ])
        self.assertEqual(result["issues"], [])
        self.assertIsNone(result["analyses"][0]["rendimiento"])
        self.assertEqual(result["analyses"][0]["materiales"][0]["page"], 2)

    def test_unread_resources_and_empty_pages_are_not_silently_accepted(self):
        result = parse_pages([
            "Partida: 1.1.1 AGUA Rendimiento:1 mes\nCosto unitario por mes 20.00\nMATERIALES 20.00\n440010001 AGUA mes ilegible",
            "",
        ])
        self.assertEqual(result["empty_pages"], [2])
        self.assertIn("unread_resource", [i["kind"] for i in result["issues"]])
        self.assertIn("section_total_difference", [i["kind"] for i in result["issues"]])

    def test_invalid_thousands_grouping_is_not_reinterpreted_as_a_valid_price(self):
        result = parse_pages(["Partida: 1.1.1 AGUA Rendimiento:1 mes\nCosto unitario por mes 123.00\nMATERIALES 123.00\n440010001 AGUA mes - 1.0000 1,23.00 123.00"])
        self.assertIn("unread_resource", [issue["kind"] for issue in result["issues"]])

    def test_pdf_without_recognized_analyses_is_diagnosed(self):
        result = parse_pages([""])
        self.assertEqual(result["empty_pages"], [1])
        self.assertEqual(result["analyses"], [])
        self.assertEqual(result["issues"][0]["kind"], "no_analyses")

    def test_resource_without_column_geometry_is_not_guessed(self):
        words = [(51, 20, 87, 27, "390010001", 0, 0, 0), (96, 20, 130, 27, "SERVICIO", 0, 0, 1)]
        self.assertEqual(reconstruct_rows(words), "390010001 COLUMNAS_NO_IDENTIFICADAS")

    def test_wrong_components_and_duplicate_codes_are_diagnosed(self):
        block = "Partida: 1.1.1 AGUA Rendimiento:1 mes\nCosto unitario por mes 20.00\nMATERIALES 20.00\n440010001 AGUA mes - 2.0000 20.0000 20.00"
        result = parse_pages([block, block])
        kinds = [i["kind"] for i in result["issues"]]
        self.assertIn("component_partial_difference", kinds)
        self.assertIn("duplicate_analysis", kinds)


if __name__ == "__main__":
    unittest.main()
