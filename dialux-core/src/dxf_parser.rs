use dxf::Drawing;
use dxf::entities::*;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ─────────────────────────────────────────────
// ENTIDADES PARSEADAS
// ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DxfEntity {
    #[serde(rename = "line")]
    Line {
        id: String,
        x1: f64, y1: f64,
        x2: f64, y2: f64,
        layer: String,
    },

    #[serde(rename = "polyline")]
    Polyline {
        id: String,
        vertices: Vec<[f64; 2]>,
        closed: bool,
        layer: String,
    },

    #[serde(rename = "circle")]
    Circle {
        id: String,
        cx: f64, cy: f64, r: f64,
        layer: String,
    },

    #[serde(rename = "arc")]
    Arc {
        id: String,
        cx: f64, cy: f64, r: f64,
        start_angle: f64,
        end_angle: f64,
        layer: String,
    },

    #[serde(rename = "ellipse")]
    Ellipse {
        id: String,
        cx: f64, cy: f64,
        /// semieje mayor (vector desde centro)
        major_x: f64, major_y: f64,
        /// relación semieje menor / mayor
        minor_ratio: f64,
        start_param: f64,
        end_param: f64,
        layer: String,
    },

    #[serde(rename = "text")]
    Text {
        id: String,
        x: f64, y: f64,
        text: String,
        height: f64,
        rotation: f64,
        layer: String,
    },

    #[serde(rename = "point")]
    Point {
        id: String,
        x: f64, y: f64,
        layer: String,
    },

    /// Rectángulo detectado a partir de LwPolyline o Polyline cerrada con 4 vértices en ángulo recto
    #[serde(rename = "rectangle")]
    Rectangle {
        id: String,
        x: f64, y: f64,           // esquina inferior-izquierda
        width: f64,
        height: f64,
        rotation: f64,
        layer: String,
    },

    /// Polígono regular (n-gon) - detectado desde Polyline cerrada con n lados iguales
    #[serde(rename = "polygon")]
    Polygon {
        id: String,
        vertices: Vec<[f64; 2]>,
        closed: bool,
        layer: String,
    },

    /// Sombreado / Hatch
    #[serde(rename = "hatch")]
    Hatch {
        id: String,
        pattern_name: String,
        solid: bool,
        /// Límites del bounding box del hatch
        boundary_paths: Vec<Vec<[f64; 2]>>,
        layer: String,
    },

    /// Spline (curva bezier / NURBS)
    #[serde(rename = "spline")]
    Spline {
        id: String,
        control_points: Vec<[f64; 2]>,
        closed: bool,
        degree: i32,
        layer: String,
    },

    /// Sólido 2D (SOLID / 3DFACE)
    #[serde(rename = "solid")]
    Solid {
        id: String,
        vertices: Vec<[f64; 2]>,
        layer: String,
    },
}

// ─────────────────────────────────────────────
// RESULTADO
// ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DxfResult {
    pub entities: Vec<DxfEntity>,
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
    pub layers: Vec<String>,
    /// Conteo por tipo de entidad DXF encontrada pero no soportada aún
    /// (ej. HATCH, DIMENSION, LEADER) o de bloques INSERT/DIMENSION cuyo
    /// bloque referenciado no se encontró — para poder avisarle al usuario
    /// que el plano base importado perdió datos, en vez de fallar en
    /// silencio.
    #[serde(default)]
    pub skipped_entity_types: std::collections::HashMap<String, u32>,
}

// ─────────────────────────────────────────────
// TRANSFORMACIONES
// ─────────────────────────────────────────────

#[derive(Clone)]
struct Transform {
    offset_x: f64,
    offset_y: f64,
    scale_x: f64,
    scale_y: f64,
    rotation_deg: f64,
}

impl Default for Transform {
    fn default() -> Self {
        Transform { offset_x: 0.0, offset_y: 0.0, scale_x: 1.0, scale_y: 1.0, rotation_deg: 0.0 }
    }
}

impl Transform {
    fn apply(&self, px: f64, py: f64) -> (f64, f64) {
        let mut x = px * self.scale_x;
        let mut y = py * self.scale_y;
        if self.rotation_deg != 0.0 {
            let rad = self.rotation_deg.to_radians();
            let (sin, cos) = rad.sin_cos();
            let nx = x * cos - y * sin;
            let ny = x * sin + y * cos;
            x = nx;
            y = ny;
        }
        (x + self.offset_x, y + self.offset_y)
    }

    fn child(&self, insert: &Insert) -> Transform {
        let (ox, oy) = self.apply(insert.location.x, insert.location.y);
        Transform {
            offset_x: ox,
            offset_y: oy,
            scale_x: self.scale_x * insert.x_scale_factor,
            scale_y: self.scale_y * insert.y_scale_factor,
            rotation_deg: self.rotation_deg + insert.rotation,
        }
    }
}

// ─────────────────────────────────────────────
// BOUNDS
// ─────────────────────────────────────────────

struct Bounds {
    min_x: f64, min_y: f64,
    max_x: f64, max_y: f64,
}

impl Bounds {
    fn new() -> Self {
        Bounds { min_x: f64::MAX, min_y: f64::MAX, max_x: f64::MIN, max_y: f64::MIN }
    }

    fn update(&mut self, x: f64, y: f64) {
        if x < self.min_x { self.min_x = x; }
        if x > self.max_x { self.max_x = x; }
        if y < self.min_y { self.min_y = y; }
        if y > self.max_y { self.max_y = y; }
    }

    fn update_circle(&mut self, cx: f64, cy: f64, r: f64) {
        self.update(cx - r, cy - r);
        self.update(cx + r, cy + r);
    }

    fn finalize(&mut self) {
        if self.min_x == f64::MAX {
            self.min_x = 0.0; self.min_y = 0.0;
            self.max_x = 0.0; self.max_y = 0.0;
        }
    }
}

// ─────────────────────────────────────────────
// HELPERS GEOMÉTRICOS
// ─────────────────────────────────────────────

/// Detecta si una polilínea cerrada con 4 vértices es un rectángulo (ángulos ≈ 90°).
/// Devuelve (x, y, width, height, rotation_deg) en el sistema del primer borde.
fn try_detect_rectangle(pts: &[[f64; 2]]) -> Option<(f64, f64, f64, f64, f64)> {
    if pts.len() != 4 { return None; }

    let edges: Vec<[f64; 2]> = (0..4).map(|i| {
        let a = pts[i];
        let b = pts[(i + 1) % 4];
        [b[0] - a[0], b[1] - a[1]]
    }).collect();

    let lengths: Vec<f64> = edges.iter().map(|e| (e[0]*e[0] + e[1]*e[1]).sqrt()).collect();

    // Pares de lados opuestos deben ser iguales y lados adyacentes perpendiculares
    let tol = 1e-6;
    let opp_ok = (lengths[0] - lengths[2]).abs() < tol && (lengths[1] - lengths[3]).abs() < tol;
    let dot01 = edges[0][0]*edges[1][0] + edges[0][1]*edges[1][1];
    let perp_ok = dot01.abs() < tol * lengths[0].max(lengths[1]) * 10.0;

    if opp_ok && perp_ok {
        let rotation = edges[0][1].atan2(edges[0][0]).to_degrees();
        let w = lengths[0];
        let h = lengths[1];
        Some((pts[0][0], pts[0][1], w, h, rotation))
    } else {
        None
    }
}

/// Detecta si una polilínea cerrada con n vértices es un polígono regular.
fn is_regular_polygon(pts: &[[f64; 2]]) -> bool {
    if pts.len() < 3 { return false; }
    let n = pts.len();
    let cx = pts.iter().map(|p| p[0]).sum::<f64>() / n as f64;
    let cy = pts.iter().map(|p| p[1]).sum::<f64>() / n as f64;
    let radii: Vec<f64> = pts.iter().map(|p| {
        let dx = p[0] - cx;
        let dy = p[1] - cy;
        (dx*dx + dy*dy).sqrt()
    }).collect();
    let r0 = radii[0];
    let tol = r0 * 0.01;
    radii.iter().all(|&r| (r - r0).abs() < tol)
}

/// Elimina la sección HEADER completa del texto DXF antes de pasarlo al
/// lector estricto de la crate `dxf`.
///
/// Nunca leemos valores de `drawing.header` -- las unidades del plano se
/// detectan aparte, en TypeScript (`detectDxfUnitFromHeader`), con un
/// escaneo tolerante del mismo texto que no depende de esta crate. La
/// sección HEADER es opcional según el spec DXF (un lector debe usar
/// valores por defecto si no está), pero esta crate SÍ la valida
/// estrictamente: cada variable declarada trae un código de grupo esperado
/// (`spec/HeaderVariablesSpec.xml`), y si el escritor que generó el archivo
/// usa uno distinto, `Drawing::load` aborta el documento ENTERO con
/// `UnexpectedCode` -- perdiendo así todas las entidades geométricas reales
/// que vienen después en ENTITIES, aunque estén perfectamente bien
/// formadas.
///
/// Confirmado con un archivo real: `AcDbLibreDwgConverter` (mlightcad)
/// vuelca `$CELWEIGHT` con código de grupo 70 (genérico int16) en vez del
/// 370 que exige el spec (`LineWeight`), y solo por eso el plano base
/// completo (1087 entidades reales) se perdía en cada exportación. Quitar
/// la sección entera en vez de parchear variable por variable cubre
/// cualquier otra desviación de otros escritores de terceros sin tener que
/// perseguirlas una a una.
fn strip_header_section(content: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let mut start: Option<usize> = None;
    let mut end: Option<usize> = None;

    let mut i = 0;
    while i + 3 < lines.len() {
        if lines[i].trim() == "0" && lines[i + 1].trim() == "SECTION"
            && lines[i + 2].trim() == "2" && lines[i + 3].trim() == "HEADER"
        {
            start = Some(i);
            let mut j = i + 4;
            while j + 1 < lines.len() {
                if lines[j].trim() == "0" && lines[j + 1].trim() == "ENDSEC" {
                    end = Some(j + 2);
                    break;
                }
                j += 1;
            }
            break;
        }
        i += 1;
    }

    match (start, end) {
        (Some(s), Some(e)) => {
            let mut out = String::with_capacity(content.len());
            for line in &lines[..s] {
                out.push_str(line);
                out.push('\n');
            }
            for line in &lines[e..] {
                out.push_str(line);
                out.push('\n');
            }
            out
        }
        _ => content.to_string(),
    }
}

