use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: String,
    pub vertices: Vec<Point2D>,
    pub height: f64,
}

impl Room {
    pub fn from_vertices(id: &str, vertices: Vec<Point2D>, height: f64) -> Self {
        Self {
            id: id.to_string(),
            vertices,
            height,
        }
    }

    /// Calcula el área usando el algoritmo de Shoelace (Gauss)
    pub fn area(&self) -> f64 {
        let n = self.vertices.len();
        if n < 3 { return 0.0; }
        let mut area = 0.0f64;
        for i in 0..n {
            let j = (i + 1) % n;
            area += self.vertices[i].x * self.vertices[j].y;
            area -= self.vertices[j].x * self.vertices[i].y;
        }
        (area / 2.0).abs()
    }

    /// Centroide del polígono
    pub fn centroid(&self) -> Point2D {
        let n = self.vertices.len();
        if n == 0 { return Point2D { x: 0.0, y: 0.0 }; }
        let sx: f64 = self.vertices.iter().map(|v| v.x).sum();
        let sy: f64 = self.vertices.iter().map(|v| v.y).sum();
        Point2D { x: sx / n as f64, y: sy / n as f64 }
    }
}

// ─── Pared ────────────────────────────────────────────────────────────────────

/// Una pared es un segmento en planta con espesor y altura
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wall {
    pub id: String,
    /// Punto inicial en metros (planta)
    pub x1: f64,
    pub y1: f64,
    /// Punto final en metros (planta)
    pub x2: f64,
    pub y2: f64,
    /// Espesor en metros (por defecto 0.20)
    pub thickness: f64,
    /// Altura de la pared en metros (por defecto 2.80)
    pub height: f64,
}

impl Wall {
    /// Longitud de la pared en metros
    pub fn length(&self) -> f64 {
        let dx = self.x2 - self.x1;
        let dy = self.y2 - self.y1;
        (dx * dx + dy * dy).sqrt()
    }

    /// Vector unitario a lo largo de la pared
    pub fn direction(&self) -> (f64, f64) {
        let len = self.length();
        if len < 1e-9 { return (1.0, 0.0); }
        ((self.x2 - self.x1) / len, (self.y2 - self.y1) / len)
    }

    /// Ángulo de la pared respecto al eje X (radianes)
    pub fn angle_rad(&self) -> f64 {
        (self.y2 - self.y1).atan2(self.x2 - self.x1)
    }

    /// Proyecta un punto sobre la línea de la pared, devuelve el offset en metros
    /// (0.0 = inicio, length() = final). Clamped al segmento.
    pub fn project_point(&self, px: f64, py: f64) -> f64 {
        let (dx, dy) = self.direction();
        let ax = px - self.x1;
        let ay = py - self.y1;
        let t = ax * dx + ay * dy;
        t.max(0.0).min(self.length())
    }

    /// Distancia perpendicular de un punto a la línea de la pared
    pub fn perpendicular_distance(&self, px: f64, py: f64) -> f64 {
        let len = self.length();
        if len < 1e-9 { return 0.0; }
        let dx = self.x2 - self.x1;
        let dy = self.y2 - self.y1;
        ((dy * px - dx * py + self.x2 * self.y1 - self.y2 * self.x1) / len).abs()
    }

    /// Centro geométrico de la pared
    pub fn center(&self) -> Point2D {
        Point2D {
            x: (self.x1 + self.x2) / 2.0,
            y: (self.y1 + self.y2) / 2.0,
        }
    }
}

// ─── Ventana ─────────────────────────────────────────────────────────────────

/// Ventana colocada sobre una pared
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Window {
    pub id: String,
    /// ID de la pared sobre la que está colocada
    pub wall_id: String,
    /// Offset desde el punto inicial de la pared (metros)
    pub offset_along_wall: f64,
    /// Ancho de la ventana (metros)
    pub width: f64,
    /// Altura de la ventana (metros)
    pub height: f64,
    /// Altura del antepecho desde el suelo (metros, típico 0.90)
    pub sill_height: f64,
}

impl Window {
    /// Posición 2D del centro de la ventana, dado el muro
    pub fn center_2d(&self, wall: &Wall) -> Point2D {
        let (dx, dy) = wall.direction();
        let offset = self.offset_along_wall + self.width / 2.0;
        Point2D {
            x: wall.x1 + dx * offset,
            y: wall.y1 + dy * offset,
        }
    }

    /// Los cuatro puntos en planta de la ventana (en coordenadas mundo, sin espesor de pared)
    pub fn corners_2d(&self, wall: &Wall) -> [Point2D; 4] {
        let (dx, dy) = wall.direction();
        // perpendicular
        let (nx, ny) = (-dy, dx);
        let t = wall.thickness / 2.0;

        let p0x = wall.x1 + dx * self.offset_along_wall;
        let p0y = wall.y1 + dy * self.offset_along_wall;
        let p1x = wall.x1 + dx * (self.offset_along_wall + self.width);
        let p1y = wall.y1 + dy * (self.offset_along_wall + self.width);

        [
            Point2D { x: p0x - nx * t, y: p0y - ny * t },
            Point2D { x: p1x - nx * t, y: p1y - ny * t },
            Point2D { x: p1x + nx * t, y: p1y + ny * t },
            Point2D { x: p0x + nx * t, y: p0y + ny * t },
        ]
    }
}

// ─── Voladizo (Canopy) ────────────────────────────────────────────────────────

/// Voladizo o alero: placa horizontal que sobresale de un muro
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canopy {
    pub id: String,
    /// Punto de anclaje (extremo pegado al muro, en metros planta)
    pub x1: f64,
    pub y1: f64,
    /// Extremo libre del voladizo (en metros planta)
    pub x2: f64,
    pub y2: f64,
    /// Ancho del voladizo a lo largo del muro (metros)
    pub width: f64,
    /// Espesor de la losa del voladizo (metros, típico 0.15)
    pub slab_thickness: f64,
    /// Altura de montaje (base inferior del voladizo desde el suelo, en metros)
    pub height: f64,
}

