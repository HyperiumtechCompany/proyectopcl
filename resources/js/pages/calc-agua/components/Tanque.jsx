import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_DIM = {
  largo: 4.40,
  ancho: 2.70,
  alturaAgua: 1.15,
  alturaLimpieza: 0.10,
  bordeLibre: 0.45,
  alturaTotal: 1.70,
  htecho: 0.20,
  hingreso: 0.15,
  hrebose: 0.10,
  alturalibre: 0.10,
  nivelFondoTanque: 14.70,
  porcentajeReserva: 25,
};

const parseNum = (v, fb = 0) => {
  if (v === '' || v === null || v === undefined) return fb;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
};
const fmt = (v, d = 2) => Number.isFinite(+v) ? (+v).toFixed(d) : '0.00';
const sign = (v) => (+v >= 0 ? `+${fmt(v)}` : fmt(v));
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DIAGRAM
// ═══════════════════════════════════════════════════════════════════════════════
function TanqueSVG({ dim }) {
  const d = { ...DEFAULT_DIM, ...dim };

  const nv = useMemo(() => {
    const fondo = parseNum(d.nivelFondoTanque);
    const interior_top = fondo + parseNum(d.alturaTotal);
    const roof_top = interior_top + parseNum(d.htecho);
    const ingreso = interior_top - parseNum(d.hingreso);
    const rebose = ingreso - parseNum(d.hrebose);
    const agua_bot = rebose - parseNum(d.alturaAgua);
    const salida = fondo + parseNum(d.alturalibre);
    return { fondo, interior_top, roof_top, ingreso, rebose, agua_bot, salida };
  }, [d]);

  const VW = 820, VH = 520;
  const tL = 46, tW = 270;
  const yTop = 72, yBot = 440;
  const span = yBot - yTop;
  const wT = 18, rT = 14;

  const e2y = (e) => yTop + ((nv.roof_top - e) / (nv.roof_top - nv.fondo)) * span;

  const yRoof = yTop;
  const yIntTop = e2y(nv.interior_top);
  const yIng = e2y(nv.ingreso);
  const yReb = e2y(nv.rebose);
  const yAguaBot = e2y(nv.agua_bot);
  const ySal = e2y(nv.salida);
  const yFondo = yBot;

  const iL = tL + wT, iR = tL + tW - wT, iW = iR - iL;

  const aX = tL + tW + 30;
  const bW = 32;
  const lX = aX + bW + 12;
  const nBW = 130;
  const nBX = VW - nBW - 6;

  const Bracket = ({ y1, y2, color, label, sub, val }) => {
    const my = (y1 + y2) / 2;
    if (Math.abs(y2 - y1) < 6) return null;
    return (
      <g>
        <line x1={aX} y1={y1} x2={aX} y2={y2} stroke={color} strokeWidth={2} />
        <line x1={aX} y1={y1} x2={aX + bW} y2={y1} stroke={color} strokeWidth={2} />
        <line x1={aX} y1={y2} x2={aX + bW} y2={y2} stroke={color} strokeWidth={2} />
        <text x={lX} y={my - 7} fontSize={12} fill="#111" fontFamily="'Courier New',monospace">{label} {sub}</text>
        <text x={lX} y={my + 9} fontSize={13} fontWeight="bold" fill="#111" fontFamily="'Courier New',monospace">= {val} m</text>
      </g>
    );
  };

  const NvBox = ({ y, label, red }) => (
    <g>
      <line x1={iR + 2} y1={y} x2={nBX - 8} y2={y}
        stroke={red ? '#c00' : '#999'} strokeWidth={red ? 1.5 : 0.8} strokeDasharray={red ? '0' : '5 3'} />
      <line x1={nBX - 8} y1={y} x2={nBX} y2={y} stroke={red ? '#c00' : '#555'} strokeWidth={1.5} />
      <rect x={nBX} y={y - 11} width={nBW} height={22} rx={2}
        fill={red ? '#fff0f0' : 'white'} stroke={red ? '#c00' : '#999'} strokeWidth={1.5} />
      <text x={nBX + nBW / 2} y={y + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill={red ? '#c00' : '#222'} fontFamily="'Courier New',monospace" fontWeight={red ? 'bold' : 'normal'}>
        Nivel = {label} m
      </text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg">
      <rect width={VW} height={VH} fill="white" />

      {/* Top nivel */}
      <text x={tL} y={yTop - 13} fontSize={13} fill="#111" fontFamily="'Courier New',monospace" fontWeight="bold">
        Nivel = {sign(nv.roof_top)} m
      </text>

      {/* Hatching defs */}
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={7} stroke="#999" strokeWidth={1} opacity={0.5} />
        </pattern>
      </defs>

      {/* Outer walls */}
      <rect x={tL} y={yRoof} width={tW} height={yFondo - yRoof + rT}
        fill="#c8c8c0" stroke="#666" strokeWidth={2} rx={3} />
      <rect x={tL} y={yFondo} width={tW} height={rT} fill="#b8b8b0" stroke="#666" strokeWidth={2} />

      {/* Hatch overlays */}
      <rect x={tL} y={yRoof} width={wT} height={yFondo - yRoof} fill="url(#hatch)" />
      <rect x={iR} y={yRoof} width={wT} height={yFondo - yRoof} fill="url(#hatch)" />
      <rect x={tL} y={yRoof} width={tW} height={yIntTop - yRoof} fill="url(#hatch)" />
      <rect x={tL} y={yFondo} width={tW} height={rT} fill="url(#hatch)" />

      {/* Inner white */}
      <rect x={iL} y={yIntTop} width={iW} height={yFondo - yIntTop} fill="white" />

      {/* Borde libre zone */}
      <rect x={iL} y={yIntTop} width={iW} height={Math.max(yReb - yIntTop, 0)} fill="#f0f0ea" />

      {/* Water zone */}
      <rect x={iL} y={yReb} width={iW} height={Math.max(yAguaBot - yReb, 0)} fill="#c5e5f8" />

      {/* Limpieza zone */}
      {(ySal - yAguaBot) > 0 && (
        <rect x={iL} y={yAguaBot} width={iW} height={Math.max(ySal - yAguaBot, 0)} fill="#f0edcc" opacity={0.7} />
      )}

      {/* Inner border */}
      <rect x={iL} y={yIntTop} width={iW} height={yFondo - yIntTop} fill="none" stroke="#888" strokeWidth={1.5} />

      {/* BORDE LIBRE text */}
      {(yReb - yIntTop) > 28 && (
        <text x={iL + iW / 2} y={(yIntTop + yReb) / 2}
          fontSize={20} fontFamily="'Courier New',monospace" fontWeight="bold"
          fill="#bbb" textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(-20,${iL + iW / 2},${(yIntTop + yReb) / 2})`}
          letterSpacing={3} opacity={0.7}>
          BORDE LIBRE
        </text>
      )}

      {/* Dashed level lines */}
      {[
        { y: yIng, c: '#cc7744' },
        { y: yReb, c: '#559944' },
        { y: yAguaBot, c: '#4488bb' },
        { y: ySal, c: '#999999' },
      ].map((l, i) => (
        <line key={i} x1={iL + 4} y1={l.y} x2={iR - 4} y2={l.y}
          stroke={l.c} strokeWidth={1.5} strokeDasharray="8 5" />
      ))}

      {/* Pipes right wall */}
      {/* Ingreso */}
      <rect x={iR + 1} y={yIng - 12} width={7} height={24} fill="#cc7744" stroke="#994422" strokeWidth={1} />
      <rect x={iR - 8} y={yIng - 8} width={20} height={16} fill="#cc7744" stroke="#994422" strokeWidth={1.5} rx={2} />
      {/* Rebose */}
      <rect x={iR + 1} y={yReb - 12} width={7} height={24} fill="#559944" stroke="#337722" strokeWidth={1} />
      <rect x={iR - 8} y={yReb - 8} width={20} height={16} fill="#559944" stroke="#337722" strokeWidth={1.5} rx={2} />
      {/* Salida */}
      <rect x={iR + 1} y={ySal - 10} width={7} height={20} fill="#aab0b8" stroke="#7a8088" strokeWidth={1} />
      <rect x={iR - 8} y={ySal - 7} width={20} height={14} fill="#aab0b8" stroke="#7a8088" strokeWidth={1.5} rx={2} />

      {/* Brackets */}
      <Bracket y1={yIntTop} y2={yIng} color="#994422" label="H. techo" sub="(Ht)" val={fmt(d.htecho)} />
      <Bracket y1={yIng} y2={yReb} color="#337722" label="H. ingreso" sub="(Hi)" val={fmt(d.hingreso)} />
      <Bracket y1={ySal} y2={yFondo} color="#7a8088" label="Altura Libre" sub="(HL)" val={fmt(d.alturalibre)} />

      {/* Altura agua: label in middle of zone */}
      {(yAguaBot - yReb) > 20 && (
        <text x={lX} y={(yReb + yAguaBot) / 2} dominantBaseline="middle"
          fontSize={13} fill="#111" fontFamily="'Courier New',monospace">
          Altura de agua (Ha) = <tspan fontWeight="bold">{fmt(d.alturaAgua)} m</tspan>
        </text>
      )}

      {/* Nivel boxes */}
      <NvBox y={yIntTop} label={sign(nv.interior_top)} />
      <NvBox y={yIng} label={sign(nv.ingreso)} />
      <NvBox y={yReb} label={sign(nv.rebose)} />
      <NvBox y={ySal} label={sign(nv.salida)} red />
      <NvBox y={yFondo} label={sign(nv.fondo)} />

      {/* Bottom dim: Largo */}
      <line x1={iL} y1={yFondo + 32} x2={iR} y2={yFondo + 32} stroke="#333" strokeWidth={1.5} />
      <line x1={iL} y1={yFondo + 26} x2={iL} y2={yFondo + 38} stroke="#333" strokeWidth={1.5} />
      <line x1={iR} y1={yFondo + 26} x2={iR} y2={yFondo + 38} stroke="#333" strokeWidth={1.5} />
      <text x={(iL + iR) / 2} y={yFondo + 50} textAnchor="middle"
        fontSize={12} fill="#333" fontFamily="'Courier New',monospace">
        L = {fmt(d.largo)} m
      </text>

      {/* Left dim: HT */}
      <line x1={tL - 22} y1={yIntTop} x2={tL - 22} y2={yFondo} stroke="#333" strokeWidth={1.5} />
      <line x1={tL - 30} y1={yIntTop} x2={tL - 14} y2={yIntTop} stroke="#333" strokeWidth={1.5} />
      <line x1={tL - 30} y1={yFondo} x2={tL - 14} y2={yFondo} stroke="#333" strokeWidth={1.5} />
      <text x={tL - 38} y={(yIntTop + yFondo) / 2} textAnchor="middle"
        transform={`rotate(-90,${tL - 38},${(yIntTop + yFondo) / 2})`}
        fontSize={12} fill="#333" fontFamily="'Courier New',monospace">
        HT = {fmt(d.alturaTotal)} m
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DimInput — input field con label y valor
// ═══════════════════════════════════════════════════════════════════════════════
function DimInput({ label, name, value, onChange, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 10px',
      background: highlight ? '#fffbe6' : 'white',
      border: `1.5px solid ${highlight ? '#d4a020' : '#d0d0d0'}`,
      borderRadius: 5, marginBottom: 5,
      boxShadow: highlight ? '0 0 0 2px #f5e08044' : 'none',
    }}>
      <label style={{ fontSize: 12, color: '#222', fontWeight: highlight ? '700' : '500', flex: 1, lineHeight: 1.2 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input
          type="number" step="0.01" name={name} value={value} onChange={onChange}
          style={{
            width: 82, padding: '5px 8px', fontSize: 15, fontWeight: 'bold',
            border: `2px solid ${highlight ? '#d4a020' : '#3a7abf'}`,
            borderRadius: 4, color: '#000', background: 'white',
            textAlign: 'right', fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: '#666', minWidth: 14 }}>m</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
const Tanque = ({ initialData, editMode, onChange, globalDemandaTotal }) => {
  const [consumoDiario, setConsumoDiario] = useState(
    globalDemandaTotal || initialData?.consumoDiario || 0
  );
  const [dim, setDim] = useState(() => {
    const s = initialData || {};
    return {
      largo: parseNum(s.largo, DEFAULT_DIM.largo),
      ancho: parseNum(s.ancho, DEFAULT_DIM.ancho),
      alturaAgua: parseNum(s.alturaAgua ?? s.alturaUtil, DEFAULT_DIM.alturaAgua),
      alturaLimpieza: parseNum(s.alturaLimpieza, DEFAULT_DIM.alturaLimpieza),
      bordeLibre: parseNum(s.bordeLibre, DEFAULT_DIM.bordeLibre),
      alturaTotal: parseNum(s.alturaTotal, DEFAULT_DIM.alturaTotal),
      htecho: parseNum(s.htecho, DEFAULT_DIM.htecho),
      hingreso: parseNum(s.hingreso, DEFAULT_DIM.hingreso),
      hrebose: parseNum(s.hrebose, DEFAULT_DIM.hrebose),
      alturalibre: parseNum(s.alturalibre, DEFAULT_DIM.alturalibre),
      nivelFondoTanque: parseNum(s.nivelFondoTanque, DEFAULT_DIM.nivelFondoTanque),
      porcentajeReserva: parseNum(s.porcentajeReserva, DEFAULT_DIM.porcentajeReserva),
    };
  });

  useEffect(() => { if (globalDemandaTotal > 0) setConsumoDiario(parseFloat(globalDemandaTotal)); }, [globalDemandaTotal]);

  useEffect(() => {
    if (!initialData) return;
    const s = initialData;
    setDim({
      largo: parseNum(s.largo, DEFAULT_DIM.largo),
      ancho: parseNum(s.ancho, DEFAULT_DIM.ancho),
      alturaAgua: parseNum(s.alturaAgua ?? s.alturaUtil, DEFAULT_DIM.alturaAgua),
      alturaLimpieza: parseNum(s.alturaLimpieza, DEFAULT_DIM.alturaLimpieza),
      bordeLibre: parseNum(s.bordeLibre, DEFAULT_DIM.bordeLibre),
      alturaTotal: parseNum(s.alturaTotal, DEFAULT_DIM.alturaTotal),
      htecho: parseNum(s.htecho, DEFAULT_DIM.htecho),
      hingreso: parseNum(s.hingreso, DEFAULT_DIM.hingreso),
      hrebose: parseNum(s.hrebose, DEFAULT_DIM.hrebose),
      alturalibre: parseNum(s.alturalibre, DEFAULT_DIM.alturalibre),
      nivelFondoTanque: parseNum(s.nivelFondoTanque, DEFAULT_DIM.nivelFondoTanque),
      porcentajeReserva: parseNum(s.porcentajeReserva, DEFAULT_DIM.porcentajeReserva),
    });
  }, [initialData]);

  const handleDim = (e) => {
    const { name, value } = e.target;
    setDim(p => ({ ...p, [name]: value === '' ? '' : parseNum(value) }));
  };

  // ── Calculations ──
  const ceil1 = (v) => Math.ceil(v * 10) / 10;
  const volumenTE = useMemo(() => ceil1(((1 / 3) * (parseFloat(consumoDiario) || 0)) / 1000), [consumoDiario]);
  const hReservaFactor = useMemo(() => 1 + (parseNum(dim.porcentajeReserva) / 100), [dim.porcentajeReserva]);
  const volumenTotal = useMemo(() => round2(volumenTE * hReservaFactor), [volumenTE, hReservaFactor]);
  const area = useMemo(() => Math.max(parseNum(dim.largo) * parseNum(dim.ancho), 0.01), [dim.largo, dim.ancho]);
  const alturaAguaMin = useMemo(() => volumenTotal / area, [volumenTotal, area]);
  const volumenCalc = useMemo(() => parseNum(dim.largo) * parseNum(dim.ancho) * parseNum(dim.alturaAgua), [dim]);
  const ok = volumenCalc >= volumenTE;

  const niveles = useMemo(() => {
    const fondo = parseNum(dim.nivelFondoTanque);
    const interior_top = fondo + parseNum(dim.alturaTotal);
    const roof_top = interior_top + parseNum(dim.htecho);
    const ingreso = interior_top - parseNum(dim.hingreso);
    const rebose = ingreso - parseNum(dim.hrebose);
    const agua_bot = rebose - parseNum(dim.alturaAgua);
    const salida = fondo + parseNum(dim.alturalibre);
    return [
      { label: 'Fondo', numero: 1, valor: fondo },
      { label: 'Salida', numero: 2, valor: salida },
      { label: 'Agua Bot', numero: 3, valor: agua_bot },
      { label: 'Rebose', numero: 4, valor: rebose },
      { label: 'Ingreso', numero: 5, valor: ingreso },
      { label: 'Top Interior', numero: 6, valor: interior_top },
      { label: 'Top Roof', numero: 7, valor: roof_top },
    ];
  }, [dim]);

  const sendUpdate = useCallback(() => {
    const data = { consumoDiario, ...dim, volumenTE, volumenTotal, alturaAguaMin, volumenCalc, niveles };
    document.dispatchEvent(new CustomEvent('tanque-updated', { detail: data }));
    if (onChange) onChange(data);
  }, [consumoDiario, dim, volumenTE, volumenTotal, alturaAguaMin, volumenCalc, niveles, onChange]);

  useEffect(() => { const t = setTimeout(sendUpdate, 150); return () => clearTimeout(t); }, [sendUpdate]);

  useEffect(() => {
    const onD = (e) => setConsumoDiario(parseFloat(e.detail?.totalCaudal || 0));
    const onR = (e) => {
      if (e.detail?.config?.altasumfondotanqueelevado !== undefined)
        setDim(d => ({ ...d, nivelFondoTanque: parseFloat(e.detail.config.altasumfondotanqueelevado || 0) }));
    };
    document.addEventListener('demanda-diaria-updated', onD);
    document.addEventListener('red-alimentacion-updated', onR);
    return () => {
      document.removeEventListener('demanda-diaria-updated', onD);
      document.removeEventListener('red-alimentacion-updated', onR);
    };
  }, []);

  const font = "'Times New Roman', Georgia, serif";
  const mono = "'Courier New', monospace";

  return (
    <div style={{ fontFamily: font, color: '#111', background: 'white', padding: '20px 24px' }}>

      {/* ══ HEADER ══ */}
      <div style={{ borderBottom: '3px solid #3a6a3a', paddingBottom: 8, marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 'bold', color: '#1a3a1a' }}>2.2. TANQUE ELEVADO</div>
      </div>

      {/* ══ 2.2.1 ══ */}
      <div style={{ background: '#e8eedc', border: '1px solid #a8b890', padding: '6px 12px', marginBottom: 14 }}>
        <strong style={{ fontSize: 13 }}>2.2.1. CALCULO DE VOLUMEN DEL TANQUE ELEVADO</strong>
      </div>

      {/* Formula */}
      <div style={{ border: '1px solid #aaa', textAlign: 'center', padding: '9px', marginBottom: 14, fontWeight: 'bold', fontSize: 13, background: '#fafaf4' }}>
        VOL. DE TANQUE ELEVADO = 1/3 × CONSUMO DIARIO TOTAL
      </div>

      {/* Result cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14, maxWidth: 880 }}>
        {[
          { l: 'Consumo Diario', v: `${fmt(consumoDiario)} Lt`, c: '#1a4a7a', bg: '#f8fafc', icon: 'fas fa-tint' },
          { l: 'Vol. de T.E.', v: `${fmt(volumenTE)} m³`, c: '#2a6a4a', bg: '#edf7f2' },
          { l: 'Vol. Total + Reserva', v: `${fmt(volumenTotal)} m³`, c: '#2a5a8a', bg: '#edf2f9' },
          { l: 'Altura de agua mín.', v: `${fmt(alturaAguaMin)} m`, c: '#7a4a1a', bg: '#faf3ea' },
        ].map(({ l, v, c, bg, icon }) => (
          <div key={l} style={{ border: `2px solid ${c}`, borderRadius: 6, padding: '10px 14px', textAlign: 'center', background: bg }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {icon && <i className={`${icon} mr-1 opacity-70`}></i>} {l}
            </div>
            <div style={{ fontSize: 19, fontWeight: 'bold', color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Consumo readout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 13 }}>
        <span style={{ color: '#555' }}>Consumo Diario Total (Lt/día):</span>
        <input type="number" value={consumoDiario || ''} readOnly
          style={{ width: 110, padding: '4px 8px', border: '1px solid #bbb', borderRadius: 3, fontSize: 13, color: '#000', background: '#f5f5f2', fontFamily: mono }} />
        {!consumoDiario && <span style={{ fontSize: 11, color: '#e07030' }}>⚠ Ingresa datos en sección 1</span>}
      </div>

      {/* Largo/Ancho/Altura + callout */}
      <p style={{ marginBottom: 10, fontSize: 13 }}>Tanque Elevado de cuyas dimensiones serán:</p>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          {[['Largo (L)', 'largo'], ['Ancho (A)', 'ancho'], ['Altura agua (H)', 'alturaAgua']].map(([l, k]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 140, textAlign: 'right', fontSize: 13, fontFamily: font }}>{l} =</span>
              <input type="number" step="0.01" name={k} value={dim[k]} onChange={handleDim}
                style={{ width: 82, padding: '4px 9px', fontSize: 15, fontWeight: 'bold', border: '2px solid #3a7abf', borderRadius: 4, color: '#000', background: 'white', textAlign: 'right', fontFamily: mono }} />
              <span style={{ fontSize: 13, color: '#444' }}>m</span>
            </div>
          ))}
        </div>
        <div style={{ border: '2px solid #4a7a4a', borderRadius: 5, padding: '10px 16px', background: '#f4faf4', maxWidth: 210, fontSize: 12, fontWeight: 'bold', color: '#2a5a2a', textAlign: 'center', lineHeight: 1.55 }}>
          Altura asumida como mínimo para mantenimiento y limpieza de tanque elevado
        </div>
      </div>

      {/* VOLUMEN box */}
      <div style={{ border: '2px solid #888', background: ok ? '#f5f5d8' : '#fff0f0', padding: '10px 20px', textAlign: 'center', fontWeight: 'bold', fontSize: 15, marginBottom: 22 }}>
        VOLUMEN DE TANQUE ELEVADO = {fmt(volumenCalc)} m³
        {!ok && <span style={{ color: '#c00', marginLeft: 12, fontSize: 12 }}>⚠ CORREGIR DIMENSIONES (mín. {fmt(volumenTE)} m³)</span>}
      </div>

      {/* ══ 2.1.2 ══ */}
      <div style={{ background: '#e8eedc', border: '1px solid #a8b890', padding: '6px 12px', marginBottom: 12 }}>
        <strong style={{ fontSize: 13 }}>2.1.2. DIMENSIONES DEL TANQUE ELEVADO</strong>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
        <tbody>
          {[
            ['ANCHO', 'Ancho del Tanque Elevado'],
            ['LARGO', 'Largo del Tanque Elevado'],
            ['ALTURA DE AGUA', 'Altura de agua del Tanque Elevado'],
            ['ALTURA DE TUB. REBOSE', 'La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0,10 m'],
            ['ALTURA DE TUB. DE INGRESO', 'La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0,15 m'],
            ['ALTURA DE NIVEL DE TECHO', 'La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0,20 m'],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={{ border: '1px solid #bbb', padding: '5px 8px', fontWeight: 'bold', width: '28%', background: '#fafaf6', fontSize: 11 }}>{k}</td>
              <td style={{ border: '1px solid #bbb', padding: '5px 8px', verticalAlign: 'top' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ══ DIAGRAM + INPUTS ══ */}
      <p style={{ marginBottom: 10, fontSize: 13 }}>Tanque elevado cuyas dimensiones serán:</p>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>

        {/* DIAGRAM */}
        <div style={{ flex: '1 1 60%', border: '1.5px solid #ccc', borderRadius: 6, padding: '8px', background: 'white', minWidth: 0 }}>
          <TanqueSVG dim={dim} />
        </div>

        {/* INPUTS PANEL */}
        <div style={{ flex: '0 0 290px', background: '#f6f8f4', border: '1.5px solid #c0cca8', borderRadius: 8, padding: '16px' }}>

          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#1a3a1a', marginBottom: 14, borderBottom: '2px solid #a8b890', paddingBottom: 8 }}>
            📐 Predimensionamiento
          </div>

          {/* Estado */}
          <div style={{
            marginBottom: 14, borderRadius: 6, padding: '10px 12px',
            background: ok ? '#e8f5e8' : '#feeaea',
            border: `1.5px solid ${ok ? '#4a8a4a' : '#cc4444'}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: ok ? '#2a6a2a' : '#c00', marginBottom: 6 }}>
              {ok ? '✓ Volumen OK' : '✗ Revisar volumen'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 11, color: '#333' }}>
              <span>Requerido:</span> <strong>{fmt(volumenTE)} m³</strong>
              <span>Reserva ({dim.porcentajeReserva}%):</span> <strong>{fmt(volumenTotal - volumenTE)} m³</strong>
              <span>Calculado:</span> <strong>{fmt(volumenCalc)} m³</strong>
              <span>Área base:</span> <strong>{fmt(parseNum(dim.largo) * parseNum(dim.ancho))} m²</strong>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: '#5a7a3a', display: 'block', marginBottom: 4 }}>
              % Reserva de Volumen
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="range" name="porcentajeReserva" min="0" max="100" step="1"
                value={dim.porcentajeReserva} onChange={handleDim}
                style={{ flex: 1 }} />
              <input type="number" name="porcentajeReserva" value={dim.porcentajeReserva} onChange={handleDim}
                style={{ width: 50, padding: '2px 4px', fontSize: 13, fontWeight: 'bold', border: '1px solid #c0cca8', borderRadius: 4, textAlign: 'center' }} />
              <span style={{ fontSize: 12, fontWeight: 'bold' }}>%</span>
            </div>
          </div>

          {/* Group 1: Geometría principal */}
          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#5a7a3a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            ★ Geometría principal
          </div>
          <DimInput label="Largo (L)" name="largo" value={dim.largo} onChange={handleDim} highlight />
          <DimInput label="Ancho (A)" name="ancho" value={dim.ancho} onChange={handleDim} highlight />
          <DimInput label="Altura Agua (H)" name="alturaAgua" value={dim.alturaAgua} onChange={handleDim} highlight />
          <DimInput label="Alt. Limpieza" name="alturaLimpieza" value={dim.alturaLimpieza} onChange={handleDim} />
          <DimInput label="Borde Libre (bl)" name="bordeLibre" value={dim.bordeLibre} onChange={handleDim} />
          <DimInput label="Altura Total (HT)" name="alturaTotal" value={dim.alturaTotal} onChange={handleDim} />

          {/* Group 2: Niveles y tuberías */}
          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#5a7a3a', textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 6px' }}>
            Nivel y tuberías
          </div>
          <DimInput label="Nivel Fondo (m)" name="nivelFondoTanque" value={dim.nivelFondoTanque} onChange={handleDim} />
          <DimInput label="H. Techo (Ht)" name="htecho" value={dim.htecho} onChange={handleDim} />
          <DimInput label="H. Ingreso (Hi)" name="hingreso" value={dim.hingreso} onChange={handleDim} />
          <DimInput label="H. Rebose (Hr)" name="hrebose" value={dim.hrebose} onChange={handleDim} />
          <DimInput label="Altura Libre (HL)" name="alturalibre" value={dim.alturalibre} onChange={handleDim} />

          <button onClick={() => setDim(DEFAULT_DIM)}
            style={{ width: '100%', marginTop: 12, padding: '8px', fontSize: 12, background: '#4a5a3a', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', letterSpacing: 0.5 }}>
            ↺ Restablecer valores por defecto
          </button>
        </div>
      </div>

      {/* ══ Bottom summary ══ */}
      <div style={{ marginTop: 24, fontSize: 13 }}>
        <p style={{ marginBottom: 10 }}>Tanque Elevado de Concreto de cuyas dimensiones serán:</p>
        <div style={{ display: 'flex', gap: 60 }}>
          <div>
            {[
              ['Largo (L)', dim.largo],
              ['Ancho (A)', dim.ancho],
              ['Altura del Agua (H)', dim.alturaAgua],
              ['Altura de Limpieza (hl)', dim.alturaLimpieza],
              ['Borde Libre (bl)', dim.bordeLibre],
              ['Altura total (HT)', dim.alturaTotal],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', marginBottom: 5 }}>
                <span style={{ width: 215, textAlign: 'right', paddingRight: 10 }}>{l} =</span>
                <strong style={{ fontSize: 14, fontFamily: mono }}>{fmt(v)} m</strong>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 72, fontSize: 13, color: '#444' }}>
            Diametro de rebose según el RNE es de 4&quot;
          </div>
        </div>
      </div>

    </div>
  );
};

export default Tanque;