// ─────────────────────────────────────────────
// PUNTO DE ENTRADA
// ─────────────────────────────────────────────

pub fn parse_dxf_logic(content: &str) -> Result<DxfResult, String> {
    let sanitized = strip_header_section(content);

    let mut entities: Vec<DxfEntity> = Vec::new();
    let mut bounds = Bounds::new();
    let mut layer_set: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut skipped: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let mut id_counter = 0;

    let mut cursor = std::io::Cursor::new(sanitized.as_bytes());
    match Drawing::load(&mut cursor) {
        Ok(drawing) => {
            parse_entities(
                &drawing,
                drawing.entities(),
                &Transform::default(),
                &mut entities,
                &mut bounds,
                &mut layer_set,
                &mut id_counter,
                &mut skipped,
            );
        }
        Err(e) => {
            // Un solo campo entero ajeno a la geometría (handle, flag,
            // owner ref) puede desbordar el tipo que la crate espera para
            // ESE código de grupo específico y abortar el parseo del
            // documento COMPLETO -- confirmado con un archivo real
            // (`ParseIntError { kind: PosOverflow }` en un campo que ni
            // siquiera es X/Y). En vez de perder TODAS las entidades por un
            // campo que no necesitamos, se re-extrae la geometría básica
            // (LINE/LWPOLYLINE/POLYLINE/CIRCLE/ARC/TEXT/POINT) leyendo
            // directamente los códigos de grupo relevantes del texto
            // crudo, sin pasar por la validación estricta de estructuras
            // que SÍ falla con este archivo.
            skipped.insert(
                format!("MODO DE RECUPERACION: el parser estricto no pudo leer el documento ({:?}); usando extraccion basica de geometria", e),
                1,
            );
            let fallback = parse_entities_raw_fallback(
                &sanitized, &mut id_counter, &mut bounds, &mut layer_set, &mut skipped,
            );
            entities.extend(fallback);
        }
    }

    // HATCH: la crate `dxf` no lo soporta (ver comentario de
    // `parse_hatches_raw`) -- se parsea a mano en un segundo paso sobre el
    // texto crudo, independiente del resultado del parseo estricto arriba
    // (corre incluso si se usó el fallback crudo).
    let hatches = parse_hatches_raw(content, &mut id_counter, &mut bounds, &mut skipped);
    for h in &hatches {
        if let DxfEntity::Hatch { layer, .. } = h {
            layer_set.insert(layer.clone());
        }
    }
    entities.extend(hatches);

    bounds.finalize();

    let mut layers: Vec<String> = layer_set.into_iter().collect();
    layers.sort();

    Ok(DxfResult {
        entities,
        min_x: bounds.min_x,
        min_y: bounds.min_y,
        max_x: bounds.max_x,
        max_y: bounds.max_y,
        layers,
        skipped_entity_types: skipped,
    })
}

/// Nombre de la variante `EntityType` para reportar tipos no soportados
/// (ej. "RotatedDimension", "Leader") sin tener que listar cada tipo a mano
/// — usa el `Debug` derivado por la crate `dxf` y corta antes del primer
/// paréntesis, ya que el formato de una variante-tupla es `Nombre(valor)`.
fn entity_type_name(specific: &EntityType) -> String {
    let debug_str = format!("{:?}", specific);
    debug_str.split('(').next().unwrap_or("Desconocido").to_string()
}

// ─────────────────────────────────────────────
// HATCH (parseo manual de pares código/valor)
// ─────────────────────────────────────────────
//
// La crate `dxf` 0.6.1 no implementa HATCH en absoluto: ni su spec ni el
// enum `EntityType` generado lo incluyen (confirmado inspeccionando
// `spec/EntitiesSpec.xml` de la crate). Se parsea a mano leyendo los pares
// código/valor crudos del texto DXF, en un segundo paso independiente de
// `dxf::Drawing::load`.
//
// Alcance v1 (ver plan de esta sesión):
//   - Solo boundary paths tipo POLILÍNEA (bit 2 del grupo 92) -- el caso
//     común de hatches arquitectónicos (contorno de piso, área sombreada).
//     Un segmento con bulge (arco) se aplana a línea recta hacia el
//     siguiente vértice -- no se reconstruye el arco.
//   - Boundary paths tipo "edge" (compuestos por líneas/arcos/splines con
//     grupo 72 de tipo de borde) NO se soportan: su estructura de grupos es
//     mucho más compleja y variable, y leerla mal desincronizaría el resto
//     del parseo. Si UN SOLO boundary path del HATCH no es polilínea, se
//     descarta el HATCH completo (mejor no mostrarlo que mostrarlo mal).
//   - Solo HATCH a nivel raíz de la sección ENTITIES (no anidados dentro de
//     un BLOCK que luego se INSERTa) -- no hay fixtures reales para validar
//     ese caso.
// Todo HATCH que no se pueda leer de forma segura bajo este alcance se
// cuenta en `skipped` en vez de fallar en silencio.

#[derive(Clone, Copy)]
struct RawPair<'a> {
    code: i32,
    value: &'a str,
}

/// Tokeniza el texto DXF crudo en pares código/valor (2 líneas cada uno:
/// código numérico, luego valor). Pares con código no numérico no deberían
/// aparecer en un DXF válido; si aparecen, se descartan silenciosamente.
fn tokenize_code_pairs(content: &str) -> Vec<RawPair<'_>> {
    let mut lines = content.lines();
    let mut pairs = Vec::new();
    while let Some(code_line) = lines.next() {
        let Some(value_line) = lines.next() else { break; };
        if let Ok(code) = code_line.trim().parse::<i32>() {
            pairs.push(RawPair { code, value: value_line.trim_end_matches('\r') });
        }
    }
    pairs
}

/// Rango `[start, end)` de pares que corresponde al INTERIOR de la sección
/// ENTITIES de nivel raíz (sin incluir los propios marcadores SECTION/
/// ENTITIES/ENDSEC) -- no explora BLOCKS, así que un HATCH definido dentro
/// de un bloque queda fuera de este rango a propósito.
fn find_top_level_entities_range(pairs: &[RawPair]) -> Option<(usize, usize)> {
    let mut i = 0;
    while i + 1 < pairs.len() {
        if pairs[i].code == 0 && pairs[i].value == "SECTION"
            && pairs[i + 1].code == 2 && pairs[i + 1].value == "ENTITIES"
        {
            let start = i + 2;
            let mut j = start;
            while j < pairs.len() {
                if pairs[j].code == 0 && pairs[j].value == "ENDSEC" {
                    return Some((start, j));
                }
                j += 1;
            }
            return Some((start, pairs.len()));
        }
        i += 1;
    }
    None
}

/// Boundary path tipo polilínea: 92 (flag, debe traer el bit "Polyline"),
/// 72 (has-bulge), 73 (is-closed, no se usa -- el emisor TS siempre cierra
/// el contorno), 93 (num vértices), luego `num vértices` × (10, 20, [42 si
/// has-bulge]). Devuelve `None` si el flag no trae el bit polilínea (boundary
/// por línea/arco/spline) o si la estructura no calza con lo esperado --
/// eso hace que el HATCH completo se descarte en vez de arriesgar
/// desincronizar el resto del parseo.
fn parse_boundary_path(pairs: &[RawPair], start: usize) -> Option<(Vec<[f64; 2]>, usize)> {
    const POLYLINE_BIT: i32 = 2;

    let mut i = start;
    if pairs.get(i)?.code != 92 { return None; }
    let flag: i32 = pairs[i].value.trim().parse().ok()?;
    i += 1;
    if flag & POLYLINE_BIT == 0 { return None; }

    if pairs.get(i)?.code != 72 { return None; }
    let has_bulge = pairs[i].value.trim() == "1";
    i += 1;

    if pairs.get(i)?.code != 73 { return None; }
    i += 1;

    if pairs.get(i)?.code != 93 { return None; }
    let vertex_count: usize = pairs[i].value.trim().parse().ok()?;
    i += 1;

    let mut verts = Vec::with_capacity(vertex_count);
    for _ in 0..vertex_count {
        if pairs.get(i)?.code != 10 { return None; }
        let x: f64 = pairs[i].value.trim().parse().ok()?;
        i += 1;
        if pairs.get(i)?.code != 20 { return None; }
        let y: f64 = pairs[i].value.trim().parse().ok()?;
        i += 1;
        if has_bulge {
            if pairs.get(i)?.code != 42 { return None; }
            i += 1; // valor de bulge (arco) ignorado -- v1 lo aplana a recta
        }
        verts.push([x, y]);
    }

    Some((verts, i))
}

/// Parsea un único HATCH ya delimitado (desde su `0 HATCH` hasta el
/// siguiente `0 <...>`, exclusive). `None` si algún boundary path no es
/// polilínea o la estructura no calza con lo esperado.
fn parse_single_hatch(pairs: &[RawPair], id_counter: &mut usize) -> Option<DxfEntity> {
    let mut layer = "0".to_string();
    let mut pattern_name = String::new();
    let mut solid = false;
    let mut boundary_paths: Vec<Vec<[f64; 2]>> = Vec::new();

    let mut i = 0;
    while i < pairs.len() {
        match pairs[i].code {
            8 => { layer = pairs[i].value.to_string(); i += 1; }
            2 => { pattern_name = pairs[i].value.to_string(); i += 1; }
            70 => { solid = pairs[i].value.trim() == "1"; i += 1; }
            91 => {
                let path_count: usize = pairs[i].value.trim().parse().ok()?;
                i += 1;
                for _ in 0..path_count {
                    let (path, next_i) = parse_boundary_path(pairs, i)?;
                    boundary_paths.push(path);
                    i = next_i;
                }
            }
            _ => { i += 1; }
        }
    }

    if boundary_paths.is_empty() { return None; }

    *id_counter += 1;
    Some(DxfEntity::Hatch {
        id: format!("dxf_{}", id_counter),
        pattern_name,
        solid,
        boundary_paths,
        layer,
    })
}

