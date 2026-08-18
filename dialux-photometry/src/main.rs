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
    /// Código de simetría EULUMDAT (Isym, línea 3 / índice 2) — solo LDT.
    /// Ausente (`None`) para IES/GLDF, que no declaran este campo.
    symmetry: Option<i64>,
    /// Ityp EULUMDAT (línea 2 / índice 1): 1=punto rotacionalmente simétrico,
    /// 2=lineal, 3=no puntual no rotacionalmente simétrico — la "forma" de la
    /// luminaria que el usuario necesita ver en el modal de previsualización.
    /// Solo LDT; IES no declara un campo equivalente.
    luminaire_type: Option<u8>,
    /// Largo/ancho/alto de la CARCASA física de la luminaria, en metros.
    /// LDT: líneas 13/14/15 (verificado contra la especificación oficial
    /// DIALux/AGI32 y contra archivos reales de EMOS/LEDVANCE/Thorlux — NO
    /// van en una sola línea con 3 valores, son 3 líneas separadas). IES:
    /// campos 8/9/10 del encabezado numérico (ancho/largo/alto).
    dimensions: Option<(f64, f64, f64)>,
    /// Largo/ancho del ÁREA LUMINOSA (la parte que realmente emite luz, no
    /// la carcasa completa) — LDT líneas 16/17. Distinto de `dimensions`.
    luminous_opening_length_width: Option<(f64, f64)>,
    /// Alturas del área luminosa en los 4 planos C0/C90/C180/C270 (LDT
    /// líneas 18-21) — 0 para luminarias rotacionalmente simétricas (solo
    /// declaran C0, el resto queda en 0). Necesario para calcular el ángulo
    /// sólido aparente real en UGR de luminarias no simétricas.
    luminous_opening_heights: Option<[f64; 4]>,
    /// DFF% — fracción del flujo total que sale hacia abajo (LDT línea 22).
    downward_flux_fraction_pct: Option<f64>,
    /// LORL% — relación de salida luminosa de la luminaria completa vs. la
    /// lámpara desnuda (LDT línea 23, "Light Output Ratio Luminaire").
    light_output_ratio_pct: Option<f64>,
    /// Factor de conversión de intensidades luminosas (LDT línea 24) — casi
    /// siempre 1.0; se conserva tal cual lo declara el archivo.
    conversion_factor: Option<f64>,
    /// Ángulo de inclinación durante la medición, en grados (LDT línea 25)
    /// — relevante para luminarias viales/orientables.
    tilt_deg: Option<f64>,
    /// Factores de reducción DR1-DR10 (relación de flujo directo del
    /// semiespacio superior para k=0.6...5.0, LITG 1988) — LDT, después del
    /// bloque de lámparas. Se usan para tablas de coeficiente de utilización
    /// (CU); el motor de cálculo de este proyecto NO los consume todavía.
    direct_ratios: Vec<f64>,
    /// Descripción de la lámpara tal como la declara el archivo (LDT: línea
    /// 28, después de `num_lamps`; ej. "14W LED") — DISTINTA de
    /// `power_watts` ("Connected power", la potencia de la luminaria
    /// COMPLETA incluida cualquier driver/balasto). Confundir ambas es lo
    /// que produce la sensación de "la potencia no cuadra" cuando en
    /// realidad son dos magnitudes distintas del mismo archivo — el LDT
    /// Editor de DIALux las muestra como filas separadas ("Type of lamps" /
    /// "Connected power") y este parser hacía lo mismo del lado PHP, pero
    /// nunca se había agregado aquí (Rust es el parser que realmente corre
    /// en producción cuando el binario está compilado).
    lamp_type: Option<String>,
    /// "Number of lamps" del bloque de lámpara (LDT: primer valor tras el
    /// número de sets; solo se guarda cuando el archivo lo declara como
    /// conteo real positivo — igual criterio que `lamp_count` para el
    /// escalado de flujo, mismo campo que ya existía informalmente).
    num_lamps: Option<u32>,
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
            // TILT=INCLUDE antepone una tabla de geometria/angulos/multiplicadores
            // (LM-63 Sec.2.2) antes de los datos fotometricos; este parser rapido
            // no la reconoce y, sin este chequeo, leia esos numeros como si fueran
            // el encabezado fotometrico (num_lamps, lumens_per_lamp, ...),
            // corrompiendo el flujo total. El fallback PHP si soporta TILT=INCLUDE
            // completo (tabla de tilt registrada en metadata) — declinar aqui deja
            // que ese camino, ya correcto, se haga cargo.
            let tilt_value = line.splitn(2, '=').nth(1).unwrap_or("").trim().to_ascii_uppercase();
            if tilt_value == "INCLUDE" {
                fail(
                    "tilt_include_unsupported",
                    "TILT=INCLUDE requiere el parser PHP (tabla de tilt no soportada en Rust todavia)",
                );
            }
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
                "LAMP" | "LAMPCAT" => product.lamp_type = Some(value),
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
    // IESNA LM-63: tras num_v/num_h vienen tipo fotométrico, tipo de
    // unidades (pies/metros) y ancho/largo/alto de la abertura luminosa —
    // en ese orden exacto (verificado contra la misma convención que ya usa
    // `dialux-core/src/ies_parser.rs`). Sin convertir a metros aquí si
    // `unitsType`=1 (pies) — LM-63 declara pies como unidad, no metros;
    // dejar la conversión pendiente en vez de asumir metros silenciosamente
    // sería peor que no reportar, así que solo se guarda si ya está en
    // metros (unitsType=2) o si no se puede determinar (se advierte).
    let units_type = numbers.get(6).copied();
    let lum_width = numbers.get(7).copied().unwrap_or(0.0);
    let lum_length = numbers.get(8).copied().unwrap_or(0.0);
    let lum_height = numbers.get(9).copied().unwrap_or(0.0);
    if lum_width != 0.0 || lum_length != 0.0 || lum_height != 0.0 {
        match units_type {
            Some(2.0) => {
                product.dimensions = Some((lum_length.abs(), lum_width.abs(), lum_height.abs()));
            }
            Some(1.0) => {
                const FEET_TO_METERS: f64 = 0.3048;
                product.dimensions = Some((
                    lum_length.abs() * FEET_TO_METERS,
                    lum_width.abs() * FEET_TO_METERS,
                    lum_height.abs() * FEET_TO_METERS,
                ));
            }
            _ => {
                product.warnings.push(
                    "IES: dimensiones declaradas pero el tipo de unidades (pies/metros) no se pudo determinar — se omiten para no asumir la unidad equivocada.".to_string(),
                );
            }
        }
    }
    let mut cursor = 10usize;

    product.gamma_angles = slice_partial(&numbers, cursor, num_v);
    cursor += num_v;
    product.c_angles = slice_partial(&numbers, cursor, num_h);
    cursor += num_h;

    // Sin relleno artificial: un plano mas corto que `num_v` (archivo
    // truncado/malformado) debe llegar tal cual a PHP para que su propia
    // validacion de dimensiones lo detecte y avise — rellenar con ceros acá
    // ocultaria la corrupcion en vez de señalarla.
    for _ in 0..num_h {
        let mut plane = slice_partial(&numbers, cursor, num_v);
        for value in &mut plane {
            *value *= multiplier;
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
    // Algunos archivos LDT reales (ej. exportados por LDT Editor) empiezan
    // con el BOM UTF-8 (U+FEFF) — `str::trim()` no lo considera espacio, así
    // que sin esto quedaba pegado al inicio de `manufacturer` (confirmado
    // con un archivo real de EMOS: "\u{FEFF}EMOS" en vez de "EMOS").
    let content = content.trim_start_matches('\u{FEFF}');
    let normalized = content.replace('\r', "").replace(',', ".");
    let lines: Vec<&str> = normalized.lines().collect();
    let mut product = ParsedProduct::default();
    product.format_version = "EULUMDAT".to_string();

    if lines.len() < 33 {
        product.warnings.push("LDT: archivo demasiado corto".to_string());
    }

    let get = |index: usize| lines.get(index).map(|line| line.trim()).unwrap_or("");
    product.manufacturer = non_empty(get(0));
    // Ityp (línea 2 / índice 1) — 1=punto rotacionalmente simétrico,
    // 2=lineal, 3=no puntual no rotacionalmente simétrico. La "forma" de la
    // luminaria (no confundir con `symmetry`/Isym, la simetría angular).
    product.luminaire_type = parse_number(get(1)).map(|value| value as u8);
    // Isym (código de simetría EULUMDAT, línea 3 / índice 2) — se conserva
    // tal cual el archivo lo declara, igual que el parser PHP.
    product.symmetry = parse_number(get(2)).map(|value| value as i64);
    let num_c = parse_number(get(3)).unwrap_or(1.0).max(1.0) as usize;
    let dc = parse_number(get(4)).unwrap_or(0.0);
    let num_g = parse_number(get(5)).unwrap_or(1.0).max(1.0) as usize;
    let dg = parse_number(get(6)).unwrap_or(0.0);
    product.name = non_empty(get(8));
    product.catalog_number = non_empty(get(9));

    // Líneas 13-25 (índices 12-24), especificación EULUMDAT oficial
    // verificada contra DIALux (evo.support-en.dial.de) y AGI32
    // (docs.agi32.com), y contra archivos reales de EMOS/LEDVANCE/Thorlux:
    // CADA valor va en su PROPIA línea — nunca 3 valores en una sola línea
    // separados por espacio (ese formato es de IES, no de EULUMDAT).
    let lum_length = parse_number(get(12)).unwrap_or(0.0) / 1000.0;
    let lum_width = parse_number(get(13)).unwrap_or(0.0) / 1000.0;
    let lum_height = parse_number(get(14)).unwrap_or(0.0) / 1000.0;
    if lum_length > 0.0 || lum_width > 0.0 || lum_height > 0.0 {
        product.dimensions = Some((lum_length, lum_width, lum_height));
    }
    let area_length = parse_number(get(15)).unwrap_or(0.0) / 1000.0;
    let area_width = parse_number(get(16)).unwrap_or(0.0) / 1000.0;
    if area_length > 0.0 || area_width > 0.0 {
        product.luminous_opening_length_width = Some((area_length, area_width));
    }
    let area_heights = [
        parse_number(get(17)).unwrap_or(0.0) / 1000.0,
        parse_number(get(18)).unwrap_or(0.0) / 1000.0,
        parse_number(get(19)).unwrap_or(0.0) / 1000.0,
        parse_number(get(20)).unwrap_or(0.0) / 1000.0,
    ];
    if area_heights.iter().any(|value| *value > 0.0) {
        product.luminous_opening_heights = Some(area_heights);
    }
    product.downward_flux_fraction_pct = parse_number(get(21));
    product.light_output_ratio_pct = parse_number(get(22));
    product.conversion_factor = parse_number(get(23));
    product.tilt_deg = parse_number(get(24));

    // EULUMDAT: número de lámparas del primer set (línea 27, 1-indexada — no
    // la 28, que es el tipo de lámpara). El signo importa: positivo = el
    // flujo declarado es POR lámpara (hay que multiplicar); negativo = el
    // flujo declarado ya es el TOTAL del conjunto (no multiplicar, el valor
    // absoluto es solo informativo). Verificado contra 8 archivos LDT reales
    // subidos por usuarios — uno declara "-2" (2 lámparas, flujo ya total);
    // multiplicar por 2 ahí habría duplicado el flujo importado.
    //
    // Línea 26 (índice 25) es el NÚMERO DE SETS de lámparas declarados —
    // casi siempre 1. Este parser solo usa los datos del primer set (mismo
    // alcance que el parser PHP de respaldo); para archivos con más de un
    // set SÍ avanza el cursor lo suficiente para no corromper la búsqueda
    // de ángulos/candela que viene después, aunque no sume el flujo de los
    // sets adicionales.
    let num_lamp_sets = parse_number(get(25)).unwrap_or(1.0).max(1.0) as usize;
    let mut cursor = 26usize;
    let raw_lamp_field = parse_number(get(cursor));
    let lamp_count = match raw_lamp_field {
        Some(count) if count > 0.0 => count,
        _ => 1.0,
    };
    if let Some(count) = raw_lamp_field {
        if count > 0.0 {
            product.num_lamps = Some(count as u32);
        }
    }
    // Si `get(cursor)` es numérico, es el conteo de lámparas y el tipo vive
    // en la línea SIGUIENTE; si no lo es (archivo sin conteo explícito), la
    // línea actual YA es el tipo. Mismo criterio que el parser PHP de
    // respaldo — ambos deben capturar exactamente el mismo texto para el
    // mismo archivo.
    if raw_lamp_field.is_some() {
        cursor += 1;
    }
    product.lamp_type = non_empty(get(cursor));
    cursor += 1;
    product.total_lumens = parse_number(get(cursor)).map(|value| round1(normalize_ldt_lumens(value, lamp_count)));
    cursor += 1;
    product.cct = parse_number(get(cursor)).map(|value| format!("{}K", trim_float(value)));
    cursor += 1;
    product.cri_ra = parse_number(get(cursor)).filter(|value| *value > 0.0);
    cursor += 1;
    product.power_watts = parse_number(get(cursor)).filter(|value| *value > 0.0);
    cursor += 1;
    // Sets adicionales (raro): cada uno son 6 líneas más (num_lamps, tipo,
    // lumens, cct, cri, watts) que no se leen individualmente pero sí hay
    // que saltar para que el cursor llegue al lugar correcto para DR1-10 y
    // los ángulos.
    cursor += (num_lamp_sets.saturating_sub(1)) * 6;

    let tokens = collect_numbers(&lines[cursor..].join("\n"));
    let (c_angles, gamma_angles, direct_ratios, remaining) = extract_ldt_angles_and_candela_tokens(tokens, num_c, dc, num_g, dg);
    product.c_angles = c_angles;
    product.gamma_angles = gamma_angles;
    product.direct_ratios = direct_ratios;

    let scale = product.total_lumens.unwrap_or(1000.0) / 1000.0;
    let mut offset = 0usize;
    let plane_count = (remaining.len() / num_g).clamp(1, num_c);
    for _ in 0..plane_count {
        let mut plane = slice_partial(&remaining, offset, num_g);
        for value in &mut plane {
            *value *= scale;
        }
        product.candela.push(plane);
        offset += num_g;
    }

    // `product.c_angles` sale de `extract_ldt_angles_and_candela_tokens` con
    // `num_c` entradas siempre (equidistante o lista explícita), pero una
    // luminaria simétrica solo publica `plane_count` planos reales (el resto
    // se completa por reflejo en el consumidor). Sin truncar aquí, PHP
    // guarda `c_angles.len() != candela.len()` en `photometric_web`, y el
    // JS consumidor (`candelaFromPhotometricWeb`, que asume `c_angles[i]` ↔
    // `candela[i]` 1 a 1) indexa `candela[i]` fuera de rango para cualquier
    // plano C más allá de `plane_count` → `undefined` sin fallback posible
    // (crash en `interpolate1D`, no una interpolación degradada). Mismo fix
    // que ya tiene el parser PHP de respaldo (`ProductImportService::parseLdt`).
    if plane_count < product.c_angles.len() {
        product.c_angles.truncate(plane_count);
        product.warnings.push(format!(
            "LDT: el archivo declara {} planos C pero solo trae {} — esperable para una luminaria simétrica, el resto se completa por reflejo.",
            num_c, plane_count,
        ));
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

    // Ensamblado por fragmentos "clave":valor en vez de un único `format!`
    // con decenas de placeholders posicionales — el enfoque anterior ya
    // tenía 4 placeholders vacíos sin usar (reservados y olvidados en algún
    // cambio previo), exactamente el tipo de fragilidad que agregar más
    // campos (dimensiones, área luminosa, DFF/LORL/DR1-10) iba a empeorar.
    let mut fields: Vec<String> = Vec::new();
    push_field_str(&mut fields, "name", &product.name);
    push_field_str(&mut fields, "manufacturer", &product.manufacturer);
    push_field_str(&mut fields, "catalog_number", &product.catalog_number);
    push_field_str(&mut fields, "article_number", &product.article_number);
    push_field_str(&mut fields, "description", &product.description);
    push_field_num(&mut fields, "total_lumens", product.total_lumens);
    push_field_num(&mut fields, "power_watts", product.power_watts);
    push_field_str(&mut fields, "cct", &product.cct);
    push_field_num(&mut fields, "cri_ra", product.cri_ra);
    push_field_num(&mut fields, "beam_angle_50", product.beam_angle_50);
    push_field_num(&mut fields, "beam_angle_10", product.beam_angle_10);
    push_field_num(&mut fields, "max_candela", product.max_candela);

    if let Some((length, width, height)) = product.dimensions {
        fields.push(format!(
            "\"dimensions\":{{\"length\":{},\"width\":{},\"height\":{}}}",
            trim_float(length), trim_float(width), trim_float(height),
        ));
    }
    if product.luminous_opening_length_width.is_some() || product.luminous_opening_heights.is_some() {
        let (area_l, area_w) = product.luminous_opening_length_width.unwrap_or((0.0, 0.0));
        let heights = product.luminous_opening_heights.unwrap_or([0.0; 4]);
        fields.push(format!(
            "\"luminous_opening\":{{\"length\":{},\"width\":{},\"height_c0\":{},\"height_c90\":{},\"height_c180\":{},\"height_c270\":{}}}",
            trim_float(area_l), trim_float(area_w),
            trim_float(heights[0]), trim_float(heights[1]), trim_float(heights[2]), trim_float(heights[3]),
        ));
    }

    fields.push(format!(
        "\"photometric_summary\":{{\"format_version\":\"{}\",\"total_lumens\":{},\"max_candela\":{},\"beam_angle_50\":{},\"beam_angle_10\":{},\"efficiency_lm_w\":{}}}",
        json_escape(&product.format_version),
        json_num(product.total_lumens),
        json_num(product.max_candela),
        json_num(product.beam_angle_50),
        json_num(product.beam_angle_10),
        json_num(efficiency),
    ));
    fields.push(format!(
        "\"photometric_web\":{{\"c_angles\":{},\"gamma_angles\":{},\"candela\":{},\"symmetry\":{}}}",
        json_vec(&product.c_angles),
        json_vec(&product.gamma_angles),
        json_matrix(&product.candela),
        json_opt_int(product.symmetry),
    ));
    fields.push(format!(
        "\"report_data\":{{\"version\":\"1.0\",\"technical_table\":[{}],\"warnings\":{}}}",
        technical_table
            .iter()
            .map(|(label, value)| format!("{{\"label\":\"{}\",\"value\":\"{}\"}}", json_escape(label), json_escape(value)))
            .collect::<Vec<String>>()
            .join(","),
        json_string_vec(&product.warnings),
    ));

    let mut metadata_fields = vec![
        "\"parser\":\"rust\"".to_string(),
        format!("\"format_version\":\"{}\"", json_escape(&product.format_version)),
    ];
    if let Some(value) = product.num_lamps {
        metadata_fields.push(format!("\"num_lamps\":{}", value));
    }
    if let Some(value) = &product.lamp_type {
        metadata_fields.push(format!("\"lamp_type\":\"{}\"", json_escape(value)));
    }
    if let Some(value) = product.luminaire_type {
        metadata_fields.push(format!("\"luminaire_type\":{}", value));
    }
    if let Some(value) = product.downward_flux_fraction_pct {
        metadata_fields.push(format!("\"downward_flux_fraction_pct\":{}", trim_float(value)));
    }
    if let Some(value) = product.light_output_ratio_pct {
        metadata_fields.push(format!("\"light_output_ratio_pct\":{}", trim_float(value)));
    }
    if let Some(value) = product.conversion_factor {
        metadata_fields.push(format!("\"conversion_factor\":{}", trim_float(value)));
    }
    if let Some(value) = product.tilt_deg {
        metadata_fields.push(format!("\"tilt_deg\":{}", trim_float(value)));
    }
    if !product.direct_ratios.is_empty() {
        metadata_fields.push(format!("\"direct_ratios\":{}", json_vec(&product.direct_ratios)));
    }
    fields.push(format!("\"metadata\":{{{}}}", metadata_fields.join(",")));

    fields.push(format!("\"warnings\":{}", json_string_vec(&product.warnings)));

    format!("{{{}}}", fields.join(","))
}

fn push_field_str(fields: &mut Vec<String>, key: &str, value: &Option<String>) {
    if let Some(value) = value {
        fields.push(format!("\"{}\":\"{}\"", key, json_escape(value)));
    }
}

fn push_field_num(fields: &mut Vec<String>, key: &str, value: Option<f64>) {
    if let Some(value) = value {
        fields.push(format!("\"{}\":{}", key, trim_float(value)));
    }
}

fn json_num(value: Option<f64>) -> String {
    value.map(trim_float).unwrap_or_else(|| "null".to_string())
}

fn json_opt_int(value: Option<i64>) -> String {
    value.map(|value| value.to_string()).unwrap_or_else(|| "null".to_string())
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
    tokens: Vec<f64>,
    num_c: usize,
    dc: f64,
    num_g: usize,
    dg: f64,
) -> (Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>) {
    let c_angles = if dc > 0.0 {
        (0..num_c).map(|index| index as f64 * dc).collect()
    } else {
        Vec::new()
    };
    let gamma_angles = if dg > 0.0 {
        (0..num_g).map(|index| index as f64 * dg).collect()
    } else {
        Vec::new()
    };

    // EULUMDAT incluye diez factores de reducción (DR1-DR10) antes de las
    // listas de ángulos. Localizamos ambas listas también cuando dC=0 y
    // existe un único plano rotacional; consumir el primer factor como C
    // desplazaba la matriz. Todo lo que quede ANTES del offset encontrado
    // son los DR1-10 (o menos, si el archivo los omite) — se devuelven para
    // que el llamador los exponga, en vez de descartarlos en silencio.
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
                tokens[0..offset].to_vec(),
                tokens[g_end..].to_vec(),
            );
        }
    }

    (c_angles, gamma_angles, Vec::new(), tokens)
}

