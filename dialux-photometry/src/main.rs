use std::{env, fs, path::Path, process};

#[derive(Default)]
struct ParsedProduct {
    name: Option<String>,
    manufacturer: Option<String>,
    catalog_number: Option<String>,
    article_number: Option<String>,
    description: Option<String>,
    total_lumens: Option<f64>,
    power_watts: Option<f64>,
    cct: Option<String>,
    cri_ra: Option<f64>,
    beam_angle_50: Option<f64>,
    beam_angle_10: Option<f64>,
    max_candela: Option<f64>,
    format_version: String,
    c_angles: Vec<f64>,
    gamma_angles: Vec<f64>,
    candela: Vec<Vec<f64>>,
    warnings: Vec<String>,
}

fn main() {
    let path = match env::args().nth(1) {
        Some(path) => path,
        None => fail("missing_file", "Usage: dialux-photometry <file>"),
    };

    let content = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(err) => fail("read_failed", &err.to_string()),
    };

    let extension = Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let parsed = match extension.as_str() {
        "ies" => parse_ies(&String::from_utf8_lossy(&content)),
        "ldt" => parse_ldt(&String::from_utf8_lossy(&content)),
        "gldf" | "xml" => parse_gldf(&String::from_utf8_lossy(&content)),
        _ => {
            let mut product = ParsedProduct::default();
            product.name = Path::new(&path)
                .file_stem()
                .and_then(|value| value.to_str())
                .map(String::from);
            product.format_version = "manual".to_string();
            product.warnings.push("Formato no soportado por Rust".to_string());
            product
        }
    };

    println!("{}", to_json(&parsed));
}

fn fail(code: &str, message: &str) -> ! {
    eprintln!(
        "{{\"error\":\"{}\",\"message\":\"{}\"}}",
        json_escape(code),
        json_escape(message)
    );
    process::exit(1);
}

fn parse_ies(content: &str) -> ParsedProduct {
    let normalized = content.replace('\r', "");
    let lines: Vec<&str> = normalized.lines().collect();
    let mut product = ParsedProduct::default();
    product.format_version = "IESNA:LM-63".to_string();
    let mut index = 0usize;

    if let Some(first) = lines.first() {
        if first.trim().starts_with("IESNA") {
            product.format_version = first.trim().to_string();
            index = 1;
        }
    }

    while index < lines.len() {
        let line = lines[index].trim();
        if line.starts_with("TILT") {
            break;
        }

        if let Some((key, value)) = read_ies_keyword(line) {
            match key.as_str() {
                "MANUFAC" => product.manufacturer = Some(value),
                "LUMCAT" => product.catalog_number = Some(value),
                "LUMINAIRE" => product.name = Some(value),
                "WATTS" | "WATTAGE" => product.power_watts = parse_number(&value),
                "CCT" => product.cct = Some(value),
                "CRI" => product.cri_ra = parse_number(&value),
                _ => {}
            }
        }

        index += 1;
    }

    index += 1;
    let numbers = collect_numbers(&lines[index..].join("\n"));
    if numbers.len() < 10 {
        product.warnings.push("IES: datos insuficientes".to_string());
        return product;
    }

    let num_lamps = numbers[0].max(1.0);
    let lumens_per_lamp = numbers[1];
    let multiplier = numbers[2];
    let num_v = numbers[3].max(1.0) as usize;
    let num_h = numbers[4].max(1.0) as usize;
    let mut cursor = 10usize;

    product.gamma_angles = numbers.get(cursor..cursor + num_v).unwrap_or(&[]).to_vec();
    cursor += num_v;
    product.c_angles = numbers.get(cursor..cursor + num_h).unwrap_or(&[]).to_vec();
    cursor += num_h;

    for _ in 0..num_h {
        let mut plane = numbers.get(cursor..cursor + num_v).unwrap_or(&[]).to_vec();
        for value in &mut plane {
            *value *= multiplier;
        }
        while plane.len() < num_v {
            plane.push(0.0);
        }
        product.candela.push(plane);
        cursor += num_v;
    }

    product.total_lumens = if lumens_per_lamp > 0.0 {
        Some(round1(lumens_per_lamp * num_lamps))
    } else {
        None
    };
    finish_metrics(product)
}