/// Parsea todas las entidades HATCH de nivel raíz del texto DXF. Cuenta en
/// `skipped` los HATCH que no se pudieron leer de forma segura bajo el
/// alcance v1 (ver comentario de sección más arriba).
fn parse_hatches_raw(
    content: &str,
    id_counter: &mut usize,
    bounds: &mut Bounds,
    skipped: &mut std::collections::HashMap<String, u32>,
) -> Vec<DxfEntity> {
    let pairs = tokenize_code_pairs(content);
    let Some((start, end)) = find_top_level_entities_range(&pairs) else { return Vec::new(); };

    let mut out = Vec::new();
    let mut i = start;
    while i < end {
        if pairs[i].code == 0 && pairs[i].value == "HATCH" {
            let entity_start = i;
            let mut j = i + 1;
            while j < end && pairs[j].code != 0 { j += 1; }

            match parse_single_hatch(&pairs[entity_start..j], id_counter) {
                Some(entity) => {
                    if let DxfEntity::Hatch { boundary_paths, .. } = &entity {
                        for path in boundary_paths {
                            for &[x, y] in path {
                                bounds.update(x, y);
                            }
                        }
                    }
                    out.push(entity);
                }
                None => {
                    *skipped
                        .entry("HATCH (borde no soportado o estructura inesperada)".to_string())
                        .or_insert(0) += 1;
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    out
}

// ─────────────────────────────────────────────
// FALLBACK CRUDO (dxf::Drawing::load falló en TODO el documento)
// ─────────────────────────────────────────────
//
// Igual que HATCH, pero como red de seguridad general: si un solo campo
// entero ajeno a la geometría desborda el tipo que la crate `dxf` espera
// para ESE código de grupo, `Drawing::load` aborta el documento COMPLETO.
// Se re-extrae la geometría básica leyendo directamente los códigos de
// grupo que sí importan (10/20/40/50/...), ignorando cualquier campo que la
// crate valide estrictamente (handles, flags, owner refs) -- exactamente
// los campos que no hacen falta para dibujar el plano.
//
// Alcance: LINE, LWPOLYLINE, POLYLINE clásica (+VERTEX/SEQEND), CIRCLE,
// ARC, TEXT/MTEXT, POINT, ATTRIB/ATTDEF -- los tipos más comunes en un plano
// arquitectónico de base. INSERT/DIMENSION/MLINE/SPLINE/ELLIPSE no se
// resuelven aquí (INSERT necesitaría resolver BLOCKS a mano; los demás son
// poco frecuentes en un plano base) y se cuentan como saltados, igual que
// cualquier tipo desconocido.
//
// ATTRIB (texto de atributo de bloque, ej. etiquetas de equipos/ambientes)
// comparte los mismos códigos de grupo relevantes que TEXT (10/20 posición,
// 1 valor, 40 altura, 50 rotación, 8 capa) -- confirmado con un plano DWG
// real donde un solo campo ajeno a la geometría hacía abortar el parser
// estricto y el fallback crudo, al no reconocer ATTRIB, descartaba 494
// entidades de texto reales (la inmensa mayoría de lo "perdido" en ese
// archivo). ATTDEF (definición, normalmente solo dentro de un BLOCK) se
// acepta con el mismo mapeo por si aparece suelta a nivel raíz.

fn raw_value<'a>(pairs: &[RawPair<'a>], code: i32) -> Option<&'a str> {
    pairs.iter().find(|p| p.code == code).map(|p| p.value)
}

fn raw_f64(pairs: &[RawPair], code: i32) -> Option<f64> {
    raw_value(pairs, code)?.trim().parse().ok()
}

fn raw_layer(pairs: &[RawPair]) -> String {
    raw_value(pairs, 8).unwrap_or("0").trim().to_string()
}

fn bump_skip(skipped: &mut std::collections::HashMap<String, u32>, key: String) {
    *skipped.entry(key).or_insert(0) += 1;
}

fn parse_raw_line(pairs: &[RawPair], id_counter: &mut usize, bounds: &mut Bounds) -> Option<DxfEntity> {
    let (x1, y1, x2, y2) = (raw_f64(pairs, 10)?, raw_f64(pairs, 20)?, raw_f64(pairs, 11)?, raw_f64(pairs, 21)?);
    bounds.update(x1, y1);
    bounds.update(x2, y2);
    *id_counter += 1;
    Some(DxfEntity::Line { id: format!("dxf_{}", id_counter), x1, y1, x2, y2, layer: raw_layer(pairs) })
}

fn parse_raw_circle(pairs: &[RawPair], id_counter: &mut usize, bounds: &mut Bounds) -> Option<DxfEntity> {
    let (cx, cy, r) = (raw_f64(pairs, 10)?, raw_f64(pairs, 20)?, raw_f64(pairs, 40)?);
    bounds.update_circle(cx, cy, r);
    *id_counter += 1;
    Some(DxfEntity::Circle { id: format!("dxf_{}", id_counter), cx, cy, r, layer: raw_layer(pairs) })
}

fn parse_raw_arc(pairs: &[RawPair], id_counter: &mut usize, bounds: &mut Bounds) -> Option<DxfEntity> {
    let (cx, cy, r) = (raw_f64(pairs, 10)?, raw_f64(pairs, 20)?, raw_f64(pairs, 40)?);
    let start_angle = raw_f64(pairs, 50).unwrap_or(0.0);
    let end_angle = raw_f64(pairs, 51).unwrap_or(360.0);
    bounds.update_circle(cx, cy, r);
    *id_counter += 1;
    Some(DxfEntity::Arc { id: format!("dxf_{}", id_counter), cx, cy, r, start_angle, end_angle, layer: raw_layer(pairs) })
}

fn parse_raw_point(pairs: &[RawPair], id_counter: &mut usize, bounds: &mut Bounds) -> Option<DxfEntity> {
    let (x, y) = (raw_f64(pairs, 10)?, raw_f64(pairs, 20)?);
    bounds.update(x, y);
    *id_counter += 1;
    Some(DxfEntity::Point { id: format!("dxf_{}", id_counter), x, y, layer: raw_layer(pairs) })
}

fn parse_raw_text(pairs: &[RawPair], id_counter: &mut usize, bounds: &mut Bounds) -> Option<DxfEntity> {
    let (x, y) = (raw_f64(pairs, 10)?, raw_f64(pairs, 20)?);
    let text = clean_mtext(raw_value(pairs, 1).unwrap_or(""));
    let height = raw_f64(pairs, 40).unwrap_or(0.1);
    let rotation = raw_f64(pairs, 50).unwrap_or(0.0);
    bounds.update(x, y);
    *id_counter += 1;
    Some(DxfEntity::Text { id: format!("dxf_{}", id_counter), x, y, text, height, rotation, layer: raw_layer(pairs) })
}

/// LWPOLYLINE: todos los vértices (pares 10/20 en orden de aparición) viven
/// dentro del mismo bloque de pares -- a diferencia de POLYLINE clásica, que
/// usa sub-entidades VERTEX separadas (ver el manejo especial en el loop
/// principal de `parse_entities_raw_fallback`).
fn parse_raw_lwpolyline(pairs: &[RawPair], id_counter: &mut usize, out: &mut Vec<DxfEntity>, bounds: &mut Bounds) -> bool {
    let mut verts: Vec<[f64; 2]> = Vec::new();
    let mut pending_x: Option<f64> = None;
    for p in pairs {
        match p.code {
            10 => pending_x = p.value.trim().parse().ok(),
            20 => {
                if let (Some(x), Ok(y)) = (pending_x.take(), p.value.trim().parse::<f64>()) {
                    verts.push([x, y]);
                }
            }
            _ => {}
        }
    }
    if verts.is_empty() { return false; }
    let closed = raw_value(pairs, 70)
        .and_then(|v| v.trim().parse::<i32>().ok())
        .is_some_and(|flag| flag & 1 != 0);
    *id_counter += 1;
    let id = format!("dxf_{}", id_counter);
    push_polyline_or_classified(id, verts, closed, raw_layer(pairs), out, bounds);
    true
}

/// Extrae geometría básica de la sección ENTITIES de nivel raíz leyendo
/// pares código/valor crudos, para cuando `dxf::Drawing::load` falló en
/// todo el documento (ver comentario de sección arriba).
fn parse_entities_raw_fallback(
    content: &str,
    id_counter: &mut usize,
    bounds: &mut Bounds,
    layer_set: &mut std::collections::HashSet<String>,
    skipped: &mut std::collections::HashMap<String, u32>,
) -> Vec<DxfEntity> {
    let pairs = tokenize_code_pairs(content);
    let Some((start, end)) = find_top_level_entities_range(&pairs) else { return Vec::new(); };

    let mut out = Vec::new();
    let mut i = start;
    while i < end {
        if pairs[i].code != 0 { i += 1; continue; }
        let entity_type = pairs[i].value;
        let block_start = i + 1;
        let mut j = block_start;
        while j < end && pairs[j].code != 0 { j += 1; }
        let block = &pairs[block_start..j];

        match entity_type {
            "LINE" => match parse_raw_line(block, id_counter, bounds) {
                Some(e) => { layer_set.insert(raw_layer(block)); out.push(e); }
                None => bump_skip(skipped, "LINE (fallback crudo, estructura inesperada)".to_string()),
            },
            "CIRCLE" => match parse_raw_circle(block, id_counter, bounds) {
                Some(e) => { layer_set.insert(raw_layer(block)); out.push(e); }
                None => bump_skip(skipped, "CIRCLE (fallback crudo, estructura inesperada)".to_string()),
            },
            "ARC" => match parse_raw_arc(block, id_counter, bounds) {
                Some(e) => { layer_set.insert(raw_layer(block)); out.push(e); }
                None => bump_skip(skipped, "ARC (fallback crudo, estructura inesperada)".to_string()),
            },
            "POINT" => match parse_raw_point(block, id_counter, bounds) {
                Some(e) => { layer_set.insert(raw_layer(block)); out.push(e); }
                None => bump_skip(skipped, "POINT (fallback crudo, estructura inesperada)".to_string()),
            },
            "TEXT" | "MTEXT" => match parse_raw_text(block, id_counter, bounds) {
                Some(e) => { layer_set.insert(raw_layer(block)); out.push(e); }
                None => bump_skip(skipped, "TEXT (fallback crudo, estructura inesperada)".to_string()),
            },
            "ATTRIB" | "ATTDEF" => match parse_raw_text(block, id_counter, bounds) {
                Some(e) => { layer_set.insert(raw_layer(block)); out.push(e); }
                None => bump_skip(skipped, "ATTRIB (fallback crudo, estructura inesperada)".to_string()),
            },
            "LWPOLYLINE" => {
                let layer = raw_layer(block);
                if parse_raw_lwpolyline(block, id_counter, &mut out, bounds) {
                    layer_set.insert(layer);
                } else {
                    bump_skip(skipped, "LWPOLYLINE (fallback crudo, sin vértices)".to_string());
                }
            }
            "POLYLINE" => {
                // Clásica: vértices en sub-entidades VERTEX top-level
                // separadas, terminadas en SEQEND -- hay que consumirlas
                // aparte del bloque de pares de la propia POLYLINE.
                let poly_layer = raw_layer(block);
                let poly_closed = raw_value(block, 70)
                    .and_then(|v| v.trim().parse::<i32>().ok())
                    .is_some_and(|flag| flag & 1 != 0);
                let mut verts: Vec<[f64; 2]> = Vec::new();
                let mut k = j;
                while k < end && pairs[k].code == 0 && pairs[k].value == "VERTEX" {
                    let v_start = k + 1;
                    let mut m = v_start;
                    while m < end && pairs[m].code != 0 { m += 1; }
                    let vblock = &pairs[v_start..m];
                    if let (Some(x), Some(y)) = (raw_f64(vblock, 10), raw_f64(vblock, 20)) {
                        verts.push([x, y]);
                    }
                    k = m;
                }
                if k < end && pairs[k].code == 0 && pairs[k].value == "SEQEND" {
                    k += 1;
                }
                j = k;
                if verts.is_empty() {
                    bump_skip(skipped, "POLYLINE (fallback crudo, sin vértices)".to_string());
                } else {
                    *id_counter += 1;
                    let id = format!("dxf_{}", id_counter);
                    layer_set.insert(poly_layer.clone());
                    push_polyline_or_classified(id, verts, poly_closed, poly_layer, &mut out, bounds);
                }
            }
            "VERTEX" | "SEQEND" => {
                // No deberían aparecer sueltos (siempre se consumen junto a
                // su POLYLINE, arriba) -- si aparecen así, la POLYLINE que
                // los precedía ya se descartó por otro motivo; se ignoran.
            }
            other => bump_skip(skipped, format!("{other} (no soportado en fallback crudo)")),
        }
        i = j;
    }
    out
}

// ─────────────────────────────────────────────
// PARSEO RECURSIVO
// ─────────────────────────────────────────────

fn parse_entities<'a, I>(
    drawing: &'a Drawing,
    iter: I,
    transform: &Transform,
    out: &mut Vec<DxfEntity>,
    bounds: &mut Bounds,
    layers: &mut std::collections::HashSet<String>,
    id_counter: &mut usize,
    skipped: &mut std::collections::HashMap<String, u32>,
) where I: Iterator<Item = &'a Entity>,
{
    for entity in iter {
        *id_counter += 1;
        let id = format!("dxf_{}", id_counter);
        let layer = entity.common.layer.clone();
        layers.insert(layer.clone());

        match &entity.specific {

            // ── LINE ──────────────────────────────────────
            EntityType::Line(line) => {
                let (x1, y1) = transform.apply(line.p1.x, line.p1.y);
                let (x2, y2) = transform.apply(line.p2.x, line.p2.y);
                bounds.update(x1, y1);
                bounds.update(x2, y2);
                out.push(DxfEntity::Line { id, x1, y1, x2, y2, layer });
            }

            // ── LWPOLYLINE ────────────────────────────────
            EntityType::LwPolyline(poly) => {
                let raw: Vec<[f64; 2]> = poly.vertices.iter()
                    .map(|v| { let (x, y) = transform.apply(v.x, v.y); [x, y] })
                    .collect();

                push_polyline_or_classified(id, raw, poly.is_closed(), layer, out, bounds);
            }

            // ── POLYLINE (2D/3D) ──────────────────────────
            EntityType::Polyline(poly) => {
                let raw: Vec<[f64; 2]> = poly.vertices().map(|v| {
                    let (x, y) = transform.apply(v.location.x, v.location.y);
                    [x, y]
                }).collect();

                let closed = (poly.flags & 1) != 0; // BIT 0 is closed
                push_polyline_or_classified(id, raw, closed, layer, out, bounds);
            }

            // ── MLINE (línea múltiple -- el trazo estándar de AutoCAD para
            // muros de doble línea en planos arquitectónicos) ─────────────
            // v1: se aproxima como la polilínea del EJE/centerline
            // (`vertices`), sin reconstruir las N líneas paralelas de
            // espesor real. La crate expone los offsets por elemento de
            // estilo como un array plano (`parameters`) sin límites claros
            // por vértice en esta versión -- reconstruir el espesor exacto
            // es un parser aparte. Mejor mostrar el eje del muro (en la
            // posición correcta) que no mostrar el muro en absoluto, que es
            // lo que pasaba antes (MLINE caía al catch-all `_ => {}` y se
            // perdía en silencio -- el motivo más probable detrás de que un
            // usuario reportara "no veo el plano base, solo veo el dibujo"
            // al abrir el DXF exportado en AutoCAD: los muros de un plano
            // arquitectónico real son casi siempre MLINE).
            EntityType::MLine(mline) => {
                let raw: Vec<[f64; 2]> = mline.vertices.iter()
                    .map(|v| { let (x, y) = transform.apply(v.x, v.y); [x, y] })
                    .collect();
                push_polyline_or_classified(id, raw, mline.is_closed(), layer, out, bounds);
            }

            // ── CIRCLE ────────────────────────────────────
            EntityType::Circle(circle) => {
                let (cx, cy) = transform.apply(circle.center.x, circle.center.y);
                let r = circle.radius * transform.scale_x.abs();
                bounds.update_circle(cx, cy, r);
                out.push(DxfEntity::Circle { id, cx, cy, r, layer });
            }

            // ── ARC ───────────────────────────────────────
            EntityType::Arc(arc) => {
                let (cx, cy) = transform.apply(arc.center.x, arc.center.y);
                let r = arc.radius * transform.scale_x.abs();
                bounds.update_circle(cx, cy, r);
                out.push(DxfEntity::Arc {
                    id,
                    cx, cy, r,
                    start_angle: arc.start_angle + transform.rotation_deg,
                    end_angle:   arc.end_angle   + transform.rotation_deg,
                    layer,
                });
            }

            // ── ELLIPSE ───────────────────────────────────
            EntityType::Ellipse(ellipse) => {
                let (cx, cy) = transform.apply(ellipse.center.x, ellipse.center.y);
                // El semieje mayor viene como vector (major_axis)
                let (mx, my) = transform.apply(
                    ellipse.center.x + ellipse.major_axis.x,
                    ellipse.center.y + ellipse.major_axis.y,
                );
                let major_x = mx - cx;
                let major_y = my - cy;
                let major_len = (major_x*major_x + major_y*major_y).sqrt();
                let minor_len = major_len * ellipse.minor_axis_ratio;

                bounds.update(cx - major_len, cy - minor_len);
                bounds.update(cx + major_len, cy + minor_len);

                out.push(DxfEntity::Ellipse {
                    id,
                    cx, cy,
                    major_x, major_y,
                    minor_ratio: ellipse.minor_axis_ratio,
                    start_param: ellipse.start_parameter,
                    end_param:   ellipse.end_parameter,
                    layer,
                });
            }

            // ── TEXT ──────────────────────────────────────
            EntityType::Text(txt) => {
                let (x, y) = transform.apply(txt.location.x, txt.location.y);
                let height = txt.text_height * transform.scale_y.abs();
                let rotation = txt.rotation + transform.rotation_deg;
                bounds.update(x, y);
                out.push(DxfEntity::Text { id, x, y, text: txt.value.clone(), height, rotation, layer });
            }

            // ── MTEXT ─────────────────────────────────────
            EntityType::MText(mtxt) => {
                let (x, y) = transform.apply(mtxt.insertion_point.x, mtxt.insertion_point.y);
                let height = mtxt.initial_text_height * transform.scale_y.abs();
                bounds.update(x, y);
                out.push(DxfEntity::Text {
                    id,
                    x, y,
                    text: clean_mtext(&mtxt.text),
                    height,
                    rotation: transform.rotation_deg,
                    layer,
                });
            }

            // ── POINT ─────────────────────────────────────
            EntityType::ModelPoint(point) => {
                let (x, y) = transform.apply(point.location.x, point.location.y);
                bounds.update(x, y);
                out.push(DxfEntity::Point { id, x, y, layer });
            }

            // ── HATCH (SOMBREADO) ─────────────────────────
            // Hatch might be disabled if not supported in this version's EntityType
            /* 
            EntityType::Hatch(hatch) => {
                // ... logic to be fixed if needed ...
            }
            */

            // ── SPLINE ────────────────────────────────────
            EntityType::Spline(spline) => {
                let control_points: Vec<[f64; 2]> = spline.control_points.iter()
                    .map(|cp| {
                        let (x, y) = transform.apply(cp.x, cp.y);
                        bounds.update(x, y);
                        [x, y]
                    })
                    .collect();

                let closed = spline.is_closed();
                let degree = spline.degree_of_curve as i32;
                out.push(DxfEntity::Spline { id, control_points, closed, degree, layer });
            }

            // ── SOLID / TRACE (cuadrilátero relleno 2D) ───
            EntityType::Solid(solid) => {
                let corners = [
                    transform.apply(solid.first_corner.x,  solid.first_corner.y),
                    transform.apply(solid.second_corner.x, solid.second_corner.y),
                    transform.apply(solid.third_corner.x,  solid.third_corner.y),
                    transform.apply(solid.fourth_corner.x, solid.fourth_corner.y),
                ];
                let vertices: Vec<[f64; 2]> = corners.iter().map(|&(x, y)| {
                    bounds.update(x, y);
                    [x, y]
                }).collect();
                out.push(DxfEntity::Solid { id, vertices, layer });
            }

            // ── DIMENSION (5 variantes: Rotated/Radial/Diameter/Angular3Pt/Ordinate) ──
            // AutoCAD ya renderiza la cota (líneas, flechas, texto) como un
            // bloque anónimo (`block_name`, ej. "*D1") con geometría en el
            // mismo espacio de coordenadas que el resto del bloque que
            // contiene la DIMENSION -- por eso se reusa `transform` tal cual
            // (sin componer una transformación hija como con INSERT, que sí
            // tiene su propio punto de inserción/escala/rotación).
            EntityType::RotatedDimension(dim) => {
                explode_dimension_block(drawing, &dim.dimension_base.block_name, transform, out, bounds, layers, id_counter, skipped);
            }
            EntityType::RadialDimension(dim) => {
                explode_dimension_block(drawing, &dim.dimension_base.block_name, transform, out, bounds, layers, id_counter, skipped);
            }
            EntityType::DiameterDimension(dim) => {
                explode_dimension_block(drawing, &dim.dimension_base.block_name, transform, out, bounds, layers, id_counter, skipped);
            }
            EntityType::AngularThreePointDimension(dim) => {
                explode_dimension_block(drawing, &dim.dimension_base.block_name, transform, out, bounds, layers, id_counter, skipped);
            }
            EntityType::OrdinateDimension(dim) => {
                explode_dimension_block(drawing, &dim.dimension_base.block_name, transform, out, bounds, layers, id_counter, skipped);
            }

            // ── INSERT (bloque) ───────────────────────────
            EntityType::Insert(insert) => {
                if let Some(block) = drawing.blocks().find(|b| b.name == insert.name) {
                    let child_t = transform.child(insert);
                    parse_entities(
                        drawing,
                        block.entities.iter(),
                        &child_t,
                        out,
                        bounds,
                        layers,
                        id_counter,
                        skipped,
                    );
                } else {
                    *skipped.entry("INSERT (bloque no encontrado)".to_string()).or_insert(0) += 1;
                }

                // Atributos reales tecleados en ESTA instancia del bloque
                // (ej. una etiqueta de ambiente/equipo) -- viven como
                // entidades ATTRIB propias que siguen al INSERT en el
                // stream, no dentro de la definición del bloque (`block.
                // entities` arriba solo trae la geometría fija + los
                // ATTDEF-plantilla, nunca el texto real escrito). Su
                // posición ya está en el mismo espacio que el propio
                // INSERT, por eso usan `transform` (el actual), no
                // `child_t` (el de adentro del bloque).
                for attr in insert.attributes() {
                    let (x, y) = transform.apply(attr.location.x, attr.location.y);
                    let height = attr.text_height * transform.scale_y.abs();
                    let rotation = attr.rotation + transform.rotation_deg;
                    bounds.update(x, y);
                    *id_counter += 1;
                    out.push(DxfEntity::Text {
                        id: format!("dxf_{}", id_counter),
                        x, y,
                        text: attr.value.clone(),
                        height,
                        rotation,
                        layer: layer.clone(),
                    });
                }
            }

            _ => {
                *skipped.entry(entity_type_name(&entity.specific)).or_insert(0) += 1;
            }
        }
    }
}

