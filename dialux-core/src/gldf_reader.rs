/// gldf_reader.rs — Lector básico de GLDF (Global Lighting Data Format)
///
/// GLDF es un ZIP que contiene `product.xml` + assets.
/// En WASM no podemos descomprimir ZIP, por lo que este módulo
/// acepta el XML ya extraído (el frontend o Laravel extrae el ZIP).
///
/// Referencia: https://gldf.io
/// El XML sigue el esquema GLDF v1.x
///
/// En el backend Laravel, el ZIP completo se extrae con PHP ZipArchive.
/// En el frontend WASM, se espera el contenido XML del product.xml.

use serde::{Deserialize, Serialize};

// ─── Estructuras ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GldfGeometryHint {
    Round,
    Square,
    Rectangular,
    Linear,
    Unknown,
}

impl Default for GldfGeometryHint {
    fn default() -> Self {
        GldfGeometryHint::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GldfPhotometricData {
    pub total_lumens: f64,
    pub power_watts: f64,
    pub cct_k: Option<f64>,
    pub cri_ra: Option<f64>,
    pub efficiency_lm_w: f64,
    /// Referencia al archivo fotométrico interno (ies/ldt filename)
    pub photometric_file_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GldfData {
    pub is_valid: bool,

    // Producto
    pub product_name: String,
    pub manufacturer: String,
    pub article_number: String,
    pub ean_code: Option<String>,
    pub description: String,

    // Fotometría (puede haber múltiples variantes; tomamos la primera)
    pub photometric: Option<GldfPhotometricData>,

    // Geometría (pista genérica para el renderizador 3D)
    pub geometry_hint: GldfGeometryHint,

    // Dimensiones (metros)
    pub length_m: Option<f64>,
    pub width_m: Option<f64>,
    pub height_m: Option<f64>,
}

// ─── Parser XML minimalista ───────────────────────────────────────────────────
/// Parsea el contenido XML de `product.xml` de un GLDF.
/// Usa búsqueda de texto simple para no depender de un crate XML completo en WASM.
pub fn parse_gldf_xml(xml_content: &str) -> Result<GldfData, String> {
    if xml_content.is_empty() {
        return Err("GLDF XML vacío".to_string());
    }

    // Validación básica: debe contener <Root> o <GeneralDefinitions>
    if !xml_content.contains("GeneralDefinitions") && !xml_content.contains("Product") {
        return Err("XML no parece ser un archivo GLDF válido".to_string());
    }

    let product_name = extract_first_text(xml_content, "Name").unwrap_or_default();
    let manufacturer = extract_attribute(xml_content, "Manufacturer", "name")
        .or_else(|| extract_first_text(xml_content, "Manufacturer"))
        .unwrap_or_default();
    let article_number = extract_first_text(xml_content, "ArticleNumber")
        .or_else(|| extract_attribute(xml_content, "ProductSeries", "id"))
        .unwrap_or_default();
    let ean_code = extract_first_text(xml_content, "EAN");
    let description = extract_first_text(xml_content, "Description")
        .or_else(|| extract_first_text(xml_content, "Summary"))
        .unwrap_or_default();

    // Datos fotométricos
    let photometric = parse_gldf_photometry(xml_content);

    // Geometría
    let geometry_hint = detect_geometry_hint(xml_content);

    // Dimensiones de la luminaria
    let length_m = extract_dimension(xml_content, "Length");
    let width_m = extract_dimension(xml_content, "Width");
    let height_m = extract_dimension(xml_content, "Height");

    Ok(GldfData {
        is_valid: true,
        product_name,
        manufacturer,
        article_number,
        ean_code,
        description,
        photometric,
        geometry_hint,
        length_m,
        width_m,
        height_m,
    })
}

// ─── Helpers de parsing XML simple ───────────────────────────────────────────

/// Extrae el texto del primer tag con ese nombre: <Tag>texto</Tag>
fn extract_first_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);

    let start = xml.find(&open)?;
    let after_open = &xml[start..];

    // Buscar cierre del tag de apertura (puede tener atributos)
    let content_start = after_open.find('>')? + 1;
    let content = &after_open[content_start..];

    let end = content.find(&close)?;
    let text = content[..end].trim().to_string();

    if text.is_empty() { None } else { Some(text) }
}

/// Extrae el valor de un atributo: <Tag attr="valor">
fn extract_attribute(xml: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let start = xml.find(&open)?;
    let snippet = &xml[start..];
    let tag_end = snippet.find('>')?;
    let tag_content = &snippet[..tag_end];

    let attr_pattern = format!("{}=\"", attr);
    let attr_start = tag_content.find(&attr_pattern)?;
    let value_start = attr_start + attr_pattern.len();
    let value_end = tag_content[value_start..].find('"')?;
    let value = tag_content[value_start..value_start + value_end].to_string();

    if value.is_empty() { None } else { Some(value) }
}

/// Extrae dimensión en metros desde <Length unit="m">0.6</Length>
fn extract_dimension(xml: &str, dim_tag: &str) -> Option<f64> {
    let text = extract_first_text(xml, dim_tag)?;
    let value: f64 = text.parse().ok()?;

    // Verificar la unidad del atributo (mm → convertir)
    let open = format!("<{}", dim_tag);
    if let Some(start) = xml.find(&open) {
        let snippet = &xml[start..xml.find('>').unwrap_or(start + 50)];
        if snippet.contains("unit=\"mm\"") || snippet.contains("mm") {
            return Some(value / 1000.0);
        }
    }
    Some(value)
}

fn parse_gldf_photometry(xml: &str) -> Option<GldfPhotometricData> {
    // Buscar sección <Emitter> o <LightEmittingObject>
    let total_lumens = extract_first_text(xml, "Flux")
        .or_else(|| extract_first_text(xml, "TotalFlux"))
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let power_watts = extract_first_text(xml, "Wattage")
        .or_else(|| extract_first_text(xml, "Power"))
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let cct_k = extract_first_text(xml, "ColorTemperature")
        .or_else(|| extract_first_text(xml, "CCT"))
        .and_then(|s| s.parse::<f64>().ok());

    let cri_ra = extract_first_text(xml, "CRI")
        .or_else(|| extract_first_text(xml, "Ra"))
        .and_then(|s| s.parse::<f64>().ok());

    let efficiency_lm_w = if power_watts > 0.0 { total_lumens / power_watts } else { 0.0 };

    // Referencia al archivo fotométrico (IES/LDT interno)
    let photometric_file_ref = extract_attribute(xml, "PhotometryFile", "href")
        .or_else(|| extract_attribute(xml, "PhotometricFile", "href"))
        .or_else(|| extract_first_text(xml, "PhotometryFileSource"));

    if total_lumens <= 0.0 && power_watts <= 0.0 && photometric_file_ref.is_none() {
        return None;
    }

    Some(GldfPhotometricData {
        total_lumens,
        power_watts,
        cct_k,
        cri_ra,
        efficiency_lm_w,
        photometric_file_ref,
    })
}

fn detect_geometry_hint(xml: &str) -> GldfGeometryHint {
    let lower = xml.to_lowercase();

    // Buscar tipos de geometría en el XML
    if lower.contains("round") || lower.contains("circular") || lower.contains("\"circle\"") {
        GldfGeometryHint::Round
    } else if lower.contains("square") && !lower.contains("rectangular") {
        GldfGeometryHint::Square
    } else if lower.contains("rectangular") || lower.contains("linear") || lower.contains("tube") {
        GldfGeometryHint::Rectangular
    } else {
        GldfGeometryHint::Unknown
    }
}
