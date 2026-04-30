/// building.rs — Construye la descripción de meshes 3D para Babylon.js
/// a partir de la escena (rooms, walls, windows, canopies, fixtures).
///
/// Retorna un JSON con listas de meshes que el motor TypeScript/Babylon.js
/// puede construir directamente sin lógica geométrica pesada en el cliente.

use serde::{Deserialize, Serialize};
use crate::geometry::{Point2D, Wall, Window, Canopy};

// ─── Entrada: snapshot del store TypeScript ────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SceneInput {
    pub rooms: Vec<RoomInput>,
    pub walls: Vec<WallInput>,
    pub windows: Vec<WindowInput>,
    pub canopies: Vec<CanopyInput>,
    pub fixtures: Vec<FixtureInput>,
}

#[derive(Debug, Deserialize)]
pub struct RoomInput {
    pub id: String,
    pub name: String,
    pub vertices: Vec<Point2D>,
    pub height: f64,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct WallInput {
    pub id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub thickness: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
pub struct WindowInput {
    pub id: String,
    pub wall_id: String,
    pub offset_along_wall: f64,
    pub width: f64,
    pub height: f64,
    pub sill_height: f64,
}

#[derive(Debug, Deserialize)]
pub struct CanopyInput {
    pub id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub width: f64,
    pub slab_thickness: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
pub struct FixtureInput {
    pub id: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub lumens: f64,
}

// ─── Salida: descripción de meshes para Babylon.js ────────────────────────────

#[derive(Debug, Serialize)]
pub struct Scene3DOutput {
    pub floors: Vec<FloorMesh>,
    pub wall_segments: Vec<WallMesh>,
    pub window_frames: Vec<WindowMesh>,
    pub canopy_slabs: Vec<CanopyMesh>,
    pub light_points: Vec<LightMesh>,
}

/// Suelo extruido de un recinto (polígono plano)
#[derive(Debug, Serialize)]
pub struct FloorMesh {
    pub id: String,
    pub name: String,
    pub vertices: Vec<[f64; 2]>,   // polígono en XZ (Babylon usa Y=up)
    pub elevation_y: f64,           // siempre 0 (planta baja)
    pub ceiling_y: f64,             // = height
    pub color_hex: String,
}

/// Segmento de pared como caja orientada
#[derive(Debug, Serialize)]
pub struct WallMesh {
    pub id: String,
    /// Centro del muro en XZ (Babylon Y=up)
    pub center_x: f64,
    pub center_y: f64,  // altura media = height/2
    pub center_z: f64,
    /// Dimensiones
    pub length: f64,
    pub height: f64,
    pub thickness: f64,
    /// Rotación en radianes alrededor del eje Y (Babylon Y=up)
    pub rotation_y: f64,
    /// Tramos con o sin ventana: sub-segmentos
    pub segments: Vec<WallSegment>,
}

#[derive(Debug, Serialize)]
pub struct WallSegment {
    /// offset desde el inicio del muro (metros)
    pub offset_start: f64,
    pub offset_end: f64,
    pub has_window: bool,
    pub window_sill: f64,
    pub window_top: f64,
}

/// Marco y hueco de ventana
#[derive(Debug, Serialize)]
pub struct WindowMesh {
    pub id: String,
    pub wall_id: String,
    pub offset_along_wall: f64,
    pub width: f64,
    pub height: f64,
    pub sill_height: f64,
    /// Posición en mundo (para montar el vidrio)
    pub world_x: f64,
    pub world_y: f64,  // centro vertical = sill + height/2
    pub world_z: f64,
    pub rotation_y: f64,
}

/// Losa de voladizo
#[derive(Debug, Serialize)]
pub struct CanopyMesh {
    pub id: String,
    /// Centro en XZ
    pub center_x: f64,
    pub center_y: f64,  // = height + slab_thickness/2
    pub center_z: f64,
    pub length: f64,    // profundidad
    pub width: f64,
    pub slab_thickness: f64,
    pub rotation_y: f64,
}

/// Punto de luz (fixture)
#[derive(Debug, Serialize)]
pub struct LightMesh {
    pub id: String,
    pub name: String,
    pub world_x: f64,
    pub world_y: f64,
    pub world_z: f64,
    pub lumens: f64,
}

// ─── Constructor principal ─────────────────────────────────────────────────────

/// Nota: Babylon.js usa coordenadas Y=up, X=derecha, Z=profundidad.
/// El editor 2D usa X=derecha, Y=abajo (SVG), Z=arriba (altura).
/// Conversión: babylon.x = scene.x, babylon.y = scene.z (altura), babylon.z = scene.y
fn to_babylon(x: f64, y_2d: f64, z_height: f64) -> (f64, f64, f64) {
    (x, z_height, y_2d)
}

pub fn build_scene_3d(scene_json: &str) -> Result<Scene3DOutput, String> {
    let scene: SceneInput = serde_json::from_str(scene_json)
        .map_err(|e| format!("parse scene: {e}"))?;

    // ── Suelos ────────────────────────────────────────────────────────────────
    let floors: Vec<FloorMesh> = scene.rooms.iter().map(|room| {
        FloorMesh {
            id: room.id.clone(),
            name: room.name.clone(),
            vertices: room.vertices.iter().map(|v| [v.x, v.y]).collect(),
            elevation_y: 0.0,
            ceiling_y: room.height,
            color_hex: room.color.clone(),
        }
    }).collect();

    // ── Paredes (con análisis de ventanas) ────────────────────────────────────
    let wall_meshes: Vec<WallMesh> = scene.walls.iter().map(|w| {
        let wall_geom = Wall {
            id: w.id.clone(),
            x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
            thickness: w.thickness, height: w.height,
        };
        let len = wall_geom.length();
        let center = wall_geom.center();
        let angle  = wall_geom.angle_rad();

        // Ventanas sobre esta pared
        let windows_on_wall: Vec<&WindowInput> = scene.windows.iter()
            .filter(|win| win.wall_id == w.id)
            .collect();

        // Construir segmentos (zonas con y sin ventana)
        let mut segments: Vec<WallSegment> = Vec::new();
        let mut sorted_windows = windows_on_wall.clone();
        sorted_windows.sort_by(|a, b| a.offset_along_wall.partial_cmp(&b.offset_along_wall).unwrap());

        let mut cursor = 0.0f64;
        for win in &sorted_windows {
            // Segmento macizo antes de la ventana
            if win.offset_along_wall > cursor + 1e-3 {
                segments.push(WallSegment {
                    offset_start: cursor,
                    offset_end: win.offset_along_wall,
                    has_window: false,
                    window_sill: 0.0, window_top: 0.0,
                });
            }
            // Segmento con ventana
            segments.push(WallSegment {
                offset_start: win.offset_along_wall,
                offset_end: win.offset_along_wall + win.width,
                has_window: true,
                window_sill: win.sill_height,
                window_top: win.sill_height + win.height,
            });
            cursor = win.offset_along_wall + win.width;
        }
        // Segmento final macizo
        if cursor < len - 1e-3 {
            segments.push(WallSegment {
                offset_start: cursor,
                offset_end: len,
                has_window: false,
                window_sill: 0.0, window_top: 0.0,
            });
        }
        if segments.is_empty() {
            segments.push(WallSegment {
                offset_start: 0.0, offset_end: len,
                has_window: false, window_sill: 0.0, window_top: 0.0,
            });
        }

        let (bx, by, bz) = to_babylon(center.x, center.y, w.height / 2.0);
        WallMesh {
            id: w.id.clone(),
            center_x: bx, center_y: by, center_z: bz,
            length: len,
            height: w.height,
            thickness: w.thickness,
            rotation_y: -angle, // negativo porque Z invertido en Babylon
            segments,
        }
    }).collect();

    // ── Ventanas ──────────────────────────────────────────────────────────────
    let window_frames: Vec<WindowMesh> = scene.windows.iter().map(|win| {
        // Buscar el muro para calcular posición
        let wall_opt = scene.walls.iter().find(|w| w.id == win.wall_id);
        let (wx, wz, wy, rot) = if let Some(w) = wall_opt {
            let wall_geom = Wall {
                id: w.id.clone(),
                x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
                thickness: w.thickness, height: w.height,
            };
            let win_geom = Window {
                id: win.id.clone(),
                wall_id: win.wall_id.clone(),
                offset_along_wall: win.offset_along_wall,
                width: win.width, height: win.height, sill_height: win.sill_height,
            };
            let c2d = win_geom.center_2d(&wall_geom);
            let angle = wall_geom.angle_rad();
            let center_y = win.sill_height + win.height / 2.0;
            let (bx, _by, bz) = to_babylon(c2d.x, c2d.y, 0.0);
            (bx, bz, center_y, -angle)
        } else {
            (0.0, 0.0, win.sill_height + win.height / 2.0, 0.0)
        };

        WindowMesh {
            id: win.id.clone(),
            wall_id: win.wall_id.clone(),
            offset_along_wall: win.offset_along_wall,
            width: win.width,
            height: win.height,
            sill_height: win.sill_height,
            world_x: wx,
            world_y: wy,
            world_z: wz,
            rotation_y: rot,
        }
    }).collect();

    // ── Voladizos ─────────────────────────────────────────────────────────────
    let canopy_slabs: Vec<CanopyMesh> = scene.canopies.iter().map(|c| {
        let can_geom = Canopy {
            id: c.id.clone(),
            x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2,
            width: c.width, slab_thickness: c.slab_thickness, height: c.height,
        };
        let depth = can_geom.depth();
        let angle = can_geom.angle_rad();
        // Centro del voladizo
        let cx = (c.x1 + c.x2) / 2.0;
        let cy = (c.y1 + c.y2) / 2.0;
        let (bx, _, bz) = to_babylon(cx, cy, 0.0);
        let by = c.height + c.slab_thickness / 2.0;

        CanopyMesh {
            id: c.id.clone(),
            center_x: bx,
            center_y: by,
            center_z: bz,
            length: depth,
            width: c.width,
            slab_thickness: c.slab_thickness,
            rotation_y: -angle,
        }
    }).collect();

    // ── Luces ─────────────────────────────────────────────────────────────────
    let light_points: Vec<LightMesh> = scene.fixtures.iter().map(|f| {
        let (bx, _, bz) = to_babylon(f.x, f.y, 0.0);
        LightMesh {
            id: f.id.clone(),
            name: f.name.clone(),
            world_x: bx,
            world_y: f.z,
            world_z: bz,
            lumens: f.lumens,
        }
    }).collect();

    Ok(Scene3DOutput {
        floors,
        wall_segments: wall_meshes,
        window_frames,
        canopy_slabs,
        light_points,
    })
}