/// Busca el bloque anónimo de una DIMENSION y explota sus entidades ya
/// renderizadas (líneas/flechas/texto) con el `transform` ACTUAL, sin
/// componer una transformación hija (ver comentario en el `match` de arriba).
fn explode_dimension_block<'a>(
    drawing: &'a Drawing,
    block_name: &str,
    transform: &Transform,
    out: &mut Vec<DxfEntity>,
    bounds: &mut Bounds,
    layers: &mut std::collections::HashSet<String>,
    id_counter: &mut usize,
    skipped: &mut std::collections::HashMap<String, u32>,
) {
    // Una DIMENSION sin bloque anónimo real generado (nunca regenerado en
    // AutoCAD, o creada programáticamente) cae al default "*MODEL_SPACE" del
    // spec DXF -- ese SÍ es un bloque real en `drawing.blocks()` (contiene
    // TODAS las entidades de nivel raíz del dibujo), así que explotarlo
    // duplicaría el dibujo completo. Se descarta como no soportado en vez de
    // arriesgar esa duplicación.
    if block_name.is_empty() || block_name.eq_ignore_ascii_case("*Model_Space") {
        *skipped.entry("DIMENSION (sin bloque de cota renderizado)".to_string()).or_insert(0) += 1;
        return;
    }
    if let Some(block) = drawing.blocks().find(|b| b.name == block_name) {
        parse_entities(drawing, block.entities.iter(), transform, out, bounds, layers, id_counter, skipped);
    } else {
        *skipped.entry("DIMENSION (bloque no encontrado)".to_string()).or_insert(0) += 1;
    }
}

