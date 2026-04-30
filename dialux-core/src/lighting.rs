/// Motor de cálculo lumínico
/// Implementa:
///   1. Método punto a punto (point-by-point) con ley del coseno inverso cuadrado
///   2. Método de los lúmenes (CU simplificado)
///   3. Cálculo UGR (Unified Glare Rating — EN 12464)
///   4. Isolux: grilla 2D de iluminancias lista para contornos

use std::f64::consts::PI;
use serde::{Deserialize, Serialize};
use nalgebra::{Point3, Vector3};

use crate::geometry::{Room, CalculationGrid, Point3D};
use crate::ies_parser::IesData;

/// Definición de una luminaria ubicada en la escena
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fixture {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64, // altura de montaje (metros)
    pub tilt_deg: f64,   // inclinación vertical (0 = nadir)
    pub rotation_deg: f64, // rotación horizontal
    pub quantity: u32,
    pub ies: IesData,
}

/// Resultado completo del cálculo para una escena
#[derive(Debug, Serialize, Deserialize)]
pub struct LightingResult {
    pub avg_lux: f64,
    pub min_lux: f64,
    pub max_lux: f64,
    pub uniformity: f64, // Uo = Emin/Eavg (EN 12464 ≥ 0.60 para oficinas)
    pub ugr: f64,
    /// Grilla isolux: filas=Y, cols=X, valor=lux
    pub grid_rows: usize,
    pub grid_cols: usize,
    pub grid_values: Vec<f64>, // aplanado row-major
}

/// Calcula iluminancia en un punto P debida a una sola luminaria F
/// usando la distribución IES + ley inverso cuadrado + factor coseno
fn illuminance_from_fixture(point: &Point3D, fixture: &Fixture) -> f64 {
    let fx = fixture.x;
    let fy = fixture.y;
    let fz = fixture.z;

    let dx = point.x - fx;
    let dy = point.y - fy;
    let dz = point.z - fz; // negativo: el punto está debajo de la luminaria

    let dist2 = dx * dx + dy * dy + dz * dz;
    if dist2 < 1e-6 { return 0.0; }
    let dist = dist2.sqrt();

    // Ángulo de incidencia sobre el plano de trabajo (cos del ángulo con la normal del plano)
    let cos_incident = (-dz / dist).max(0.0);
    if cos_incident <= 0.0 { return 0.0; }

    // Ángulo vertical θ desde el nadir de la luminaria
    let theta_deg = ((-dz) / dist).acos().to_degrees();

    // Ángulo horizontal φ (azimut en el plano horizontal)
    let phi_deg = dy.atan2(dx).to_degrees().rem_euclid(360.0);

    let candela = fixture.ies.candela_at(theta_deg, phi_deg);

    // E = I · cos(θ_incidencia) / d²
    candela * cos_incident / dist2
}

/// Método punto a punto: acumula contribución de todas las luminarias en la grilla
pub fn calculate_point_by_point(
    grid: &CalculationGrid,
    fixtures: &[Fixture],
) -> Vec<f64> {
    grid.points.iter().map(|pt| {
        fixtures.iter().map(|f| {
            illuminance_from_fixture(pt, f) * f.quantity as f64
        }).sum()
    }).collect()
}

/// Calcula UGR según CIE 117 simplificado
/// ugr = 8 × log10( (0.25 / Lb) × Σ(L²·ω/p²) )
pub fn calculate_ugr(
    observer: &Point3D,
    fixtures: &[Fixture],
    background_luminance: f64, // Lb en cd/m²
) -> f64 {
    let mut sum = 0.0f64;
    for f in fixtures {
        let dx = f.x - observer.x;
        let dy = f.y - observer.y;
        let dz = f.z - observer.z;
        let dist2 = dx * dx + dy * dy + dz * dz;
        if dist2 < 0.01 { continue; }
        let _dist = dist2.sqrt();

        // Ángulo sólido aproximado (asume luminaria de 0.1 m²)
        let luminaire_area = 0.1_f64;
        let omega = luminaire_area / dist2;

        // Índice de posición de Guth p (simplificado, = 1 para vista directa)
        let p = 1.0_f64;

        let luminance = f.ies.candela_at(0.0, 0.0) / luminaire_area;
        sum += (luminance * luminance) * omega / (p * p);
    }

    if sum <= 0.0 || background_luminance <= 0.0 {
        return 0.0;
    }
    8.0 * (0.25 / background_luminance * sum).log10()
}

/// Punto de entrada principal: calcula todo para una escena
pub fn run_full_calculation(
    room: &Room,
    fixtures: &[Fixture],
    grid_spacing: f64,
    wp_height: f64,
) -> LightingResult {
    let grid = CalculationGrid::from_room(room, grid_spacing, wp_height);
    let lux_values = calculate_point_by_point(&grid, fixtures);

    let n = lux_values.len();
    if n == 0 {
        return LightingResult {
            avg_lux: 0.0, min_lux: 0.0, max_lux: 0.0,
            uniformity: 0.0, ugr: 0.0,
            grid_rows: 0, grid_cols: 0, grid_values: vec![],
        };
    }

    let sum: f64 = lux_values.iter().sum();
    let avg = sum / n as f64;
    let min = lux_values.iter().cloned().fold(f64::MAX, f64::min);
    let max = lux_values.iter().cloned().fold(0.0_f64, f64::max);
    let uniformity = if avg > 0.0 { min / avg } else { 0.0 };

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

    let b_width = if max_x > min_x { max_x - min_x } else { 0.0 };
    let b_length = if max_y > min_y { max_y - min_y } else { 0.0 };

    let center_x = min_x + b_width / 2.0;
    let center_y = min_y + b_length / 2.0;

    // UGR desde el centro del recinto
    let observer = Point3D { x: center_x, y: center_y, z: 1.2 };
    let lb = avg / PI; // Lb estimado
    let ugr = calculate_ugr(&observer, fixtures, lb);

    // Dimensiones de la grilla para el mapa isolux
    let cols = ((b_width  / grid_spacing).floor() as usize).max(1);
    let rows = ((b_length / grid_spacing).floor() as usize).max(1);

    LightingResult {
        avg_lux: avg,
        min_lux: min,
        max_lux: max,
        uniformity,
        ugr,
        grid_rows: rows,
        grid_cols: cols,
        grid_values: lux_values,
    }
}