fn parse_ldt(content: &str) -> ParsedProduct {
    let normalized = content.replace('\r', "").replace(',', ".");
    let lines: Vec<&str> = normalized.lines().collect();
    let mut product = ParsedProduct::default();
    product.format_version = "EULUMDAT".to_string();

    if lines.len() < 33 {
        product.warnings.push("LDT: archivo demasiado corto".to_string());
    }

    let get = |index: usize| lines.get(index).map(|line| line.trim()).unwrap_or("");
    product.manufacturer = non_empty(get(0));
    let num_c = parse_number(get(3)).unwrap_or(1.0).max(1.0) as usize;
    let dc = parse_number(get(4)).unwrap_or(0.0);
    let num_g = parse_number(get(5)).unwrap_or(1.0).max(1.0) as usize;
    let dg = parse_number(get(6)).unwrap_or(0.0);
    product.name = non_empty(get(8));
    product.catalog_number = non_empty(get(9));

    let mut cursor = 27usize;
    let lamp_count = if parse_number(get(cursor)).is_some() {
        let count = parse_number(get(cursor)).unwrap_or(1.0).max(1.0);
        cursor += 2;
        count
    } else {
        cursor += 1;
        1.0
    };
    product.total_lumens = parse_number(get(cursor)).map(|value| round1(normalize_ldt_lumens(value, lamp_count)));
    cursor += 1;
    product.cct = parse_number(get(cursor)).map(|value| format!("{}K", trim_float(value)));
    cursor += 1;
    product.cri_ra = parse_number(get(cursor)).filter(|value| *value > 0.0);
    cursor += 1;
    product.power_watts = parse_number(get(cursor)).filter(|value| *value > 0.0);
    cursor += 1;

    let tokens = collect_numbers(&lines[cursor..].join("\n"));
    let (c_angles, gamma_angles, remaining) = extract_ldt_angles_and_candela_tokens(tokens, num_c, dc, num_g, dg);
    product.c_angles = c_angles;
    product.gamma_angles = gamma_angles;

    let scale = product.total_lumens.unwrap_or(1000.0) / 1000.0;
    let mut offset = 0usize;
    let plane_count = (remaining.len() / num_g).clamp(1, num_c);
    for _ in 0..plane_count {
        let mut plane = remaining.get(offset..offset + num_g).unwrap_or(&[]).to_vec();
        for value in &mut plane {
            *value *= scale;
        }
        while plane.len() < num_g {
            plane.push(0.0);
        }
        product.candela.push(plane);
        offset += num_g;
    }

    finish_metrics(product)
}

fn parse_gldf(content: &str) -> ParsedProduct {
    let mut product = ParsedProduct::default();
    product.format_version = "GLDF".to_string();
    product.name = xml_text(content, "Name").or_else(|| Some("Producto GLDF".to_string()));
    product.manufacturer = xml_text(content, "Manufacturer");
    product.article_number = xml_text(content, "ArticleNumber");
    product.description = xml_text(content, "Description");
    product.total_lumens = xml_text(content, "Flux")
        .or_else(|| xml_text(content, "TotalFlux"))
        .and_then(|value| parse_number(&value));
    product.power_watts = xml_text(content, "Wattage")
        .or_else(|| xml_text(content, "Power"))
        .and_then(|value| parse_number(&value));
    product.cct = xml_text(content, "ColorTemperature").or_else(|| xml_text(content, "CCT"));
    product.cri_ra = xml_text(content, "CRI")
        .or_else(|| xml_text(content, "Ra"))
        .and_then(|value| parse_number(&value));
    product
}

fn finish_metrics(mut product: ParsedProduct) -> ParsedProduct {
    let max_candela = product
        .candela
        .iter()
        .flatten()
        .copied()
        .fold(0.0_f64, f64::max);
    product.max_candela = if max_candela > 0.0 { Some(round1(max_candela)) } else { None };

    if let Some(first_plane) = product.candela.first() {
        let (beam50, beam10) = compute_beam_angles(first_plane, &product.gamma_angles, max_candela);
        product.beam_angle_50 = Some(round1(beam50));
        product.beam_angle_10 = Some(round1(beam10));
    }

    product
}