// ─────────────────────────────────────────────
// CLASIFICACIÓN DE POLILÍNEAS
// ─────────────────────────────────────────────

/// Toma los puntos transformados de una polilínea y decide si es
/// Rectangle → Polygon → Polyline genérica.
fn push_polyline_or_classified(
    id: String,
    pts: Vec<[f64; 2]>,
    closed: bool,
    layer: String,
    out: &mut Vec<DxfEntity>,
    bounds: &mut Bounds,
) {
    if pts.is_empty() { return; }

    // Actualizar bounds con todos los puntos
    for &[x, y] in &pts {
        bounds.update(x, y);
    }

    // Intentar clasificar polilíneas cerradas con 4 vértices como rectángulo
    if closed && pts.len() == 4 {
        if let Some((x, y, w, h, rot)) = try_detect_rectangle(&pts) {
            out.push(DxfEntity::Rectangle {
                id, x, y, width: w, height: h, rotation: rot, layer,
            });
            return;
        }
    }

    // Polígono regular cerrado con n >= 3 lados iguales
    if closed && pts.len() >= 3 && is_regular_polygon(&pts) {
        out.push(DxfEntity::Polygon {
            id,
            vertices: pts,
            closed: true,
            layer,
        });
        return;
    }

    // Polilínea genérica
    out.push(DxfEntity::Polyline {
        id,
        vertices: pts,
        closed,
        layer,
    });
}

// ─────────────────────────────────────────────
// LIMPIEZA DE MTEXT (quitar códigos RTF de DXF)
// ─────────────────────────────────────────────

/// Códigos de formato MTEXT que llevan parámetros terminados en `;`
/// (fuente, color, altura, ancho, oblicuo, tracking, alineación, apilado).
/// La versión anterior de esta función solo descartaba la letra del código
/// (`\F` → 2 caracteres) y dejaba pasar los parámetros como texto literal
/// (`fuente|b0|i0|c0|p0;`) — exactamente el patrón corrupto
/// (`\F Tssej_ New Roman|0|0|c|0|p|0|`) que un usuario vio en un DXF
/// exportado real, porque esos parámetros son ASCII imprimible y no los
/// filtra ninguna capa posterior.
const MTEXT_PARAMETERIZED_CODES: [char; 8] = ['F', 'C', 'H', 'W', 'Q', 'T', 'A', 'S'];

