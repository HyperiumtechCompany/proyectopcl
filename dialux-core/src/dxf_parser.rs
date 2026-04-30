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

// ─────────────────────────────────────────────
// PUNTO DE ENTRADA
// ─────────────────────────────────────────────

pub fn parse_dxf_logic(content: &str) -> Result<DxfResult, String> {
    let mut cursor = std::io::Cursor::new(content.as_bytes());
    let drawing = Drawing::load(&mut cursor)
        .map_err(|e| format!("DXF Parse Error: {:?}", e))?;

    let mut entities: Vec<DxfEntity> = Vec::new();
    let mut bounds = Bounds::new();
    let mut layer_set: std::collections::HashSet<String> = std::collections::HashSet::new();

    let mut id_counter = 0;
    parse_entities(
        &drawing,
        drawing.entities(),
        &Transform::default(),
        &mut entities,
        &mut bounds,
        &mut layer_set,
        &mut id_counter,
    );

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
    })
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
                    );
                }
            }

            _ => {}
        }
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

fn clean_mtext(raw: &str) -> String {
    // Elimina códigos como \P (párrafo), \f (fuente), {\...}, etc.
    let mut result = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.peek() {
                Some(&'P') | Some(&'n') => { chars.next(); result.push('\n'); }
                Some(&'\\') => { chars.next(); result.push('\\'); }
                _ => { chars.next(); } // descartar código
            }
        } else if c == '{' || c == '}' {
            // saltar llaves de agrupación RTF
        } else {
            result.push(c);
        }
    }
    result.trim().to_string()
}