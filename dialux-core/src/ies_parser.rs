/// ies_parser.rs — Parser completo IESNA:LM-63 (1986, 1991, 1995, 2002)
///
/// Soporta:
///  - Keywords [KEY] value
///  - TILT=NONE / TILT=INCLUDE
///  - 10 campos de configuración
///  - Arrays de ángulos verticales y horizontales
///  - Matriz de candelas (agrupada por ángulo horizontal)
///  - Interpolación bilineal en candela_at()
///  - Expansión de simetría (0°, 90°, 180°, 360°)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Estructuras públicas ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LuminousOpening {
    pub width: f64,
    pub length: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IesData {
    pub is_valid: bool,
    pub format_version: String,

    // Metadatos de keywords
    pub manufacturer: String,
    pub luminaire_catalog_number: String,
    pub luminaire_description: String,
    pub lamp_catalog_number: String,
    pub test_lab: String,
    pub issue_date: String,
    pub keywords: HashMap<String, String>,

    // Configuración fotométrica
    pub num_lamps: u32,
    pub lumens_per_lamp: f64,   // -1 = fotometría absoluta
    pub multiplier: f64,
    pub photometric_type: u8,   // 1=C, 2=B, 3=A
    pub units_type: u8,         // 1=pies, 2=metros
    pub luminous_opening: LuminousOpening,

    // Web fotométrica
    pub num_vertical_angles: usize,
    pub num_horizontal_angles: usize,
    pub vertical_angles: Vec<f64>,
    pub horizontal_angles: Vec<f64>,
    /// candela_values[h_index][v_index]
    pub candela_values: Vec<Vec<f64>>,

    // Derivados
    pub total_lumens: f64,
    pub max_candela: f64,
    pub beam_angle_50: f64,   // ángulo a 50% de Imax
    pub beam_angle_10: f64,   // ángulo a 10% de Imax
    pub efficiency_lm_w: f64, // si se dispone de watts en keywords
}

impl IesData {
    /// Intensidad lumínica (cd) para ángulo vertical theta y horizontal phi (grados).
    /// Usa interpolación bilineal sobre la web de candelas.
    pub fn candela_at(&self, theta_deg: f64, phi_deg: f64) -> f64 {
        if self.candela_values.is_empty() { return 0.0; }
        if self.vertical_angles.is_empty() || self.horizontal_angles.is_empty() {
            return 0.0;
        }

        // Clamp theta al rango disponible
        let theta = theta_deg.max(self.vertical_angles[0])
            .min(*self.vertical_angles.last().unwrap());

        // Normalizar phi según simetría
        let phi = self.normalize_phi(phi_deg);

        // Buscar índices de encuadre para interpolación
        let (hi0, hi1, ht) = bracket(&self.horizontal_angles, phi);
        let (vi0, vi1, vt) = bracket(&self.vertical_angles, theta);

        // Bilinear interpolation
        let c00 = self.candela_values[hi0][vi0];
        let c10 = self.candela_values[hi1][vi0];
        let c01 = self.candela_values[hi0][vi1];
        let c11 = self.candela_values[hi1][vi1];

        let c0 = c00 + (c10 - c00) * ht;
        let c1 = c01 + (c11 - c01) * ht;
        c0 + (c1 - c0) * vt
    }

    fn normalize_phi(&self, phi_deg: f64) -> f64 {
        if self.horizontal_angles.len() < 2 { return 0.0; }
        let last = *self.horizontal_angles.last().unwrap();
        let phi = phi_deg.rem_euclid(360.0);

        // Simetría según el último ángulo horizontal
        if last == 0.0 {
            0.0                         // simétrico axialmente
        } else if last == 90.0 {
            // Simetría de cuadrante
            let p = phi.rem_euclid(90.0);
            p
        } else if last == 180.0 {
            // Simetría bilateral
            if phi <= 180.0 { phi } else { 360.0 - phi }
        } else {
            // Sin simetría especial (last == 360)
            phi.min(last)
        }
    }
}

// ─── Función de parse ─────────────────────────────────────────────────────────

