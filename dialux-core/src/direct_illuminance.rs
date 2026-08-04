use serde::{Deserialize, Serialize};

/// Kernel "caliente" del motor de iluminación (Fase 12 del plan maestro:
/// "migrar kernels medidos a Rust/WASM"). Puerto fiel de
/// `resources/js/pages/dialux/hooks/photometricInterpolation.ts` +
/// `directIlluminance.ts` + `domain/geometry/segmentOcclusion.ts` — NINGUNA
/// fórmula debe divergir de esos archivos TS (son la fuente de verdad; este
/// módulo es una aceleración, no una reimplementación con criterio propio).
/// Expone una única función por lotes (`compute_direct_illuminance_grid`):
/// cruzar la frontera JS↔WASM por cada punto×luminaria anularía cualquier
/// ganancia de rendimiento.

const MATH_PI: f64 = std::f64::consts::PI;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurfacePointInput {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub normal: Vector3,
}

/// Mismos nombres de campo que `Fixture['photometricWeb']`
/// (`hooks/types.ts`) — deliberadamente snake_case, así como en el JSON TS
/// original (no es un `camelCase` a convertir).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotometricWebInput {
    pub c_angles: Vec<f64>,
    pub gamma_angles: Vec<f64>,
    pub candela: Vec<Vec<f64>>,
    pub reference_lumens: Option<f64>,
    pub provenance: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixtureInput {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub rotation: Option<f64>,
    pub lumens: f64,
    pub efficiency: f64,
    pub photometric_web: Option<PhotometricWebInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcclusionBoxInput {
    pub origin_x: f64,
    pub origin_y: f64,
    pub angle_rad: f64,
    pub length: f64,
    pub thickness: f64,
    pub z_min: f64,
    pub z_max: f64,
}

/// Interpola linealmente `values` (definidos en `points`, ascendentes) en
/// `target`, con clamp en los extremos. Puerto de `interpolate1D`
/// (`photometricInterpolation.ts`).
fn interpolate_1d(values: &[f64], points: &[f64], target: f64) -> f64 {
    if points.is_empty() {
        return 0.0;
    }
    if points.len() == 1 {
        return *values.first().unwrap_or(&0.0);
    }
    if target <= points[0] {
        return values[0];
    }
    if target >= points[points.len() - 1] {
        return values[values.len() - 1];
    }

    for i in 0..points.len() - 1 {
        if target >= points[i] && target <= points[i + 1] {
            let span = points[i + 1] - points[i];
            let t = if span > 0.0 { (target - points[i]) / span } else { 0.0 };
            return values[i] + (values[i + 1] - values[i]) * t;
        }
    }

    values[values.len() - 1]
}

/// Puerto de `foldAzimuthToCRange` (`photometricInterpolation.ts`).
fn fold_azimuth_to_c_range(azimuth_deg: f64, max_c: f64) -> f64 {
    let mut a = azimuth_deg % 360.0;
    if a < 0.0 {
        a += 360.0;
    }

    if max_c <= 90.01 {
        a %= 180.0;
        if a > 90.0 {
            a = 180.0 - a;
        }
        return a.min(max_c);
    }

    if max_c <= 180.01 {
        if a > 180.0 {
            a = 360.0 - a;
        }
        return a.min(max_c);
    }

    a
}

/// Puerto de `candelaFromPhotometricWeb` (`photometricInterpolation.ts`).
fn candela_from_photometric_web(web: &PhotometricWebInput, azimuth_deg: f64, gamma_deg: f64) -> f64 {
    let c_angles = &web.c_angles;
    let gamma_angles = &web.gamma_angles;
    let matrix = &web.candela;

    if c_angles.is_empty() || gamma_angles.is_empty() || matrix.is_empty() || matrix[0].is_empty() {
        return 0.0;
    }

    let max_c = c_angles[c_angles.len() - 1];
    let folded_c = fold_azimuth_to_c_range(azimuth_deg, max_c);
    let clamped_gamma = gamma_deg.max(gamma_angles[0]).min(gamma_angles[gamma_angles.len() - 1]);

    let mut lo_idx = 0usize;
    let mut hi_idx = c_angles.len() - 1;
    for (i, &c) in c_angles.iter().enumerate() {
        if c <= folded_c {
            lo_idx = i;
        }
        if c >= folded_c {
            hi_idx = i;
            break;
        }
    }
    if hi_idx < lo_idx {
        hi_idx = lo_idx;
    }

    let empty_row: Vec<f64> = Vec::new();
    let lo_row = matrix.get(lo_idx).unwrap_or_else(|| matrix.get(0).unwrap_or(&empty_row));
    let hi_row = matrix.get(hi_idx).unwrap_or(lo_row);

    let lo_val = interpolate_1d(lo_row, gamma_angles, clamped_gamma);
    let hi_val = interpolate_1d(hi_row, gamma_angles, clamped_gamma);

    if hi_idx == lo_idx {
        return lo_val;
    }

    let span = c_angles[hi_idx] - c_angles[lo_idx];
    let t = if span > 0.0 { (folded_c - c_angles[lo_idx]) / span } else { 0.0 };

    lo_val + (hi_val - lo_val) * t
}

/// Puerto de `candela` (`photometricInterpolation.ts`).
fn candela(fixture: &FixtureInput, gamma_deg: f64, azimuth_deg: f64) -> f64 {
    if let Some(web) = &fixture.photometric_web {
        let has_legacy_ldt_offset = web.provenance.as_deref() == Some("manufacturer")
            && web.c_angles.len() == 1
            && web.c_angles[0].abs() > 0.01;

        if !has_legacy_ldt_offset {
            let raw_candela = candela_from_photometric_web(web, azimuth_deg, gamma_deg);
            let flux_scale = match web.reference_lumens {
                Some(reference_lumens) if reference_lumens > 0.0 => fixture.lumens.max(0.0) / reference_lumens,
                _ => 1.0,
            };
            return (raw_candela * flux_scale).max(0.0);
        }
    }

    let intensity = (fixture.lumens * fixture.efficiency) / MATH_PI;
    let gamma_rad = (gamma_deg * MATH_PI) / 180.0;
    (intensity * gamma_rad.cos()).max(0.0)
}

/// Sesgo paramétrico (fracción de la longitud del segmento) — puerto de
/// `PARAMETRIC_BIAS` (`segmentOcclusion.ts`).
const PARAMETRIC_BIAS: f64 = 1e-6;

fn to_local_frame(box_: &OcclusionBoxInput, p: &Vector3) -> Vector3 {
    let dx = p.x - box_.origin_x;
    let dy = p.y - box_.origin_y;
    let cos = box_.angle_rad.cos();
    let sin = box_.angle_rad.sin();
    Vector3 {
        x: dx * cos + dy * sin,
        y: -dx * sin + dy * cos,
        z: p.z,
    }
}

/// Puerto de `segmentIntersectsBox` (método de slabs, `segmentOcclusion.ts`).
fn segment_intersects_box(p0: &Vector3, p1: &Vector3, box_: &OcclusionBoxInput) -> bool {
    let a = to_local_frame(box_, p0);
    let b = to_local_frame(box_, p1);
    let dir = Vector3 { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };

    let mins = [0.0, -box_.thickness / 2.0, box_.z_min];
    let maxs = [box_.length, box_.thickness / 2.0, box_.z_max];
    let origins = [a.x, a.y, a.z];
    let dirs = [dir.x, dir.y, dir.z];

    let mut t_min = PARAMETRIC_BIAS;
    let mut t_max = 1.0 - PARAMETRIC_BIAS;

    for axis in 0..3 {
        let d = dirs[axis];
        let o = origins[axis];
        if d.abs() < 1e-12 {
            if o < mins[axis] || o > maxs[axis] {
                return false;
            }
            continue;
        }
        let mut t1 = (mins[axis] - o) / d;
        let mut t2 = (maxs[axis] - o) / d;
        if t1 > t2 {
            std::mem::swap(&mut t1, &mut t2);
        }
        t_min = t_min.max(t1);
        t_max = t_max.min(t2);
        if t_min > t_max {
            return false;
        }
    }

    true
}

/// Puerto de `isSegmentOccluded` (`segmentOcclusion.ts`).
fn is_segment_occluded(p0: &Vector3, p1: &Vector3, obstacles: &[OcclusionBoxInput]) -> bool {
    obstacles.iter().any(|b| segment_intersects_box(p0, p1, b))
}

/// Puerto de `illuminanceFromFixture` (`directIlluminance.ts`).
fn illuminance_from_fixture(point: &SurfacePointInput, fixture: &FixtureInput, obstacles: &[OcclusionBoxInput]) -> f64 {
    let dx = point.x - fixture.x;
    let dy = point.y - fixture.y;
    let dz = point.z - fixture.z;
    let dist2 = dx * dx + dy * dy + dz * dz;

    if dist2 < 1e-6 {
        return 0.0;
    }

    if !obstacles.is_empty() {
        let p0 = Vector3 { x: point.x, y: point.y, z: point.z };
        let p1 = Vector3 { x: fixture.x, y: fixture.y, z: fixture.z };
        if is_segment_occluded(&p0, &p1, obstacles) {
            return 0.0;
        }
    }

    let dist = dist2.sqrt();
    let cos_incident = ((-dx / dist) * point.normal.x + (-dy / dist) * point.normal.y + (-dz / dist) * point.normal.z).max(0.0);

    if cos_incident <= 0.0 {
        return 0.0;
    }

    // Sin clamp — espejo exacto de `illuminanceFromFixture` (TS), que
    // tampoco recorta `-dz/dist` antes de `Math.acos`.
    let gamma_deg = (-dz / dist).acos().to_degrees();
    let raw_azimuth_deg = dy.atan2(dx).to_degrees();
    let azimuth_deg = raw_azimuth_deg - fixture.rotation.unwrap_or(0.0);

    (candela(fixture, gamma_deg, azimuth_deg) * cos_incident) / dist2
}

/// Lógica compartida por el binding wasm-bindgen (`lib.rs`) y los tests.
/// Devuelve, por cada punto (mismo orden que `points`), la suma de
/// iluminancia directa de todas las luminarias — antes de cualquier
/// componente reflejada/radiosidad (esas siguen calculándose en TS, fuera
/// de este kernel).
pub fn compute_direct_illuminance_grid_values(
    points: &[SurfacePointInput],
    fixtures: &[FixtureInput],
    obstacles: &[OcclusionBoxInput],
) -> Vec<f64> {
    points
        .iter()
        .map(|point| fixtures.iter().map(|fixture| illuminance_from_fixture(point, fixture, obstacles)).sum())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_without_photometric_web(lumens: f64) -> FixtureInput {
        FixtureInput {
            x: 0.0,
            y: 0.0,
            z: 3.0,
            rotation: None,
            lumens,
            efficiency: 1.0,
            photometric_web: None,
        }
    }

    /// Espejo de `photometricInterpolation.test.ts`: "en el hemisferio hacia
    /// adelante (gamma <= 90°) devuelve un valor positivo, máximo en nadir".
    #[test]
    fn candela_lambertian_fallback_forward_hemisphere() {
        let fixture = fixture_without_photometric_web(3000.0);
        let nadir = candela(&fixture, 0.0, 0.0);
        let oblique = candela(&fixture, 60.0, 0.0);
        let grazing = candela(&fixture, 90.0, 0.0);

        assert!(nadir > 0.0);
        assert!(oblique > 0.0);
        assert!(oblique < nadir);
        assert!(grazing.abs() < 1e-6);
        assert!((nadir - 3000.0 / MATH_PI).abs() < 1e-9);
    }

    /// Espejo de `photometricInterpolation.test.ts`: "detrás de la
    /// luminaria (gamma > 90°) nunca devuelve intensidad negativa".
    #[test]
    fn candela_lambertian_fallback_never_negative_behind_fixture() {
        let fixture = fixture_without_photometric_web(3000.0);
        assert_eq!(candela(&fixture, 91.0, 0.0), 0.0);
        assert_eq!(candela(&fixture, 135.0, 0.0), 0.0);
        assert_eq!(candela(&fixture, 180.0, 0.0), 0.0);
    }

    /// Espejo de `photometricInterpolation.test.ts`: "escala las candelas
    /// cuando cambian los lúmenes de la luminaria".
    #[test]
    fn candela_scales_with_edited_lumens() {
        let fixture = FixtureInput {
            photometric_web: Some(PhotometricWebInput {
                c_angles: vec![0.0],
                gamma_angles: vec![0.0, 90.0],
                candela: vec![vec![1000.0, 0.0]],
                reference_lumens: Some(2000.0),
                provenance: Some("manufacturer".to_string()),
            }),
            ..fixture_without_photometric_web(4000.0)
        };

        assert_eq!(candela(&fixture, 0.0, 0.0), 2000.0);
    }

    /// Espejo de `photometricInterpolation.test.ts`: "descarta snapshots LDT
    /// legacy desplazados y calcula desde el flujo editado".
    #[test]
    fn candela_discards_legacy_ldt_offset_snapshot() {
        let fixture = FixtureInput {
            photometric_web: Some(PhotometricWebInput {
                c_angles: vec![0.592],
                gamma_angles: vec![0.0, 90.0, 180.0],
                candela: vec![vec![1.0, 5.0, 900.0]],
                reference_lumens: None,
                provenance: Some("manufacturer".to_string()),
            }),
            ..fixture_without_photometric_web(3000.0)
        };

        let expected = 3000.0 / MATH_PI;
        assert!((candela(&fixture, 0.0, 0.0) - expected).abs() < 1e-6);
    }

    /// Un punto directamente bajo la luminaria (mismo eje) recibe la
    /// candela nadir escalada por 1/dist² — verifica
    /// `illuminance_from_fixture` de forma independiente (ley del inverso
    /// del cuadrado, sin fotometría real).
    #[test]
    fn illuminance_from_fixture_directly_below_matches_inverse_square_law() {
        let fixture = FixtureInput { x: 0.0, y: 0.0, z: 3.0, ..fixture_without_photometric_web(3000.0) };
        let point = SurfacePointInput {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            normal: Vector3 { x: 0.0, y: 0.0, z: 1.0 },
        };

        let dist2 = 9.0; // (3m de altura)^2
        let expected = candela(&fixture, 0.0, 0.0) / dist2;
        let actual = illuminance_from_fixture(&point, &fixture, &[]);
        assert!((actual - expected).abs() < 1e-9);
    }

    /// Un obstáculo que cubre por completo el segmento punto↔luminaria
    /// anula la contribución — verifica `is_segment_occluded` de forma
    /// independiente.
    #[test]
    fn illuminance_from_fixture_is_zero_when_occluded() {
        let fixture = FixtureInput { x: 0.0, y: 0.0, z: 3.0, ..fixture_without_photometric_web(3000.0) };
        let point = SurfacePointInput {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            normal: Vector3 { x: 0.0, y: 0.0, z: 1.0 },
        };
        let obstacle = OcclusionBoxInput {
            origin_x: -1.0,
            origin_y: -1.0,
            angle_rad: 0.0,
            length: 2.0,
            thickness: 2.0,
            z_min: 0.0,
            z_max: 3.0,
        };

        assert_eq!(illuminance_from_fixture(&point, &fixture, &[obstacle]), 0.0);
    }

    #[test]
    fn compute_direct_illuminance_grid_sums_all_fixtures_per_point() {
        let points = vec![
            SurfacePointInput { x: 0.0, y: 0.0, z: 0.0, normal: Vector3 { x: 0.0, y: 0.0, z: 1.0 } },
            SurfacePointInput { x: 5.0, y: 5.0, z: 0.0, normal: Vector3 { x: 0.0, y: 0.0, z: 1.0 } },
        ];
        let fixtures = vec![
            FixtureInput { x: 0.0, y: 0.0, z: 3.0, ..fixture_without_photometric_web(3000.0) },
            FixtureInput { x: 0.5, y: 0.5, z: 3.0, ..fixture_without_photometric_web(2000.0) },
        ];

        let values = compute_direct_illuminance_grid_values(&points, &fixtures, &[]);
        assert_eq!(values.len(), 2);

        let expected_point0: f64 = fixtures.iter().map(|f| illuminance_from_fixture(&points[0], f, &[])).sum();
        assert!((values[0] - expected_point0).abs() < 1e-9);
        // El punto lejano (5,5) recibe mucha menos luz que el punto bajo las luminarias.
        assert!(values[1] < values[0]);
    }

    fn build_grid_points(min_x: f64, max_x: f64, min_y: f64, max_y: f64, spacing: f64) -> Vec<SurfacePointInput> {
        let mut points = Vec::new();
        let mut y = min_y + spacing / 2.0;
        while y < max_y {
            let mut x = min_x + spacing / 2.0;
            while x < max_x {
                points.push(SurfacePointInput { x, y, z: 0.8, normal: Vector3 { x: 0.0, y: 0.0, z: 1.0 } });
                x += spacing;
            }
            y += spacing;
        }
        points
    }

    fn build_fixtures(count: usize, lumens: f64) -> Vec<FixtureInput> {
        (0..count)
            .map(|i| FixtureInput { x: 1.5 + (i as f64) * 0.7, y: 1.0 + (i as f64) * 0.3, ..fixture_without_photometric_web(lumens) })
            .collect()
    }

    /// Timing de referencia del kernel (release, `#[ignore]` para no correr
    /// en `cargo test` normal). Escalas equivalentes al benchmark TS
    /// (`__benchmarks__/fase12WasmKernelBenchmark.test.ts`) — misma malla
    /// 6m×4m/0.5m (96 puntos), 4 luminarias para "pequeña" y 20×10 para
    /// "mediana". Ejecutar con:
    /// `cargo test --release -- --ignored --nocapture direct_illuminance::tests::bench_`
    #[test]
    #[ignore]
    fn bench_compute_direct_illuminance_grid() {
        let points = build_grid_points(0.0, 6.0, 0.0, 4.0, 0.5);

        let small_fixtures = build_fixtures(4, 3000.0);
        let start_small = std::time::Instant::now();
        let _ = compute_direct_illuminance_grid_values(&points, &small_fixtures, &[]);
        println!(
            "[fase12-benchmark] Rust (release) directo — malla pequeña ({} pts x {} luminarias): {:?}",
            points.len(),
            small_fixtures.len(),
            start_small.elapsed()
        );

        let medium_fixtures = build_fixtures(10, 3000.0);
        let start_medium = std::time::Instant::now();
        for _ in 0..20 {
            let _ = compute_direct_illuminance_grid_values(&points, &medium_fixtures, &[]);
        }
        println!(
            "[fase12-benchmark] Rust (release) directo — malla mediana (20 ambientes, {} pts c/u, {} luminarias en total): {:?}",
            points.len(),
            medium_fixtures.len() * 20,
            start_medium.elapsed()
        );
    }
}