fn compute_beam_angles(plane: &[f64], angles: &[f64], max_candela: f64) -> (f64, f64) {
    if max_candela <= 0.0 {
        return (0.0, 0.0);
    }

    let mut beam50 = 0.0;
    let mut beam10 = 0.0;
    for (index, candela) in plane.iter().enumerate() {
        let angle = *angles.get(index).unwrap_or(&(index as f64));
        let ratio = *candela / max_candela;
        if ratio >= 0.5 {
            beam50 = angle.max(beam50);
        }
        if ratio >= 0.1 {
            beam10 = angle.max(beam10);
        }
    }

    (beam50, beam10)
}

fn to_json(product: &ParsedProduct) -> String {
    let efficiency = match (product.total_lumens, product.power_watts) {
        (Some(lumens), Some(watts)) if watts > 0.0 => Some(round1(lumens / watts)),
        _ => None,
    };

    let technical_table = [
        ("Fabricante", product.manufacturer.as_deref().unwrap_or("Importado").to_string()),
        ("Producto", product.name.as_deref().unwrap_or("Producto").to_string()),
        ("Codigo", product.catalog_number.as_deref().or(product.article_number.as_deref()).unwrap_or("-").to_string()),
        ("P", product.power_watts.map(|v| format!("{} W", trim_float(v))).unwrap_or_else(|| "-".to_string())),
        ("Flujo luminoso", product.total_lumens.map(|v| format!("{} lm", trim_float(v))).unwrap_or_else(|| "-".to_string())),
        ("Rendimiento", efficiency.map(|v| format!("{} lm/W", trim_float(v))).unwrap_or_else(|| "-".to_string())),
        ("CCT", product.cct.as_deref().unwrap_or("-").to_string()),
        ("CRI", product.cri_ra.map(trim_float).unwrap_or_else(|| "-".to_string())),
    ];

    format!(
        "{{{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}\"photometric_summary\":{{\"format_version\":\"{}\",\"total_lumens\":{},\"max_candela\":{},\"beam_angle_50\":{},\"beam_angle_10\":{},\"efficiency_lm_w\":{}}},\"photometric_web\":{{\"c_angles\":{},\"gamma_angles\":{},\"candela\":{}}},\"report_data\":{{\"version\":\"1.0\",\"technical_table\":[{}],\"warnings\":{}}},\"metadata\":{{\"parser\":\"rust\",\"format_version\":\"{}\"}},\"warnings\":{}}}",
        field_str("name", &product.name),
        field_str("manufacturer", &product.manufacturer),
        field_str("catalog_number", &product.catalog_number),
        field_str("article_number", &product.article_number),
        field_str("description", &product.description),
        field_num("total_lumens", product.total_lumens),
        field_num("power_watts", product.power_watts),
        field_str("cct", &product.cct),
        field_num("cri_ra", product.cri_ra),
        field_num("beam_angle_50", product.beam_angle_50),
        field_num("beam_angle_10", product.beam_angle_10),
        field_num("max_candela", product.max_candela),
        "",
        "",
        "",
        "",
        json_escape(&product.format_version),
        json_num(product.total_lumens),
        json_num(product.max_candela),
        json_num(product.beam_angle_50),
        json_num(product.beam_angle_10),
        json_num(efficiency),
        json_vec(&product.c_angles),
        json_vec(&product.gamma_angles),
        json_matrix(&product.candela),
        technical_table
            .iter()
            .map(|(label, value)| format!("{{\"label\":\"{}\",\"value\":\"{}\"}}", json_escape(label), json_escape(value)))
            .collect::<Vec<String>>()
            .join(","),
        json_string_vec(&product.warnings),
        json_escape(&product.format_version),
        json_string_vec(&product.warnings),
    )
}

fn field_str(key: &str, value: &Option<String>) -> String {
    value
        .as_ref()
        .map(|value| format!("\"{}\":\"{}\",", key, json_escape(value)))
        .unwrap_or_default()
}