fn clean_mtext(raw: &str) -> String {
    let mut result = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.peek().copied() {
                Some('P') | Some('p') => { chars.next(); result.push(' '); }
                Some('~') => { chars.next(); result.push(' '); }
                Some('\\') => { chars.next(); result.push('\\'); }
                Some('{') => { chars.next(); result.push('{'); }
                Some('}') => { chars.next(); result.push('}'); }
                Some(code) if MTEXT_PARAMETERIZED_CODES.contains(&code.to_ascii_uppercase()) => {
                    chars.next();
                    // Descartar todo hasta el `;` de cierre (inclusive), o
                    // hasta el final del string si viene truncado.
                    for next in chars.by_ref() {
                        if next == ';' { break; }
                    }
                }
                Some(_) => { chars.next(); } // código de toggle sin parámetros (\L, \O, \K...): descartar
                None => {}
            }
        } else if c == '{' || c == '}' {
            // saltar llaves de agrupación RTF sueltas (sin escapar)
        } else {
            result.push(c);
        }
    }
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod dimension_and_skip_tracking_tests {
    use super::*;
    use dxf::{Block, Point};

    /// Construye el DXF en memoria (round-trip save→load) en vez de depender
    /// de un archivo `.dxf` externo -- no existe ningún fixture físico en
    /// este repo, y la propia crate `dxf` usa este mismo patrón en sus tests
    /// generados.
    ///
    /// `header.version` se fuerza a R2010 (el default de `Drawing::new()` es
    /// R12): bajo R12 el *escritor* omite entidades que requieren una
    /// versión mayor (ej. LEADER) y el *lector* de esta crate no reconstruye
    /// bien las variantes de DIMENSION al releerlas (sin los marcadores de
    /// subclase `100 AcDbXxxDimension` que solo se emiten desde R13+, queda
    /// ambiguo qué variante concreta reconstruir). R2010 es además la
    /// versión que la propia crate usa como default en
    /// `DimensionBase::default().version` -- y, en la práctica, un DXF/DWG
    /// real exportado desde AutoCAD moderno siempre viene en R2000+, nunca
    /// en R12, así que este ajuste solo hace que la prueba refleje un
    /// archivo real.
    fn drawing_to_text(drawing: &mut Drawing) -> String {
        drawing.header.version = dxf::enums::AcadVersion::R2010;
        let mut buf: Vec<u8> = Vec::new();
        drawing.save(&mut buf).expect("drawing should save");
        String::from_utf8(buf).expect("dxf output should be utf8")
    }

    #[test]
    fn explodes_dimension_anonymous_block_into_its_line_entities() {
        let mut drawing = Drawing::new();

        let mut block = Block::default();
        block.name = "D1".to_string();
        block.entities.push(Entity::new(EntityType::Line(Line {
            p1: Point::new(1.0, 2.0, 0.0),
            p2: Point::new(3.0, 4.0, 0.0),
            ..Default::default()
        })));
        drawing.add_block(block);

        drawing.add_entity(Entity::new(EntityType::RotatedDimension(RotatedDimension {
            dimension_base: DimensionBase {
                block_name: "D1".to_string(),
                // El default de la crate deja `dimension_type: Aligned` (1)
                // sin importar la variante -- con esa inconsistencia
                // `Drawing::load()` no reconstruye la entidad al releerla.
                // Hay que fijar explícitamente el tipo que corresponde a
                // `RotatedDimension` (bit 0 del grupo 70 = 0).
                dimension_type: dxf::enums::DimensionType::RotatedHorizontalOrVertical,
                ..Default::default()
            },
            ..Default::default()
        })));

        let result = parse_dxf_logic(&drawing_to_text(&mut drawing)).expect("should parse");

        let found_line = result.entities.iter().any(|e| matches!(
            e,
            DxfEntity::Line { x1, y1, x2, y2, .. }
                if (*x1 - 1.0).abs() < 1e-6 && (*y1 - 2.0).abs() < 1e-6
                && (*x2 - 3.0).abs() < 1e-6 && (*y2 - 4.0).abs() < 1e-6
        ));
        assert!(
            found_line,
            "expected the DIMENSION's anonymous block LINE to be exploded into the output entities: {:?}",
            result.entities
        );
    }

    #[test]
    fn dimension_with_missing_block_is_counted_as_skipped_not_dropped_silently() {
        let mut drawing = Drawing::new();
        drawing.add_entity(Entity::new(EntityType::RotatedDimension(RotatedDimension {
            dimension_base: DimensionBase {
                block_name: "DOES_NOT_EXIST".to_string(),
                dimension_type: dxf::enums::DimensionType::RotatedHorizontalOrVertical,
                ..Default::default()
            },
            ..Default::default()
        })));

        let result = parse_dxf_logic(&drawing_to_text(&mut drawing)).expect("should parse");

        assert_eq!(result.entities.len(), 0);
        assert_eq!(result.skipped_entity_types.get("DIMENSION (bloque no encontrado)"), Some(&1));
    }

    #[test]
    fn dimension_with_default_model_space_block_name_is_skipped_not_duplicated() {
        let mut drawing = Drawing::new();
        // Otra entidad de nivel raíz -- si el guard fallara y "*MODEL_SPACE"
        // se tratara como un bloque real explotable, esta línea se duplicaría.
        drawing.add_entity(Entity::new(EntityType::Line(Line {
            p1: Point::new(0.0, 0.0, 0.0),
            p2: Point::new(5.0, 5.0, 0.0),
            ..Default::default()
        })));
        drawing.add_entity(Entity::new(EntityType::RotatedDimension(RotatedDimension {
            dimension_base: DimensionBase {
                dimension_type: dxf::enums::DimensionType::RotatedHorizontalOrVertical,
                ..Default::default()
            },
            ..Default::default()
        })));

        let result = parse_dxf_logic(&drawing_to_text(&mut drawing)).expect("should parse");

        let line_count = result.entities.iter().filter(|e| matches!(e, DxfEntity::Line { .. })).count();
        assert_eq!(
            line_count, 1,
            "the unrelated top-level LINE must not be duplicated by the DIMENSION default block_name guard"
        );
        assert_eq!(
            result.skipped_entity_types.get("DIMENSION (sin bloque de cota renderizado)"),
            Some(&1)
        );
    }

    #[test]
    fn genuinely_unsupported_entity_type_is_counted_by_variant_name() {
        let mut drawing = Drawing::new();
        drawing.add_entity(Entity::new(EntityType::Leader(Leader::default())));

        let result = parse_dxf_logic(&drawing_to_text(&mut drawing)).expect("should parse");

        assert_eq!(result.skipped_entity_types.get("Leader"), Some(&1));
    }
}

#[cfg(test)]
mod insert_attribute_tests {
    use super::*;
    use dxf::{Block, Point};

    /// Ver comentario junto a la copia homónima en
    /// `dimension_and_skip_tracking_tests` -- cada módulo de test mantiene
    /// la suya (mismo patrón que `mline_tests`), no hay una compartida.
    fn drawing_to_text(drawing: &mut Drawing) -> String {
        drawing.header.version = dxf::enums::AcadVersion::R2010;
        let mut buf: Vec<u8> = Vec::new();
        drawing.save(&mut buf).expect("drawing should save");
        String::from_utf8(buf).expect("dxf output should be utf8")
    }

    /// Confirmado con un plano DWG real: un INSERT con `attributes_follow`
    /// (ej. la etiqueta de un tablero eléctrico o de un ambiente, tecleada
    /// al insertar el bloque) traía cientos de ATTRIB reales que
    /// `parse_entities` nunca leía -- solo se explotaba `block.entities`
    /// (la geometría fija + los ATTDEF-plantilla del bloque), nunca el
    /// texto real tecleado en ESTA instancia. El texto tecleado vive en
    /// `insert.attributes()`, expuesto aparte por la propia crate `dxf`.
    #[test]
    fn insert_attribute_value_is_extracted_as_a_text_entity() {
        let mut drawing = Drawing::new();

        let mut block = Block::default();
        block.name = "TABLERO".to_string();
        drawing.add_block(block);

        let mut insert = Insert {
            name: "TABLERO".to_string(),
            location: Point::new(10.0, 20.0, 0.0),
            ..Default::default()
        };
        insert.add_attribute(
            &mut drawing,
            Attribute {
                location: Point::new(10.5, 20.5, 0.0),
                value: "TD-01".to_string(),
                text_height: 0.25,
                rotation: 90.0,
                ..Default::default()
            },
        );
        drawing.add_entity(Entity::new(EntityType::Insert(insert)));

        let result = parse_dxf_logic(&drawing_to_text(&mut drawing)).expect("should parse");

        let found = result.entities.iter().find_map(|e| match e {
            DxfEntity::Text { x, y, text, height, rotation, .. } => {
                Some((*x, *y, text.clone(), *height, *rotation))
            }
            _ => None,
        });
        let (x, y, text, height, rotation) =
            found.expect("expected the INSERT's attribute value to be extracted as text");
        assert_eq!(text, "TD-01");
        assert!((x - 10.5).abs() < 1e-6 && (y - 20.5).abs() < 1e-6);
        assert!((height - 0.25).abs() < 1e-6);
        assert!((rotation - 90.0).abs() < 1e-6);
    }
}

#[cfg(test)]
mod hatch_raw_tests {
    use super::*;
    use dxf::Block;

    /// La crate `dxf` no puede ESCRIBIR (ni leer) HATCH -- por eso, a
    /// diferencia de los tests de DIMENSION, acá no se usa el builder
    /// `Drawing`: se toma el esqueleto DXF válido que la crate sí sabe
    /// producir (`Drawing::new().save(...)`) y se le inyecta a mano el texto
    /// crudo de un HATCH dentro de la sección ENTITIES, antes de pasarlo por
    /// `parse_dxf_logic` (que internamente igual llama a `Drawing::load`
    /// para todo lo demás, y por separado escanea el texto crudo buscando
    /// HATCH).
    fn drawing_skeleton() -> String {
        let mut drawing = Drawing::new();
        drawing.header.version = dxf::enums::AcadVersion::R2010;
        let mut buf: Vec<u8> = Vec::new();
        drawing.save(&mut buf).expect("drawing should save");
        String::from_utf8(buf).expect("dxf output should be utf8")
    }

    fn pairs_to_text(pairs: &[RawPair]) -> String {
        let mut s = String::new();
        for p in pairs {
            s.push_str(&p.code.to_string());
            s.push('\n');
            s.push_str(p.value);
            s.push('\n');
        }
        s
    }

    /// Inserta los pares código/valor de `entity_text` dentro de la sección
    /// ENTITIES de nivel raíz del esqueleto, justo antes del "0 ENDSEC" que
    /// la cierra -- trabajando a nivel de pares ya tokenizados (no de texto
    /// crudo con offsets de bytes), porque el escritor de la crate `dxf`
    /// rellena los códigos de grupo con espacios a ancho fijo (ej.
    /// "  2\nENTITIES", no "2\nENTITIES" tal cual) y una búsqueda de texto
    /// literal se rompe con ese padding. Reserializa TODO el documento sin
    /// padding -- es cosmético, no semántico: cualquier lector DXF hace
    /// `trim()` del código de grupo antes de interpretarlo.
    fn inject_into_entities_section<'a>(skeleton: &'a str, entity_text: &'a str) -> String {
        let mut pairs = tokenize_code_pairs(skeleton);
        let entity_pairs = tokenize_code_pairs(entity_text);

        let entities_idx = pairs.iter().position(|p| p.code == 2 && p.value == "ENTITIES")
            .expect("skeleton must have an ENTITIES section");
        let endsec_idx = pairs[entities_idx + 1..].iter().position(|p| p.code == 0 && p.value == "ENDSEC")
            .map(|i| i + entities_idx + 1)
            .expect("ENTITIES section must be closed");