impl Canopy {
    /// Profundidad del voladizo (distancia entre anclaje y extremo libre)
    pub fn depth(&self) -> f64 {
        let dx = self.x2 - self.x1;
        let dy = self.y2 - self.y1;
        (dx * dx + dy * dy).sqrt()
    }

    /// Ángulo de proyección (radianes)
    pub fn angle_rad(&self) -> f64 {
        (self.y2 - self.y1).atan2(self.x2 - self.x1)
    }

    /// Los cuatro puntos en planta del voladizo
    pub fn corners_2d(&self) -> [Point2D; 4] {
        let depth = self.depth();
        if depth < 1e-9 {
            return [
                Point2D { x: self.x1, y: self.y1 },
                Point2D { x: self.x1, y: self.y1 },
                Point2D { x: self.x2, y: self.y2 },
                Point2D { x: self.x2, y: self.y2 },
            ];
        }
        let dx = (self.x2 - self.x1) / depth;
        let dy = (self.y2 - self.y1) / depth;
        let (nx, ny) = (-dy, dx); // perpendicular
        let half = self.width / 2.0;
        [
            Point2D { x: self.x1 - nx * half, y: self.y1 - ny * half },
            Point2D { x: self.x1 + nx * half, y: self.y1 + ny * half },
            Point2D { x: self.x2 + nx * half, y: self.y2 + ny * half },
            Point2D { x: self.x2 - nx * half, y: self.y2 - ny * half },
        ]
    }
}

// ─── Grilla de cálculo ────────────────────────────────────────────────────────

fn is_point_in_polygon(pt: &Point2D, vertices: &[Point2D]) -> bool {
    let mut inside = false;
    let mut j = vertices.len() - 1;
    for i in 0..vertices.len() {
        let vi = &vertices[i];
        let vj = &vertices[j];
        if (vi.y > pt.y) != (vj.y > pt.y) &&
           (pt.x < (vj.x - vi.x) * (pt.y - vi.y) / (vj.y - vi.y) + vi.x) {
            inside = !inside;
        }
        j = i;
    }
    inside
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationGrid {
    pub spacing: f64,
    pub points: Vec<Point3D>,
}

impl CalculationGrid {
    pub fn from_room(room: &Room, spacing: f64, wp_height: f64) -> Self {
        let mut points = Vec::new();
        if room.vertices.is_empty() { return Self { spacing, points }; }
        
        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = f64::MIN;
        let mut max_y = f64::MIN;
        
        for v in &room.vertices {
            if v.x < min_x { min_x = v.x; }
            if v.x > max_x { max_x = v.x; }
            if v.y < min_y { min_y = v.y; }
            if v.y > max_y { max_y = v.y; }
        }

        let width = max_x - min_x;
        let length = max_y - min_y;

        let cols = (width / spacing).floor().max(1.0) as usize;
        let rows = (length / spacing).floor().max(1.0) as usize;
        
        let cell_w = width / (cols as f64);
        let cell_h = length / (rows as f64);

        for r in 0..rows {
            for c in 0..cols {
                let px = min_x + (c as f64 + 0.5) * cell_w;
                let py = min_y + (r as f64 + 0.5) * cell_h;
                
                if is_point_in_polygon(&Point2D { x: px, y: py }, &room.vertices) {
                    points.push(Point3D {
                        x: px,
                        y: py,
                        z: wp_height,
                    });
                }
            }
        }

        Self { spacing, points }
    }
}

// ─── Cálculo de sombras de voladizos ─────────────────────────────────────────

/// Resultado del análisis de sombra de un voladizo sobre un punto del plano de trabajo
#[derive(Debug, Serialize, Deserialize)]
pub struct CanopyShadowResult {
    /// Factor de obstrucción: 0.0 = sin sombra, 1.0 = completamente en sombra
    pub shadow_factor: f64,
    /// Lista de voladizos que proyectan sombra sobre el punto
    pub shading_canopy_ids: Vec<String>,
}

/// Verifica si un voladizo proyecta sombra sobre un punto del plano de trabajo
/// dado el ángulo solar (azimut y altitud, en grados)
pub fn canopy_shadows_point(
    canopy: &Canopy,
    point: &Point3D,
    sun_altitude_deg: f64,
    sun_azimuth_deg: f64,
) -> bool {
    if sun_altitude_deg <= 0.0 { return false; } // noche

    let sun_alt_rad = sun_altitude_deg.to_radians();
    let sun_az_rad  = sun_azimuth_deg.to_radians();

    // Vector solar (normalizado, apunta desde el cielo hacia abajo)
    let sun_dx = -sun_az_rad.sin() * sun_alt_rad.cos();
    let sun_dy = -sun_az_rad.cos() * sun_alt_rad.cos();
    let sun_dz = -sun_alt_rad.sin();

    if sun_dz.abs() < 1e-9 { return false; } // sol horizontal

    // Desde el punto hasta la altura del voladizo: t = (canopy.height - point.z) / sun_dz
    let t = (canopy.height - point.z) / sun_dz;
    if t < 0.0 { return false; } // la sombra va hacia arriba

    // Posición de la proyección en el plano del voladizo
    let proj_x = point.x + sun_dx * t;
    let proj_y = point.y + sun_dy * t;

    // ¿Cae dentro de los corners del voladizo?
    let corners = canopy.corners_2d();
    let pt2d = Point2D { x: proj_x, y: proj_y };
    is_point_in_polygon(&pt2d, &corners)
}