fn field_num(key: &str, value: Option<f64>) -> String {
    value
        .map(|value| format!("\"{}\":{},", key, trim_float(value)))
        .unwrap_or_default()
}

fn json_num(value: Option<f64>) -> String {
    value.map(trim_float).unwrap_or_else(|| "null".to_string())
}

fn json_vec(values: &[f64]) -> String {
    format!(
        "[{}]",
        values.iter().map(|value| trim_float(*value)).collect::<Vec<String>>().join(",")
    )
}

fn json_matrix(rows: &[Vec<f64>]) -> String {
    format!(
        "[{}]",
        rows.iter().map(|row| json_vec(row)).collect::<Vec<String>>().join(",")
    )
}

fn json_string_vec(values: &[String]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|value| format!("\"{}\"", json_escape(value)))
            .collect::<Vec<String>>()
            .join(",")
    )
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn trim_float(value: f64) -> String {
    if value.fract().abs() < 0.000_001 {
        format!("{}", value.round() as i64)
    } else {
        format!("{:.3}", value).trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn normalize_ldt_lumens(raw_lumens: f64, lamp_count: f64) -> f64 {
    if raw_lumens <= 0.0 {
        return 0.0;
    }

    let lumens = if raw_lumens < 100.0 {
        raw_lumens * 1000.0
    } else {
        raw_lumens
    };

    lumens * lamp_count.max(1.0)
}

fn extract_ldt_angles_and_candela_tokens(
    mut tokens: Vec<f64>,
    num_c: usize,
    dc: f64,
    num_g: usize,
    dg: f64,
) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let mut c_angles = if dc > 0.0 {
        (0..num_c).map(|index| index as f64 * dc).collect()
    } else {
        Vec::new()
    };
    let mut gamma_angles = if dg > 0.0 {
        (0..num_g).map(|index| index as f64 * dg).collect()
    } else {
        Vec::new()
    };

    if dc <= 0.0 && tokens.len() >= num_c {
        c_angles = tokens.drain(0..num_c).collect();
    }

    if dg <= 0.0 && tokens.len() >= num_g {
        gamma_angles = tokens.drain(0..num_g).collect();
    }

    if dc > 0.0 && dg > 0.0 {
        let limit = tokens.len().saturating_sub(num_c + num_g).min(32);
        for offset in 0..=limit {
            let c_end = offset + num_c;
            let g_end = c_end + num_g;
            let candidate_c = &tokens[offset..c_end];
            let candidate_g = &tokens[c_end..g_end];

            if is_expected_angle_list(candidate_c, num_c, dc)
                && is_expected_angle_list(candidate_g, num_g, dg)
            {
                return (
                    candidate_c.to_vec(),
                    candidate_g.to_vec(),
                    tokens[g_end..].to_vec(),
                );
            }
        }
    }

    (c_angles, gamma_angles, tokens)
}

fn is_expected_angle_list(values: &[f64], count: usize, step: f64) -> bool {
    if values.len() != count || step <= 0.0 {
        return false;
    }

    values
        .iter()
        .enumerate()
        .all(|(index, value)| (*value - (index as f64 * step)).abs() <= 0.01)
}

fn parse_number(value: &str) -> Option<f64> {
    value.trim().replace(',', ".").parse::<f64>().ok()
}

fn collect_numbers(content: &str) -> Vec<f64> {
    content
        .split(|character: char| character.is_whitespace() || character == ',')
        .filter_map(parse_number)
        .collect()
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn read_ies_keyword(line: &str) -> Option<(String, String)> {
    let close = line.find(']')?;
    let key = line.get(1..close)?.trim().to_ascii_uppercase();
    let value = line.get(close + 1..)?.trim().to_string();
    Some((key, value))
}

fn xml_text(xml: &str, tag: &str) -> Option<String> {
    let start_tag = format!("<{}", tag);
    let start = xml.find(&start_tag)?;
    let content_start = xml[start..].find('>')? + start + 1;
    let end_tag = format!("</{}>", tag);
    let end = xml[content_start..].find(&end_tag)? + content_start;
    non_empty(&xml[content_start..end])
}