fn is_expected_angle_list(values: &[f64], count: usize, step: f64) -> bool {
    if values.len() != count || (step <= 0.0 && count > 1) {
        return false;
    }

    values
        .iter()
        .enumerate()
        .all(|(index, value)| (*value - (index as f64 * step.max(0.0))).abs() <= 0.01)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn validation_ldt(dc: &str, c_angles: &[&str]) -> String {
        let mut lines = vec!["0".to_string(); 32];
        lines[0] = "Test Lighting".into();
        lines[2] = "1".into();
        lines[3] = c_angles.len().to_string();
        lines[4] = dc.into();
        lines[5] = "5".into();
        lines[6] = "22.5".into();
        lines[8] = "Luminaria validación".into();
        lines[9] = "TEST-1000".into();
        lines[12] = "600 600 100".into();
        lines[27] = "LED".into();
        lines[28] = "1000".into();
        lines[29] = "4000".into();
        lines[30] = "80".into();
        lines[31] = "10,0".into();
        lines.extend(["0.51", "0.62", "0.70", "0.78", "0.82", "0.86", "0.90", "0.93", "0.95", "0.97"].map(String::from));
        lines.extend(c_angles.iter().map(|value| (*value).to_string()));
        lines.extend(["0", "22.5", "45", "67.5", "90"].map(String::from));
        for _ in c_angles {
            lines.extend(["100", "250", "300", "150", "50"].map(String::from));
        }
        lines.join("\n")
    }

    /// Fixture EULUMDAT completo, con cada campo de línea 10-25 en su propia
    /// línea (nunca varios valores juntos separados por espacio — ese es el
    /// error que este mismo cambio corrige). Offsets verificados contra la
    /// especificación oficial de DIALux (evo.support-en.dial.de) y AGI32
    /// (docs.agi32.com), y contra 2 archivos LDT reales de fábrica
    /// descargados de luminaires.dialux.com (EMOS ZU210-9, Thorlux Lexi).
    fn full_spec_ldt() -> String {
        let mut lines = vec!["0".to_string(); 32];
        lines[0] = "ACME Lighting".into();
        lines[1] = "1".into(); // Ityp: 1 = punto rotacionalmente simétrico
        lines[2] = "1".into(); // Isym
        lines[3] = "1".into(); // Mc
        lines[4] = "0".into(); // Dc
        lines[5] = "5".into(); // Ng
        lines[6] = "22.5".into(); // Dg
        lines[8] = "Downlight de validación".into();
        lines[9] = "ACME-1000".into();
        lines[10] = "acme1000.ldt".into();
        lines[11] = "2026-01-01/tester".into();
        lines[12] = "180".into(); // largo luminaria (mm)
        lines[13] = "180".into(); // ancho luminaria (mm)
        lines[14] = "90".into(); // alto luminaria (mm)
        lines[15] = "150".into(); // largo área luminosa (mm)
        lines[16] = "150".into(); // ancho área luminosa (mm)
        lines[17] = "0".into(); // alto área luminosa C0 (mm) — plano, downlight
        lines[18] = "0".into(); // alto área luminosa C90
        lines[19] = "0".into(); // alto área luminosa C180
        lines[20] = "0".into(); // alto área luminosa C270
        lines[21] = "62.5".into(); // DFF%
        lines[22] = "85.0".into(); // LORL%
        lines[23] = "1.0".into(); // factor de conversión
        lines[24] = "0".into(); // tilt
        lines[25] = "1".into(); // número de sets de lámparas
        lines[26] = "1".into(); // num_lamps (set 1)
        lines[27] = "LED".into();
        lines[28] = "1000".into();
        lines[29] = "4000".into();
        lines[30] = "80".into();
        lines[31] = "10,0".into();
        lines.extend(["0.51", "0.62", "0.70", "0.78", "0.82", "0.86", "0.90", "0.93", "0.95", "0.97"].map(String::from));
        lines.extend(["0"].map(String::from)); // c_angles (Mc=1)
        lines.extend(["0", "22.5", "45", "67.5", "90"].map(String::from)); // gamma_angles (Ng=5)
        lines.extend(["100", "250", "300", "150", "50"].map(String::from)); // candela plano 0
        lines.join("\n")
    }

    #[test]
    fn parses_all_the_newly_added_eulumdat_header_fields_from_their_own_lines() {
        let parsed = parse_ldt(&full_spec_ldt());

        assert_eq!(parsed.luminaire_type, Some(1));
        assert_eq!(parsed.dimensions, Some((0.180, 0.180, 0.090)));
        assert_eq!(parsed.luminous_opening_length_width, Some((0.150, 0.150)));
        // Los 4 altos son 0 en este fixture (downlight plano) — `dimensions`
        // Some(0.15,0.15) sí se guarda porque length/width son > 0, pero
        // `luminous_opening_heights` queda `None` porque las 4 alturas son 0
        // (ningún valor > 0 que justifique guardarlas).
        assert_eq!(parsed.luminous_opening_heights, None);
        assert_eq!(parsed.downward_flux_fraction_pct, Some(62.5));
        assert_eq!(parsed.light_output_ratio_pct, Some(85.0));
        assert_eq!(parsed.conversion_factor, Some(1.0));
        assert_eq!(parsed.tilt_deg, Some(0.0));
        assert_eq!(parsed.total_lumens, Some(1000.0));
        assert_eq!(parsed.power_watts, Some(10.0));
        assert_eq!(parsed.lamp_type, Some("LED".to_string()));
        assert_eq!(
            parsed.direct_ratios,
            vec![0.51, 0.62, 0.70, 0.78, 0.82, 0.86, 0.90, 0.93, 0.95, 0.97],
        );
    }

    /// Regresión directa del hallazgo real del usuario (2026-08-17): el
    /// archivo real de fábrica Thorlux TEG18046 declara "14W LED" como tipo
    /// de lámpara (línea 28) — una descripción, NO un número — y este campo
    /// se descartaba en silencio en Rust (el parser que realmente corre en
    /// producción), aunque el fallback PHP sí lo capturaba. Sin él, "Type of
    /// lamps" (14W, la potencia de la LÁMPARA) quedaba indistinguible de
    /// "Connected power" (17W, la potencia de la LUMINARIA completa,
    /// incluido el driver) — dos magnitudes reales y distintas del mismo
    /// archivo, ambas visibles por separado en el LDT Editor de DIALux.
    #[test]
    fn captures_lamp_type_as_a_free_text_description_not_a_number() {
        let mut lines: Vec<String> = full_spec_ldt().lines().map(String::from).collect();
        lines[27] = "14W LED".into();

        let parsed = parse_ldt(&lines.join("\n"));

        assert_eq!(parsed.lamp_type, Some("14W LED".to_string()));
        // El propio campo de tipo de lámpara no debe interferir con el
        // resto del bloque de lámpara — flujo/CCT/CRI/potencia deben seguir
        // en su posición real, sin desplazarse.
        assert_eq!(parsed.total_lumens, Some(1000.0));
        assert_eq!(parsed.power_watts, Some(10.0));
    }

    #[test]
    fn captures_luminous_opening_heights_when_at_least_one_is_nonzero() {
        let mut lines: Vec<String> = full_spec_ldt().lines().map(String::from).collect();
        lines[17] = "40".into(); // alto área luminosa C0 — luminaria con volumen (no plana)

        let parsed = parse_ldt(&lines.join("\n"));

        assert_eq!(parsed.luminous_opening_heights, Some([0.040, 0.0, 0.0, 0.0]));
    }

    #[test]
    fn strips_a_leading_utf8_bom_from_manufacturer() {
        let with_bom = format!("\u{FEFF}{}", validation_ldt("90", &["0", "90", "180", "270"]));
        let parsed = parse_ldt(&with_bom);

        assert_eq!(parsed.manufacturer, Some("Test Lighting".to_string()));
    }

    #[test]
    fn parses_validation_ldt_without_shifting_fields_or_matrix() {
        let parsed = parse_ldt(&validation_ldt("90", &["0", "90", "180", "270"]));

        assert_eq!(parsed.total_lumens, Some(1000.0));
        assert_eq!(parsed.power_watts, Some(10.0));
        assert_eq!(parsed.c_angles, vec![0.0, 90.0, 180.0, 270.0]);
        assert_eq!(parsed.gamma_angles, vec![0.0, 22.5, 45.0, 67.5, 90.0]);
        assert_eq!(parsed.candela, vec![vec![100.0, 250.0, 300.0, 150.0, 50.0]; 4]);
    }

    #[test]
    fn parses_single_rotational_c_plane_after_reduction_factors() {
        let parsed = parse_ldt(&validation_ldt("0", &["0"]));

        assert_eq!(parsed.c_angles, vec![0.0]);
        assert_eq!(parsed.candela[0], vec![100.0, 250.0, 300.0, 150.0, 50.0]);
    }

    /// Una luminaria simétrica puede declarar `Mc=4` planos C en el
    /// encabezado (y listarlos los 4) pero publicar intensidades para uno
    /// solo — el resto se completa por reflejo en el consumidor. Sin
    /// truncar `c_angles` a la cantidad de planos realmente publicados,
    /// `c_angles.len() != candela.len()` viaja así hasta `photometric_web`,
    /// y `candelaFromPhotometricWeb()` (JS) indexa `candela[i]` fuera de
    /// rango para cualquier plano más allá del publicado → `undefined` sin
    /// fallback posible, crash en `interpolate1D` (bug real reproducido en
    /// producción, no solo hipotético). Mismo fix que ya tiene el parser PHP
    /// de respaldo (`ProductImportService::parseLdt`).
    #[test]
    fn truncates_c_angles_when_fewer_intensity_planes_are_published_than_declared() {
        let full = validation_ldt("90", &["0", "90", "180", "270"]);
        let mut lines: Vec<String> = full.lines().map(String::from).collect();
        // El archivo termina con 4 planos de 5 valores cada uno (un número
        // por línea); recortamos los últimos 3 planos y dejamos solo el
        // primero, simulando una publicación incompleta/simétrica.
        lines.truncate(lines.len() - 15);

        let parsed = parse_ldt(&lines.join("\n"));

        assert_eq!(parsed.candela.len(), 1);
        assert_eq!(
            parsed.c_angles.len(),
            parsed.candela.len(),
            "c_angles debe quedar 1 a 1 con candela para que el consumidor JS no indexe fuera de rango"
        );
        assert_eq!(parsed.c_angles, vec![0.0]);
    }

    /// Fase 16: el número de lámparas vive en la línea 27 (1-indexada), no en
    /// la 28 — verificado contra 8 archivos LDT reales de usuarios. Un
    /// número POSITIVO significa "el flujo declarado es por lámpara"
    /// (multiplicar); antes de este fix, el cursor arrancaba una línea tarde
    /// y el multiplicador se perdía siempre (quedaba en 1), subestimando el
    /// flujo total de cualquier luminaria multi-lámpara.
    #[test]
    fn multiplies_total_lumens_by_a_positive_declared_lamp_count() {
        let mut lines: Vec<String> = validation_ldt("90", &["0", "90", "180", "270"])
            .lines()
            .map(String::from)
            .collect();
        lines[26] = "4".to_string(); // 4 lámparas, flujo declarado POR lámpara.

        let parsed = parse_ldt(&lines.join("\n"));

        assert_eq!(parsed.total_lumens, Some(4000.0));
    }

    /// Un número NEGATIVO significa "el flujo declarado ya es el total del
    /// conjunto" — no debe multiplicarse (el valor absoluto es solo
    /// informativo). Confirmado contra un archivo LDT real que declara "-2".
    #[test]
    fn does_not_multiply_total_lumens_when_declared_lamp_count_is_negative() {
        let mut lines: Vec<String> = validation_ldt("90", &["0", "90", "180", "270"])
            .lines()
            .map(String::from)
            .collect();
        lines[26] = "-2".to_string();

        let parsed = parse_ldt(&lines.join("\n"));

        assert_eq!(parsed.total_lumens, Some(1000.0));
    }
}

fn parse_number(value: &str) -> Option<f64> {
    value.trim().replace(',', ".").parse::<f64>().ok()
}

/// Igual que `array_slice($values, $start, $len)` en PHP: si el rango pedido
/// excede lo disponible, devuelve lo que SÍ hay (posiblemente más corto o
/// vacío) en vez de fallar o devolver un slice vacío por estar el límite
/// superior fuera de rango — `values[start..start+len]` de Rust panicaría (o,
/// con `.get()`, devolvería `None` para TODO el rango) incluso cuando parte
/// de los datos pedidos sí existen.
fn slice_partial(values: &[f64], start: usize, len: usize) -> Vec<f64> {
    if start >= values.len() {
        return Vec::new();
    }
    let end = (start + len).min(values.len());
    values[start..end].to_vec()
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