pub fn parse_ies(content: &str) -> Result<IesData, String> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Err("Archivo IES vacío".to_string());
    }

    let mut idx = 0usize;

    // Detectar versión del formato
    let format_version = if lines[0].starts_with("IESNA") || lines[0].starts_with("IES") {
        let v = lines[0].to_string();
        idx = 1;
        v
    } else {
        "IESNA:LM-63-1991".to_string()
    };

    // Parsear keywords [KEY] value
    let mut keywords: HashMap<String, String> = HashMap::new();
    while idx < lines.len() {
        let line = lines[idx].trim();
        if line.starts_with("TILT") {
            break;
        }
        if line.starts_with('[') {
            if let Some(end) = line.find(']') {
                let key = line[1..end].trim().to_string();
                let val = line[end + 1..].trim().to_string();
                keywords.insert(key, val);
            }
        }
        idx += 1;
    }

    // Parsear TILT
    let tilt_line = lines.get(idx).copied().unwrap_or("TILT=NONE");
    let tilt_type = tilt_line.split('=').nth(1).unwrap_or("NONE").trim().to_uppercase();
    idx += 1;

    if tilt_type == "INCLUDE" {
        // Saltar datos de TILT: lamp-to-luminaire geometry + N angle/multiplier pairs
        if idx < lines.len() {
            // número de pares
            let n_pairs = lines[idx].trim().parse::<usize>().unwrap_or(0);
            idx += 1 + n_pairs; // geometry line + angle pairs
        }
    }

    // Recolectar todos los números del resto del archivo
    let mut numbers: Vec<f64> = Vec::new();
    for i in idx..lines.len() {
        for token in lines[i].split_whitespace() {
            let normalized = token.replace(',', ".");
            if let Ok(n) = normalized.parse::<f64>() {
                numbers.push(n);
            }
        }
    }

    if numbers.len() < 10 {
        return Err(format!("IES: datos insuficientes (solo {} números)", numbers.len()));
    }

    let mut ni = 0usize;

    // 10 campos de configuración
    let num_lamps = numbers[ni] as u32; ni += 1;
    let lumens_per_lamp = numbers[ni]; ni += 1;
    let multiplier = numbers[ni]; ni += 1;
    let num_v = numbers[ni] as usize; ni += 1;
    let num_h = numbers[ni] as usize; ni += 1;
    let photometric_type = numbers[ni] as u8; ni += 1;
    let units_type = numbers[ni] as u8; ni += 1;
    let lum_width = numbers[ni]; ni += 1;
    let lum_length = numbers[ni]; ni += 1;
    let lum_height = numbers[ni]; ni += 1;

    if num_v == 0 || num_h == 0 {
        return Err("IES: número de ángulos es cero".to_string());
    }

    // Ángulos verticales
    if ni + num_v > numbers.len() {
        return Err("IES: datos insuficientes para ángulos verticales".to_string());
    }
    let vertical_angles: Vec<f64> = numbers[ni..ni + num_v].to_vec();
    ni += num_v;

    // Ángulos horizontales
    if ni + num_h > numbers.len() {
        return Err("IES: datos insuficientes para ángulos horizontales".to_string());
    }
    let horizontal_angles: Vec<f64> = numbers[ni..ni + num_h].to_vec();
    ni += num_h;

    // Matriz de candelas [h][v]
    let total_cells = num_h * num_v;
    if ni + total_cells > numbers.len() {
        return Err(format!(
            "IES: datos de candelas insuficientes. Necesito {} valores, hay {}",
            total_cells,
            numbers.len() - ni
        ));
    }

    let mut candela_values: Vec<Vec<f64>> = Vec::with_capacity(num_h);
    for h in 0..num_h {
        let start = ni + h * num_v;
        let plane: Vec<f64> = numbers[start..start + num_v]
            .iter()
            .map(|&c| c * multiplier)
            .collect();
        candela_values.push(plane);
    }

    // Calcular lúmenes totales
    let total_lumens = if lumens_per_lamp > 0.0 {
        lumens_per_lamp * num_lamps as f64
    } else {
        // Fotometría absoluta: integrar la web de candelas
        estimate_lumens(&candela_values, &vertical_angles, &horizontal_angles)
    };

    // Máximo de candelas
    let max_candela = candela_values
        .iter()
        .flat_map(|plane| plane.iter())
        .cloned()
        .fold(0.0_f64, f64::max);

    // Ángulo de haz al 50% y 10% de Imax (plano C0)
    let (beam_50, beam_10) = compute_beam_angles(&candela_values[0], &vertical_angles, max_candela);

    // Eficiencia lm/W si hay watts en keywords
    let watts: f64 = keywords
        .get("WATTS")
        .or_else(|| keywords.get("WATTAGE"))
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let efficiency_lm_w = if watts > 0.0 { total_lumens / watts } else { 0.0 };

    Ok(IesData {
        is_valid: true,
        format_version,
        manufacturer: keywords.get("MANUFAC").cloned().unwrap_or_default(),
        luminaire_catalog_number: keywords.get("LUMCAT").cloned().unwrap_or_default(),
        luminaire_description: keywords.get("LUMINAIRE").cloned().unwrap_or_default(),
        lamp_catalog_number: keywords.get("LAMPCAT").cloned().unwrap_or_default(),
        test_lab: keywords.get("TESTLAB").cloned().unwrap_or_default(),
        issue_date: keywords.get("ISSUEDATE").cloned().unwrap_or_default(),
        keywords,
        num_lamps,
        lumens_per_lamp,
        multiplier,
        photometric_type,
        units_type,
        luminous_opening: LuminousOpening {
            width: lum_width,
            length: lum_length,
            height: lum_height,
        },
        num_vertical_angles: num_v,
        num_horizontal_angles: num_h,
        vertical_angles,
        horizontal_angles,
        candela_values,
        total_lumens,
        max_candela,
        beam_angle_50: beam_50,
        beam_angle_10: beam_10,
        efficiency_lm_w,
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Devuelve (idx0, idx1, t) para interpolación lineal en `angles`
fn bracket(angles: &[f64], value: f64) -> (usize, usize, f64) {
    let n = angles.len();
    if n == 0 { return (0, 0, 0.0); }
    if n == 1 { return (0, 0, 0.0); }
    if value <= angles[0] { return (0, 0, 0.0); }
    if value >= angles[n - 1] { return (n - 1, n - 1, 0.0); }

    let i = angles.partition_point(|&a| a <= value).saturating_sub(1);
    let i1 = (i + 1).min(n - 1);
    let span = angles[i1] - angles[i];
    let t = if span.abs() < 1e-9 { 0.0 } else { (value - angles[i]) / span };
    (i, i1, t)
}

/// Estimación de lúmenes totales por integración de la esfera de candelas
fn estimate_lumens(
    candela: &[Vec<f64>],
    v_angles: &[f64],
    h_angles: &[f64],
) -> f64 {
    if candela.is_empty() || v_angles.is_empty() || h_angles.is_empty() {
        return 0.0;
    }
    use std::f64::consts::PI;

    let mut total = 0.0f64;
    let num_h = h_angles.len();
    let num_v = v_angles.len();

    for hi in 0..num_h {
        let d_phi = if num_h > 1 {
            let prev_phi = if hi == 0 { h_angles[0] } else { h_angles[hi - 1] };
            let next_phi = if hi == num_h - 1 { h_angles[hi] } else { h_angles[hi + 1] };
            (next_phi - prev_phi).abs() / 2.0
        } else {
            360.0
        };

        for vi in 0..num_v {
            let theta_rad = v_angles[vi].to_radians();
            let d_theta_deg = if num_v > 1 {
                let prev = if vi == 0 { v_angles[0] } else { v_angles[vi - 1] };
                let next = if vi == num_v - 1 { v_angles[vi] } else { v_angles[vi + 1] };
                (next - prev).abs() / 2.0
            } else {
                180.0
            };
            let d_theta_rad = d_theta_deg.to_radians();
            let d_phi_rad = d_phi.to_radians();

            let solid_angle = theta_rad.sin() * d_theta_rad * d_phi_rad;
            total += candela[hi][vi] * solid_angle;
        }
    }
    total
}

/// Calcula ángulos de haz al 50% y 10% del máximo de candelas en el plano C0
fn compute_beam_angles(c0_plane: &[f64], v_angles: &[f64], max_candela: f64) -> (f64, f64) {
    if max_candela <= 0.0 { return (0.0, 0.0); }

    let mut beam_50 = 0.0f64;
    let mut beam_10 = 0.0f64;

    for (i, &angle) in v_angles.iter().enumerate() {
        let intensity = c0_plane.get(i).copied().unwrap_or(0.0);
        let ratio = intensity / max_candela;
        if ratio >= 0.5 { beam_50 = beam_50.max(angle); }
        if ratio >= 0.1 { beam_10 = beam_10.max(angle); }
    }

    (beam_50, beam_10)
}
