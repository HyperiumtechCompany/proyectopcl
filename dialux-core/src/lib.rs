mod geometry;
mod ies_parser;
mod ldt_parser;
mod gldf_reader;
mod lighting;
mod dxf_parser;
mod building;
mod direct_illuminance;

use wasm_bindgen::prelude::*;
use serde_json;

// Activar mensajes de error útiles en panic (modo dev)
#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ─── Geometría ────────────────────────────────────────────────────────────────

/// Parsea un archivo DXF y devuelve las entidades en JSON
#[wasm_bindgen]
pub fn parse_dxf_web(content: &str) -> String {
    match dxf_parser::parse_dxf_logic(content) {
        Ok(result) => serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string()),
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

/// Crea un recinto poligonal y devuelve su JSON
#[wasm_bindgen]
pub fn create_room(id: &str, vertices_json: &str, height: f64) -> String {
    let vertices: Vec<geometry::Point2D> = match serde_json::from_str(vertices_json) {
        Ok(v) => v,
        Err(_) => return "{\"error\":\"Invalid vertices\"}".to_string(),
    };
    let room = geometry::Room::from_vertices(id, vertices, height);
    serde_json::to_string(&room).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}

/// Crea una pared entre dos puntos y devuelve su JSON
#[wasm_bindgen]
pub fn create_wall(wall_json: &str) -> String {
    let wall: geometry::Wall = match serde_json::from_str(wall_json) {
        Ok(w) => w,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };
    let len = wall.length();
    let angle = wall.angle_rad().to_degrees();
    let center = wall.center();
    let result = serde_json::json!({
        "wall": wall,
        "length": len,
        "angle_deg": angle,
        "center": center,
    });
    result.to_string()
}

/// Coloca una ventana sobre una pared
#[wasm_bindgen]
pub fn create_window(window_json: &str, wall_json: &str) -> String {
    let window: geometry::Window = match serde_json::from_str(window_json) {
        Ok(w) => w,
        Err(e) => return format!("{{\"error\":\"window: {e}\"}}"),
    };
    let wall: geometry::Wall = match serde_json::from_str(wall_json) {
        Ok(w) => w,
        Err(e) => return format!("{{\"error\":\"wall: {e}\"}}"),
    };
    let corners = window.corners_2d(&wall);
    let center = window.center_2d(&wall);
    let result = serde_json::json!({
        "window": window,
        "corners_2d": corners,
        "center_2d": center,
    });
    result.to_string()
}

/// Crea un voladizo y devuelve su JSON
#[wasm_bindgen]
pub fn create_canopy(canopy_json: &str) -> String {
    let canopy: geometry::Canopy = match serde_json::from_str(canopy_json) {
        Ok(c) => c,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };
    let corners = canopy.corners_2d();
    let depth = canopy.depth();
    let angle = canopy.angle_rad().to_degrees();
    let result = serde_json::json!({
        "canopy": canopy,
        "depth": depth,
        "angle_deg": angle,
        "corners_2d": corners,
    });
    result.to_string()
}

/// Proyecta un punto sobre una pared
#[wasm_bindgen]
pub fn project_point_on_wall(point_json: &str, wall_json: &str) -> String {
    let pt: geometry::Point2D = match serde_json::from_str(point_json) {
        Ok(p) => p,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };
    let wall: geometry::Wall = match serde_json::from_str(wall_json) {
        Ok(w) => w,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };
    let offset = wall.project_point(pt.x, pt.y);
    let perp_dist = wall.perpendicular_distance(pt.x, pt.y);
    let result = serde_json::json!({
        "offset_along_wall": offset,
        "perpendicular_distance": perp_dist,
        "wall_length": wall.length(),
    });
    result.to_string()
}

/// Genera el modelo 3D completo de la escena para Babylon.js
#[wasm_bindgen]
pub fn build_3d_scene(scene_json: &str) -> String {
    match building::build_scene_3d(scene_json) {
        Ok(result) => serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string()),
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

/// Calcula sombras de voladizos
#[wasm_bindgen]
pub fn calculate_canopy_shadows(
    canopies_json: &str,
    grid_json: &str,
    sun_altitude_deg: f64,
    sun_azimuth_deg: f64,
) -> String {
    let canopies: Vec<geometry::Canopy> = match serde_json::from_str(canopies_json) {
        Ok(c) => c,
        Err(e) => return format!("{{\"error\":\"canopies: {e}\"}}"),
    };
    let grid: geometry::CalculationGrid = match serde_json::from_str(grid_json) {
        Ok(g) => g,
        Err(e) => return format!("{{\"error\":\"grid: {e}\"}}"),
    };

    let shadow_factors: Vec<f64> = grid.points.iter().map(|pt| {
        let in_shadow = canopies.iter().any(|c| {
            geometry::canopy_shadows_point(c, pt, sun_altitude_deg, sun_azimuth_deg)
        });
        if in_shadow { 1.0 } else { 0.0 }
    }).collect();

    let total = shadow_factors.len();
    let shaded = shadow_factors.iter().filter(|&&f| f > 0.5).count();
    let shadow_ratio = if total > 0 { shaded as f64 / total as f64 } else { 0.0 };

    let result = serde_json::json!({
        "shadow_factors": shadow_factors,
        "shadow_ratio": shadow_ratio,
        "total_points": total,
        "shaded_points": shaded,
    });
    result.to_string()
}

// ─── Parsers fotométricos ─────────────────────────────────────────────────────

/// Parsea un archivo .IES completo (IESNA:LM-63)
/// Retorna JSON con IesData completo incluyendo web fotométrica
#[wasm_bindgen]
pub fn parse_ies_file(content: &str) -> String {
    match ies_parser::parse_ies(content) {
        Ok(data) => serde_json::to_string(&data).unwrap_or_default(),
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

/// Parsea un archivo .LDT completo (EULUMDAT)
/// Retorna JSON con LdtData completo incluyendo web fotométrica
#[wasm_bindgen]
pub fn parse_ldt_file(content: &str) -> String {
    match ldt_parser::parse_ldt(content) {
        Ok(data) => serde_json::to_string(&data).unwrap_or_default(),
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

/// Parsea el XML interno de un GLDF (product.xml ya extraído del ZIP)
/// El ZIP debe ser extraído por el backend Laravel o el frontend antes de llamar esto.
#[wasm_bindgen]
pub fn parse_gldf_xml(xml_content: &str) -> String {
    match gldf_reader::parse_gldf_xml(xml_content) {
        Ok(data) => serde_json::to_string(&data).unwrap_or_default(),
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

/// Obtiene el valor de candela para un ángulo dado en un producto IES parseado.
/// `ies_json` = JSON serializado de IesData
/// `theta_deg` = ángulo vertical (0° = nadir)
/// `phi_deg` = ángulo horizontal (azimut)
#[wasm_bindgen]
pub fn get_ies_candela(ies_json: &str, theta_deg: f64, phi_deg: f64) -> f64 {
    match serde_json::from_str::<ies_parser::IesData>(ies_json) {
        Ok(data) => data.candela_at(theta_deg, phi_deg),
        Err(_) => 0.0,
    }
}

/// Genera una grilla polar de candelas para visualización (diagrama polar).
/// `resolution` = número de puntos en el plano C0 (default 72 = cada 5°)
#[wasm_bindgen]
pub fn get_ies_polar_data(ies_json: &str, resolution: u32) -> String {
    let data: ies_parser::IesData = match serde_json::from_str(ies_json) {
        Ok(d) => d,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };

    let res = resolution.max(8) as usize;
    let step = 180.0 / (res - 1) as f64;

    // C0 (plano principal) y C90 (plano perpendicular)
    let c0: Vec<f64> = (0..res).map(|i| data.candela_at(i as f64 * step, 0.0)).collect();
    let c90: Vec<f64> = (0..res).map(|i| data.candela_at(i as f64 * step, 90.0)).collect();

    let result = serde_json::json!({
        "c0": c0,
        "c90": c90,
        "angles_deg": (0..res).map(|i| i as f64 * step).collect::<Vec<_>>(),
        "max_candela": data.max_candela,
        "beam_angle_50": data.beam_angle_50,
        "beam_angle_10": data.beam_angle_10,
        "total_lumens": data.total_lumens,
    });
    result.to_string()
}

/// Genera grilla polar para un LDT parseado
#[wasm_bindgen]
pub fn get_ldt_polar_data(ldt_json: &str, resolution: u32) -> String {
    let data: ldt_parser::LdtData = match serde_json::from_str(ldt_json) {
        Ok(d) => d,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };

    let res = resolution.max(8) as usize;
    let step = 180.0 / (res - 1) as f64;

    let c0: Vec<f64> = (0..res).map(|i| data.candela_at(i as f64 * step, 0.0)).collect();
    let c90: Vec<f64> = (0..res).map(|i| data.candela_at(i as f64 * step, 90.0)).collect();

    let result = serde_json::json!({
        "c0": c0,
        "c90": c90,
        "angles_deg": (0..res).map(|i| i as f64 * step).collect::<Vec<_>>(),
        "max_candela": data.max_candela,
        "beam_angle_50": data.beam_angle_50,
        "beam_angle_10": data.beam_angle_10,
        "total_lumens": data.total_lumens,
    });
    result.to_string()
}

// ─── Iluminación ──────────────────────────────────────────────────────────────

/// Ejecuta el cálculo lumínico completo para una escena
#[wasm_bindgen]
pub fn calculate_lighting(
    room_json: &str,
    fixtures_json: &str,
    grid_spacing: f64,
    wp_height: f64,
) -> String {
    let room: geometry::Room = match serde_json::from_str(room_json) {
        Ok(r) => r,
        Err(e) => return format!("{{\"error\":\"room: {e}\"}}"),
    };
    let fixtures: Vec<lighting::Fixture> = match serde_json::from_str(fixtures_json) {
        Ok(f) => f,
        Err(e) => return format!("{{\"error\":\"fixtures: {e}\"}}"),
    };

    let result = lighting::run_full_calculation(&room, &fixtures, grid_spacing, wp_height);
    serde_json::to_string(&result).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}

/// Genera la grilla de cálculo para una habitación (para preview en el editor)
#[wasm_bindgen]
pub fn generate_grid(room_json: &str, spacing: f64, wp_height: f64) -> String {
    let room: geometry::Room = match serde_json::from_str(room_json) {
        Ok(r) => r,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };
    let grid = geometry::CalculationGrid::from_room(&room, spacing, wp_height);
    serde_json::to_string(&grid).unwrap_or_default()
}

/// Kernel por lotes de la Fase 12 (plan maestro, "Rendimiento: Worker y
/// WASM"): iluminancia DIRECTA (sin componente reflejada/radiosidad, que
/// sigue calculándose en TS) para toda una malla de puntos × luminarias en
/// una sola llamada — evita cruzar la frontera JS↔WASM por cada
/// punto×luminaria, que anularía cualquier ganancia. Espejo fiel de
/// `hooks/directIlluminance.ts`/`photometricInterpolation.ts` (ver
/// `direct_illuminance.rs`); NO reutiliza `lighting.rs` (motor viejo,
/// desconectado de la app real, sin las físicas de las Fases 6-11).
/// `points_json`: `[{x,y,z,normal:{x,y,z}}, ...]`.
/// `fixtures_json`: `[{x,y,z,rotation?,lumens,efficiency,photometricWeb?}, ...]`.
/// `obstacles_json`: `[{originX,originY,angleRad,length,thickness,zMin,zMax}, ...]` (puede ser `[]`).
/// Devuelve JSON `[number, ...]` alineado con `points`, o `{"error":"..."}` si el parseo falla.
#[wasm_bindgen]
pub fn compute_direct_illuminance_grid(points_json: &str, fixtures_json: &str, obstacles_json: &str) -> String {
    let points: Vec<direct_illuminance::SurfacePointInput> = match serde_json::from_str(points_json) {
        Ok(p) => p,
        Err(e) => return format!("{{\"error\":\"points: {e}\"}}"),
    };
    let fixtures: Vec<direct_illuminance::FixtureInput> = match serde_json::from_str(fixtures_json) {
        Ok(f) => f,
        Err(e) => return format!("{{\"error\":\"fixtures: {e}\"}}"),
    };
    let obstacles: Vec<direct_illuminance::OcclusionBoxInput> = match serde_json::from_str(obstacles_json) {
        Ok(o) => o,
        Err(e) => return format!("{{\"error\":\"obstacles: {e}\"}}"),
    };

    let values = direct_illuminance::compute_direct_illuminance_grid_values(&points, &fixtures, &obstacles);
    serde_json::to_string(&values).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}