        pairs.splice(endsec_idx..endsec_idx, entity_pairs);
        pairs_to_text(&pairs)
    }

    #[test]
    fn parses_solid_hatch_with_single_closed_polyline_boundary() {
        let skeleton = drawing_skeleton();
        let hatch = "0\nHATCH\n8\nSOMBREADO\n2\nSOLID\n70\n1\n91\n1\n92\n3\n72\n0\n73\n1\n93\n4\n\
10\n0.0\n20\n0.0\n10\n5.0\n20\n0.0\n10\n5.0\n20\n3.0\n10\n0.0\n20\n3.0\n";
        let text = inject_into_entities_section(&skeleton, hatch);

        let result = parse_dxf_logic(&text).expect("should parse");

        let found = result.entities.iter().find_map(|e| match e {
            DxfEntity::Hatch { pattern_name, solid, boundary_paths, layer, .. } => {
                Some((pattern_name.clone(), *solid, boundary_paths.clone(), layer.clone()))
            }
            _ => None,
        });
        let (pattern_name, solid, boundary_paths, layer) = found.expect("expected one hatch entity in the output");

        assert_eq!(pattern_name, "SOLID");
        assert!(solid);
        assert_eq!(layer, "SOMBREADO");
        assert_eq!(boundary_paths.len(), 1);
        assert_eq!(
            boundary_paths[0],
            vec![[0.0, 0.0], [5.0, 0.0], [5.0, 3.0], [0.0, 3.0]]
        );
    }

    #[test]
    fn ignores_bulge_values_but_keeps_vertices_in_sync() {
        let skeleton = drawing_skeleton();
        // has-bulge=1 (grupo 72): cada vértice trae un 42 extra -- debe
        // saltarse sin desincronizar el conteo de vértices.
        let hatch = "0\nHATCH\n8\n0\n2\nANSI31\n70\n0\n91\n1\n92\n3\n72\n1\n73\n1\n93\n3\n\
10\n0.0\n20\n0.0\n42\n0.5\n10\n2.0\n20\n0.0\n42\n0.0\n10\n1.0\n20\n2.0\n42\n-0.5\n";
        let text = inject_into_entities_section(&skeleton, hatch);

        let result = parse_dxf_logic(&text).expect("should parse");

        let boundary_paths = result.entities.iter().find_map(|e| match e {
            DxfEntity::Hatch { boundary_paths, .. } => Some(boundary_paths.clone()),
            _ => None,
        }).expect("expected one hatch entity in the output");

        assert_eq!(boundary_paths.len(), 1);
        assert_eq!(boundary_paths[0].len(), 3);
        assert_eq!(boundary_paths[0][1], [2.0, 0.0]);
    }

    #[test]
    fn non_polyline_boundary_is_skipped_not_misread() {
        let skeleton = drawing_skeleton();
        // Boundary tipo "edge" (sin el bit Polyline en el grupo 92): no se
        // soporta en v1 -- el HATCH completo debe descartarse y contarse,
        // sin intentar leer la estructura de bordes (línea/arco/spline).
        let hatch = "0\nHATCH\n8\n0\n2\nANSI31\n70\n0\n91\n1\n92\n1\n93\n1\n72\n1\n10\n0.0\n20\n0.0\n11\n5.0\n21\n0.0\n";
        let text = inject_into_entities_section(&skeleton, hatch);

        let result = parse_dxf_logic(&text).expect("should parse");

        let hatch_count = result.entities.iter().filter(|e| matches!(e, DxfEntity::Hatch { .. })).count();
        assert_eq!(hatch_count, 0);
        assert_eq!(
            result.skipped_entity_types.get("HATCH (borde no soportado o estructura inesperada)"),
            Some(&1)
        );
    }

    #[test]
    fn hatch_nested_inside_a_block_is_not_extracted_v1_scope() {
        let mut drawing = Drawing::new();
        drawing.header.version = dxf::enums::AcadVersion::R2010;
        let mut block = Block::default();
        block.name = "CONTAINS_HATCH".to_string();
        drawing.add_block(block);
        let mut buf: Vec<u8> = Vec::new();
        drawing.save(&mut buf).expect("drawing should save");
        let skeleton = String::from_utf8(buf).expect("dxf output should be utf8");

        // Inyectar el HATCH dentro del BLOCK (no en ENTITIES de nivel raíz).
        // El nombre "CONTAINS_HATCH" aparece dos veces en el skeleton (la
        // tabla BLOCK_RECORD y la definición real en la sección BLOCKS) --
        // la definición real es la ÚLTIMA ocurrencia, seguida de ENDBLK.
        let pairs = tokenize_code_pairs(&skeleton);
        let block_name_idx = pairs.iter().rposition(|p| p.code == 2 && p.value == "CONTAINS_HATCH")
            .expect("block should exist in skeleton");
        let endblk_idx = pairs[block_name_idx + 1..].iter().position(|p| p.code == 0 && p.value == "ENDBLK")
            .map(|i| i + block_name_idx + 1)
            .expect("block must be closed");

        let hatch = "0\nHATCH\n8\n0\n2\nSOLID\n70\n1\n91\n1\n92\n3\n72\n0\n73\n1\n93\n3\n\
10\n0.0\n20\n0.0\n10\n1.0\n20\n0.0\n10\n0.0\n20\n1.0\n";
        let entity_pairs = tokenize_code_pairs(hatch);

        let mut pairs = pairs;
        pairs.splice(endblk_idx..endblk_idx, entity_pairs);
        let text = pairs_to_text(&pairs);

        let result = parse_dxf_logic(&text).expect("should parse");

        let hatch_count = result.entities.iter().filter(|e| matches!(e, DxfEntity::Hatch { .. })).count();
        assert_eq!(
            hatch_count, 0,
            "v1 scope: HATCH inside a BLOCK definition must not be extracted (only top-level ENTITIES)"
        );
    }
}

#[cfg(test)]
mod mline_tests {
    use super::*;

    /// La crate `dxf` tiene un bug real en su ESCRITOR de MLINE: el generador
    /// (`EntitiesSpec.xml`) declara el campo `vertices` en el código de grupo
    /// 11 (coherente con el LECTOR, que sí junta `__vertices_x/y/z` código
    /// 11/21/31 en `vertices` vía un hook `post_parse` hecho a mano en
    /// `entity.rs`), pero el `<WriteOrder>` generado escribe cada vértice en
    /// el código 10 -- el mismo código que `start_point`. Al hacer
    /// round-trip save→load con el builder `Drawing` (como sí funciona para
    /// DIMENSION/HATCH/Leader en los otros módulos de test), cada vértice
    /// pisa a `start_point` y `vertices` queda vacío -- confirmado con un
    /// dump manual del texto y del documento releído. Por eso este módulo
    /// inyecta el texto DXF a mano con el código 11 correcto (el que
    /// realmente emite AutoCAD/mlightcad en un archivo real), en vez de usar
    /// `drawing.save()` para el MLINE.
    fn drawing_skeleton() -> String {
        let mut drawing = Drawing::new();
        drawing.header.version = dxf::enums::AcadVersion::R2010;
        let mut buf: Vec<u8> = Vec::new();
        drawing.save(&mut buf).expect("drawing should save");
        String::from_utf8(buf).expect("dxf output should be utf8")
    }

    fn pairs_to_text(pairs: &[RawPair]) -> String {
        let mut s = String::new();
        for p in pairs {
            s.push_str(&p.code.to_string());
            s.push('\n');
            s.push_str(p.value);
            s.push('\n');
        }
        s
    }

    fn inject_into_entities_section<'a>(skeleton: &'a str, entity_text: &'a str) -> String {
        let mut pairs = tokenize_code_pairs(skeleton);
        let entity_pairs = tokenize_code_pairs(entity_text);

        let entities_idx = pairs.iter().position(|p| p.code == 2 && p.value == "ENTITIES")
            .expect("skeleton must have an ENTITIES section");
        let endsec_idx = pairs[entities_idx + 1..].iter().position(|p| p.code == 0 && p.value == "ENDSEC")
            .map(|i| i + entities_idx + 1)
            .expect("ENTITIES section must be closed");

        pairs.splice(endsec_idx..endsec_idx, entity_pairs);
        pairs_to_text(&pairs)
    }

    #[test]
    fn mline_wall_is_approximated_as_its_centerline_polyline() {
        // v1: MLINE (el trazo estándar de AutoCAD para muros de doble línea)
        // se aproxima como el eje/centerline -- ver comentario junto al
        // `match` en `parse_entities`. Antes caía al catch-all `_ => {}` y
        // el muro completo desaparecía del plano base exportado.
        let skeleton = drawing_skeleton();
        let mline = "0\nMLINE\n100\nAcDbMline\n2\nSTANDARD\n40\n1.0\n70\n0\n71\n0\n72\n3\n73\n0\n\
10\n0.0\n20\n0.0\n30\n0.0\n\
11\n0.0\n21\n0.0\n31\n0.0\n\
11\n5.0\n21\n0.0\n31\n0.0\n\
11\n5.0\n21\n3.0\n31\n0.0\n";
        let text = inject_into_entities_section(&skeleton, mline);

        let result = parse_dxf_logic(&text).expect("should parse");

        let found = result.entities.iter().find_map(|e| match e {
            DxfEntity::Polyline { vertices, closed, .. } => Some((vertices.clone(), *closed)),
            _ => None,
        });
        let (vertices, closed) = found.expect("expected the MLine centerline to be extracted as a polyline");
        assert_eq!(vertices, vec![[0.0, 0.0], [5.0, 0.0], [5.0, 3.0]]);
        assert!(!closed);
    }

    #[test]
    fn closed_mline_keeps_its_closed_flag() {
        // Triángulo escaleno (no regular, no rectángulo) para que caiga a la
        // clasificación genérica `Polyline` y se pueda comprobar `closed`
        // directamente -- un cuadrilátero con ángulos rectos caería a
        // `Rectangle` en cambio (que no expone un campo `closed` propio).
        let skeleton = drawing_skeleton();
        let mline = "0\nMLINE\n100\nAcDbMline\n2\nSTANDARD\n40\n1.0\n70\n0\n71\n2\n72\n3\n73\n0\n\
10\n0.0\n20\n0.0\n30\n0.0\n\
11\n0.0\n21\n0.0\n31\n0.0\n\
11\n4.0\n21\n0.0\n31\n0.0\n\
11\n0.0\n21\n3.0\n31\n0.0\n";
        let text = inject_into_entities_section(&skeleton, mline);

        let result = parse_dxf_logic(&text).expect("should parse");

        let closed = result.entities.iter().find_map(|e| match e {
            DxfEntity::Polyline { closed, .. } => Some(*closed),
            _ => None,
        });
        assert_eq!(closed, Some(true), "entities: {:?}", result.entities);
    }
}

#[cfg(test)]
mod clean_mtext_tests {
    use super::*;

    #[test]
    fn strips_font_change_code_with_parameters_up_to_semicolon() {
        assert_eq!(clean_mtext(r"\FArial|b0|i0|c0|p34;N.P.T.= +0.15"), "N.P.T.= +0.15");
    }

    #[test]
    fn strips_paragraph_break_and_font_code_together() {
        // Patrón real reportado por un usuario en un DXF exportado.
        let raw = r"\FArial|b0|i0|c0|p34;\PN.P.T.= +0.15\PN.F.P.= +0.10";
        assert_eq!(clean_mtext(raw), "N.P.T.= +0.15 N.F.P.= +0.10");
    }

    #[test]
    fn keeps_plain_text_without_control_codes_untouched() {
        assert_eq!(clean_mtext("Recinto"), "Recinto");
    }

