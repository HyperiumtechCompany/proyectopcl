/// ldt_parser.rs — Parser EULUMDAT/LDT completo
///
/// Estándar europeo de distribución fotométrica.
/// Referencia: Axel Stockmar (1990/1998), DIAL GmbH.
///
/// Estructura del archivo (líneas fijas):
///  1       : Nombre de la empresa / base de datos / versión
///  2       : Ityp  — tipo de luminaria (0=punto, 1=lineal, 2=superficie, 3=circular)
///  3       : Isym  — simetría (0=ninguna, 1=0-180°, 2=0-90°, 3=C0-90°, 4=cuadrante)
///  4       : Mc    — número de planos C
///  5       : Dc    — separación entre planos C (°), 0=no equidistante
///  6       : Ng    — número de ángulos gamma por plano
///  7       : Dg    — separación entre ángulos gamma (°)
///  8       : N° informe de medición
///  9       : Nombre luminaria
///  10      : Número luminaria
///  11      : Nombre archivo
///  12      : Fecha y usuario
///  13      : Long., ancho y altura de la luminaria (m)
///  14      : Long., ancho y altura del área luminosa (m)
///  15      : Fracción de flujo hacia abajo (DF%)
///  16      : Eficiencia lumínica (LEFI%)
///  17      : Peso (kg)
///  18-27   : DR1-DR10 (coeficientes de reflexión)
///  28      : Número de lámparas
///  29      : Tipo de lámparas
///  30      : Flujo luminoso total (klm)
///  31      : Temperatura de color (K)
///  32      : CRI Ra
///  33      : Potencia (W)
///  34+     : Ángulos C (Mc valores si Dc=0, else Mc calculados)
///  ...     : Ángulos gamma (Ng valores si Dg=0, else Ng calculados)
///  ...     : Valores de intensidad por plano C (Ng valores por plano)

use serde::{Deserialize, Serialize};

// ─── Estructuras públicas ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LdtLuminaireDimensions {
    pub length: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LdtData {
    pub is_valid: bool,

    // Metadatos
    pub company_name: String,
    pub luminaire_type: u8,   // Ityp: 0=punto, 1=lineal, 2=área, 3=circular
    pub symmetry: u8,          // Isym: 0-4
    pub measurement_report: String,
    pub luminaire_name: String,
    pub luminaire_number: String,
    pub filename: String,
    pub date_user: String,

    // Dimensiones
    pub luminaire_dimensions: LdtLuminaireDimensions,
    pub luminous_area: LdtLuminaireDimensions,
    pub downward_flux_fraction: f64,
    pub light_efficiency: f64,

    // Lámpara
    pub num_lamps: u32,
    pub lamp_type: String,
    pub total_lumens: f64,
    pub cct_k: Option<f64>,
    pub cri_ra: Option<f64>,
    pub power_watts: f64,

    // Web fotométrica
    pub num_c_planes: usize,
    pub c_plane_spacing: f64,
    pub num_gamma_angles: usize,
    pub gamma_spacing: f64,
    pub c_angles: Vec<f64>,
    pub gamma_angles: Vec<f64>,
    /// candela_values[c_index][gamma_index] en cd/klm
    pub candela_values: Vec<Vec<f64>>,

    // Derivados
    pub max_candela: f64,
    pub beam_angle_50: f64,
    pub beam_angle_10: f64,
    pub efficiency_lm_w: f64,
}

impl LdtData {
    /// Intensidad lumínica (cd) para ángulo C (phi) y gamma (theta), en grados.
    pub fn candela_at(&self, theta_deg: f64, phi_deg: f64) -> f64 {
        if self.candela_values.is_empty() { return 0.0; }

        let phi = self.normalize_c_angle(phi_deg);

        let (ci0, ci1, ct) = bracket(&self.c_angles, phi);
        let (gi0, gi1, gt) = bracket(&self.gamma_angles, theta_deg.max(0.0));

        let c00 = self.candela_values[ci0][gi0];
        let c10 = if ci1 < self.candela_values.len() { self.candela_values[ci1][gi0] } else { c00 };
        let c01 = if gi1 < self.candela_values[ci0].len() { self.candela_values[ci0][gi1] } else { c00 };
        let c11 = if ci1 < self.candela_values.len() && gi1 < self.candela_values[ci1].len() {
            self.candela_values[ci1][gi1]
        } else { c00 };

        let c0 = c00 + (c10 - c00) * ct;
        let c1 = c01 + (c11 - c01) * ct;

        // Escalar: los valores LDT son cd/klm, multiplicar por klm
        let scale = self.total_lumens / 1000.0;
        (c0 + (c1 - c0) * gt) * scale
    }