    #[test]
    fn unescapes_literal_backslash_and_braces() {
        assert_eq!(clean_mtext(r"A\\B\{C\}D"), "A\\B{C}D");
    }

    #[test]
    fn drops_grouping_braces_but_keeps_inner_text() {
        assert_eq!(clean_mtext("{\\C1;rojo}"), "rojo");
    }

    #[test]
    fn does_not_leak_unterminated_parameterized_code() {
        // Código de fuente truncado (sin `;` de cierre) — no debe dejar
        // pasar los parámetros como texto.
        assert_eq!(clean_mtext(r"\FArial|b0|i0"), "");
    }
}

#[cfg(test)]
mod header_section_tests {
    use super::*;

    /// Reproduce el bug real encontrado en un archivo del usuario: el
    /// escritor `dxfOut()` de mlightcad (`AcDbLibreDwgConverter`) vuelca
    /// `$CELWEIGHT` con código de grupo 70 en vez del 370 que exige
    /// `spec/HeaderVariablesSpec.xml` de esta crate. Sin `strip_header_section`,
    /// `Drawing::load` abortaba el documento COMPLETO con
    /// `UnexpectedCode(70, _)` y las 1087 entidades reales del plano se
    /// perdían -- el archivo exportado nunca traía el plano base.
    fn dxf_with_malformed_celweight_and_one_line() -> String {
        "0\nSECTION\n2\nHEADER\n9\n$CELWEIGHT\n70\n0\n0\nENDSEC\n\
0\nSECTION\n2\nENTITIES\n\
0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n11\n5.0\n21\n5.0\n31\n0.0\n\
0\nENDSEC\n0\nEOF\n".to_string()
    }

    #[test]
    fn malformed_header_variable_alone_is_rejected_by_the_strict_reader() {
        // Confirma la premisa del bug: sin pasar por `strip_header_section`,
        // la crate sí rechaza este header -- si esto empezara a pasar,
        // el resto de este módulo estaría probando un problema que ya no
        // existe.
        let text = dxf_with_malformed_celweight_and_one_line();
        let mut cursor = std::io::Cursor::new(text.as_bytes());
        assert!(Drawing::load(&mut cursor).is_err());
    }

    #[test]
    fn parse_dxf_logic_recovers_real_entities_despite_malformed_header() {
        let text = dxf_with_malformed_celweight_and_one_line();
        let result = parse_dxf_logic(&text).expect("should parse despite malformed header");

        let found_line = result.entities.iter().any(|e| matches!(e, DxfEntity::Line { .. }));
        assert!(found_line, "entities: {:?}", result.entities);
    }

    #[test]
    fn strip_header_section_removes_only_the_header_span() {
        let text = dxf_with_malformed_celweight_and_one_line();
        let stripped = strip_header_section(&text);

        assert!(!stripped.contains("$CELWEIGHT"));
        assert!(!stripped.contains("HEADER"));
        assert!(stripped.contains("ENTITIES"));
        assert!(stripped.contains("LINE"));
    }

    #[test]
    fn leaves_text_untouched_when_there_is_no_header_section() {
        let text = "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n11\n1.0\n21\n1.0\n31\n0.0\n0\nENDSEC\n0\nEOF\n";
        let stripped = strip_header_section(text);
        assert!(stripped.contains("LINE"));
        assert!(stripped.contains("ENTITIES"));
    }
}

#[cfg(test)]
mod raw_fallback_tests {
    use super::*;

    /// Reproduce el segundo bug real encontrado en un archivo distinto del
    /// mismo usuario: un LINE con `color_24_bit` (código de grupo 420, tipo
    /// `i32` en la crate) escrito con un valor que desborda i32::MAX --
    /// `Drawing::load` aborta el documento COMPLETO con
    /// `ParseIntError { kind: PosOverflow }` por ese único campo, que ni
    /// siquiera es geometría. `parse_dxf_logic` debe recuperar el LINE de
    /// todos modos vía el fallback crudo.
    fn dxf_with_overflowing_color_and_one_line() -> String {
        "0\nSECTION\n2\nENTITIES\n\
0\nLINE\n8\nMUROS\n420\n4294967295\n10\n0.0\n20\n0.0\n30\n0.0\n11\n5.0\n21\n0.0\n31\n0.0\n\
0\nENDSEC\n0\nEOF\n".to_string()
    }

    #[test]
    fn malformed_color_field_alone_is_rejected_by_the_strict_reader() {
        let text = dxf_with_overflowing_color_and_one_line();
        let mut cursor = std::io::Cursor::new(text.as_bytes());
        assert!(Drawing::load(&mut cursor).is_err());
    }

    #[test]
    fn parse_dxf_logic_recovers_the_line_via_raw_fallback() {
        let text = dxf_with_overflowing_color_and_one_line();
        let result = parse_dxf_logic(&text).expect("el fallback crudo debe evitar el error total");

        let found = result.entities.iter().find_map(|e| match e {
            DxfEntity::Line { x1, y1, x2, y2, layer, .. } => Some((*x1, *y1, *x2, *y2, layer.clone())),
            _ => None,
        });
        let (x1, y1, x2, y2, layer) = found.expect("se esperaba una LINE recuperada por el fallback");
        assert_eq!((x1, y1, x2, y2), (0.0, 0.0, 5.0, 0.0));
        assert_eq!(layer, "MUROS");
        assert!(result.skipped_entity_types.keys().any(|k| k.starts_with("MODO DE RECUPERACION")));
    }

    #[test]
    fn raw_fallback_recovers_circle_arc_text_and_lwpolyline() {
        let text = "0\nSECTION\n2\nENTITIES\n\
0\nLINE\n8\nMUROS\n420\n4294967295\n10\n0.0\n20\n0.0\n30\n0.0\n11\n5.0\n21\n0.0\n31\n0.0\n\
0\nCIRCLE\n8\n0\n10\n1.0\n20\n1.0\n30\n0.0\n40\n0.5\n\
0\nARC\n8\n0\n10\n2.0\n20\n2.0\n30\n0.0\n40\n1.0\n50\n0.0\n51\n90.0\n\
0\nTEXT\n8\nTEXTO\n10\n3.0\n20\n3.0\n30\n0.0\n40\n0.2\n1\nHola\n\
0\nLWPOLYLINE\n8\n0\n90\n3\n70\n0\n10\n0.0\n20\n0.0\n10\n2.0\n20\n0.0\n10\n1.0\n20\n2.0\n\
0\nENDSEC\n0\nEOF\n".to_string();

        let result = parse_dxf_logic(&text).expect("el fallback crudo debe evitar el error total");

        assert!(result.entities.iter().any(|e| matches!(e, DxfEntity::Line { .. })));
        assert!(result.entities.iter().any(|e| matches!(e, DxfEntity::Circle { cx, cy, r, .. } if (*cx, *cy, *r) == (1.0, 1.0, 0.5))));
        assert!(result.entities.iter().any(|e| matches!(e, DxfEntity::Arc { .. })));
        assert!(result.entities.iter().any(|e| matches!(e, DxfEntity::Text { text, .. } if text == "Hola")));
        assert!(result.entities.iter().any(|e| matches!(e, DxfEntity::Polygon { .. } | DxfEntity::Polyline { .. })));
    }

    #[test]
    fn raw_fallback_recovers_classic_polyline_with_vertex_seqend() {
        let text = "0\nSECTION\n2\nENTITIES\n\
0\nLINE\n8\n0\n420\n4294967295\n10\n0.0\n20\n0.0\n30\n0.0\n11\n1.0\n21\n0.0\n31\n0.0\n\
0\nPOLYLINE\n8\nMUROS\n70\n0\n\
0\nVERTEX\n8\nMUROS\n10\n0.0\n20\n0.0\n30\n0.0\n\
0\nVERTEX\n8\nMUROS\n10\n3.0\n20\n0.0\n30\n0.0\n\
0\nVERTEX\n8\nMUROS\n10\n3.0\n20\n2.0\n30\n0.0\n\
0\nSEQEND\n8\nMUROS\n\
0\nENDSEC\n0\nEOF\n".to_string();

        let result = parse_dxf_logic(&text).expect("el fallback crudo debe evitar el error total");

        let poly_vertex_count = result.entities.iter().find_map(|e| match e {
            DxfEntity::Polyline { vertices, layer, .. } if layer == "MUROS" => Some(vertices.len()),
            DxfEntity::Polygon { vertices, layer, .. } if layer == "MUROS" => Some(vertices.len()),
            _ => None,
        });
        assert_eq!(poly_vertex_count, Some(3), "entities: {:?}", result.entities);
    }

    /// Mismo archivo real que dio origen a este módulo: cuando el parser
    /// estricto aborta el documento entero, el fallback crudo previo solo
    /// reconocía LINE/CIRCLE/ARC/TEXT/POINT/LWPOLYLINE/POLYLINE -- un ATTRIB
    /// (texto de atributo de INSERT, ej. la etiqueta de un ambiente) caía en
    /// el catch-all "no soportado en fallback crudo" y desaparecía. En ese
    /// archivo real esto representaba 494 de las entidades perdidas -- la
    /// inmensa mayoría de lo reportado como "faltante".
    #[test]
    fn raw_fallback_recovers_attrib_as_text() {
        let text = "0\nSECTION\n2\nENTITIES\n\
0\nLINE\n8\n0\n420\n4294967295\n10\n0.0\n20\n0.0\n30\n0.0\n11\n1.0\n21\n0.0\n31\n0.0\n\
0\nATTRIB\n8\nTEXTO\n10\n3.0\n20\n3.0\n30\n0.0\n40\n0.2\n50\n0.0\n1\nTD-01\n\
0\nENDSEC\n0\nEOF\n".to_string();

        let result = parse_dxf_logic(&text).expect("el fallback crudo debe evitar el error total");

        let found = result.entities.iter().find_map(|e| match e {
            DxfEntity::Text { x, y, text, layer, .. } => Some((*x, *y, text.clone(), layer.clone())),
            _ => None,
        });
        let (x, y, value, layer) = found.expect("se esperaba un ATTRIB recuperado como texto por el fallback");
        assert_eq!((x, y), (3.0, 3.0));
        assert_eq!(value, "TD-01");
        assert_eq!(layer, "TEXTO");
    }
}