    fn normalize_c_angle(&self, phi_deg: f64) -> f64 {
        let phi = phi_deg.rem_euclid(360.0);
        match self.symmetry {
            0 => phi,              // Sin simetría, usar 0-360°
            1 => {                 // Simetría 0°-180°
                if phi <= 180.0 { phi } else { 360.0 - phi }
            }
            2 => {                 // Simetría 0°-90°
                let p = phi.rem_euclid(180.0);
                if p <= 90.0 { p } else { 180.0 - p }
            }
            3 => phi.min(90.0),   // Solo plano C0-C90
            4 => {                 // Simetría cuadrante
                phi.rem_euclid(90.0)
            }
            _ => phi,
        }
    }
}

// ─── Función de parse ─────────────────────────────────────────────────────────

pub fn parse_ldt(content: &str) -> Result<LdtData, String> {
    // Normalizar separadores decimales europeos
    let normalized = content.replace(',', ".");
    let lines: Vec<&str> = normalized.lines().collect();

    if lines.len() < 28 {
        return Err(format!("LDT: archivo demasiado corto ({} líneas)", lines.len()));
    }

    let get = |i: usize| lines.get(i).copied().unwrap_or("").trim();

    // Líneas de cabecera fijas
    let company_name = get(0).to_string();
    let luminaire_type = parse_u8(get(1), 0);
    let symmetry = parse_u8(get(2), 0);
    let num_c = parse_usize(get(3), 1);
    let dc = parse_f64(get(4), 0.0);
    let num_g = parse_usize(get(5), 1);
    let dg = parse_f64(get(6), 5.0);

    let measurement_report = get(7).to_string();
    let luminaire_name = get(8).to_string();
    let luminaire_number = get(9).to_string();
    let filename = get(10).to_string();
    let date_user = get(11).to_string();

    // Dimensiones de la luminaria (3 valores en la línea)
    let dim_lum = parse_triplet(get(12));
    let dim_area = parse_triplet(get(13));
    let downward_flux_fraction = parse_f64(get(14), 0.0);
    let light_efficiency = parse_f64(get(15), 0.0);

    // Línea 17 (idx 16): peso — ignorar
    // Líneas 18-27 (idx 17-26): DR1-DR10 — ignorar para fotometría básica
    let mut cursor = 27usize;

    // Número de lámparas (puede ser múltiple con repetición de bloque)
    // Formato: num_lamps \n lamp_type \n lumens \n cct \n cri \n watts
    let num_lamps = parse_u32(get(cursor), 1); cursor += 1;
    let lamp_type = get(cursor).to_string(); cursor += 1;
    let total_lumens = parse_f64(get(cursor), 1000.0) * 1000.0; // klm → lm
    cursor += 1;
    let cct_str = get(cursor).to_string(); cursor += 1;
    let cct_k = cct_str.parse::<f64>().ok();
    let cri_ra = parse_f64(get(cursor), 0.0).into_option(); cursor += 1;
    let power_watts = parse_f64(get(cursor), 0.0); cursor += 1;

    // Ángulos C
    let c_angles: Vec<f64> = if dc > 0.0 {
        // Equidistantes
        (0..num_c).map(|i| i as f64 * dc).collect()
    } else {
        // Leer Mc valores de líneas siguientes
        parse_angle_list(&lines, &mut cursor, num_c)
    };

    // Ángulos gamma
    let gamma_angles: Vec<f64> = if dg > 0.0 {
        (0..num_g).map(|i| i as f64 * dg).collect()
    } else {
        parse_angle_list(&lines, &mut cursor, num_g)
    };

    // Matriz de candelas: num_c planos × num_g ángulos gamma
    let mut candela_values: Vec<Vec<f64>> = Vec::with_capacity(num_c);
    let mut remaining_numbers: Vec<f64> = Vec::new();
    for i in cursor..lines.len() {
        for token in lines[i].split_whitespace() {
            if let Ok(v) = token.replace(',', ".").parse::<f64>() {
                remaining_numbers.push(v);
            }
        }
    }

    let mut ni = 0usize;
    for _ in 0..num_c {
        let end = ni + num_g;
        if end > remaining_numbers.len() {
            // Completar con ceros si hay datos incompletos
            let mut plane = remaining_numbers[ni..remaining_numbers.len().min(end)].to_vec();
            while plane.len() < num_g { plane.push(0.0); }
            candela_values.push(plane);
            break;
        }
        candela_values.push(remaining_numbers[ni..end].to_vec());
        ni += num_g;
    }

    // Asegurar que tenemos todos los planos C
    while candela_values.len() < num_c {
        candela_values.push(vec![0.0; num_g]);
    }

    // Máximo de candelas (escalado a cd absoluto)
    let scale = total_lumens / 1000.0;
    let max_candela = candela_values
        .iter()
        .flat_map(|p| p.iter())
        .cloned()
        .fold(0.0_f64, f64::max) * scale;

    let (beam_50, beam_10) = compute_beam_angles_ldt(
        &candela_values[0],
        &gamma_angles,
        if scale > 0.0 { max_candela / scale } else { 0.0 },
    );

    let efficiency_lm_w = if power_watts > 0.0 { total_lumens / power_watts } else { 0.0 };

    Ok(LdtData {
        is_valid: true,
        company_name,
        luminaire_type,
        symmetry,
        num_c_planes: num_c,
        c_plane_spacing: dc,
        num_gamma_angles: num_g,
        gamma_spacing: dg,
        measurement_report,
        luminaire_name,
        luminaire_number,
        filename,
        date_user,
        luminaire_dimensions: LdtLuminaireDimensions {
            length: dim_lum.0,
            width: dim_lum.1,
            height: dim_lum.2,
        },
        luminous_area: LdtLuminaireDimensions {
            length: dim_area.0,
            width: dim_area.1,
            height: dim_area.2,
        },
        downward_flux_fraction,
        light_efficiency,
        num_lamps,
        lamp_type,
        total_lumens,
        cct_k,
        cri_ra,
        power_watts,
        c_angles,
        gamma_angles,
        candela_values,
        max_candela,
        beam_angle_50: beam_50,
        beam_angle_10: beam_10,
        efficiency_lm_w,
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn parse_u8(s: &str, default: u8) -> u8 {
    s.split_whitespace().next().and_then(|t| t.parse().ok()).unwrap_or(default)
}

fn parse_u32(s: &str, default: u32) -> u32 {
    s.split_whitespace().next().and_then(|t| t.parse().ok()).unwrap_or(default)
}

fn parse_usize(s: &str, default: usize) -> usize {
    s.split_whitespace().next().and_then(|t| t.parse().ok()).unwrap_or(default)
}

fn parse_f64(s: &str, default: f64) -> f64 {
    s.split_whitespace().next().and_then(|t| t.replace(',', ".").parse().ok()).unwrap_or(default)
}

fn parse_triplet(s: &str) -> (f64, f64, f64) {
    let parts: Vec<f64> = s.split_whitespace()
        .filter_map(|t| t.replace(',', ".").parse().ok())
        .collect();
    (
        parts.get(0).copied().unwrap_or(0.0),
        parts.get(1).copied().unwrap_or(0.0),
        parts.get(2).copied().unwrap_or(0.0),
    )
}

fn parse_angle_list(lines: &[&str], cursor: &mut usize, count: usize) -> Vec<f64> {
    let mut result = Vec::with_capacity(count);
    while result.len() < count && *cursor < lines.len() {
        for token in lines[*cursor].split_whitespace() {
            if result.len() >= count { break; }
            if let Ok(v) = token.replace(',', ".").parse::<f64>() {
                result.push(v);
            }
        }
        *cursor += 1;
    }
    result
}

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

fn compute_beam_angles_ldt(c0: &[f64], g_angles: &[f64], max_cd: f64) -> (f64, f64) {
    if max_cd <= 0.0 { return (0.0, 0.0); }
    let mut b50 = 0.0f64;
    let mut b10 = 0.0f64;
    for (i, &angle) in g_angles.iter().enumerate() {
        let ratio = c0.get(i).copied().unwrap_or(0.0) / max_cd;
        if ratio >= 0.5 { b50 = b50.max(angle); }
        if ratio >= 0.1 { b10 = b10.max(angle); }
    }
    (b50, b10)
}

trait IntoOption {
    fn into_option(self) -> Option<f64>;
}
impl IntoOption for f64 {
    fn into_option(self) -> Option<f64> {
        if self > 0.0 { Some(self) } else { None }
    }
}
