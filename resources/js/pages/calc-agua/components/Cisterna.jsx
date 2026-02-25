import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT = {
    largo: 4.40,
    ancho: 2.70,
    alturaUtil: 1.90,
    bordeLibre: 0.50,
    nivelagua: 0.65,
    alturaTecho: 0.20,
};

const parseNum = (v, fb = 0) => {
    if (v === '' || v === null || v === undefined) return fb;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fb;
};
const fmt = (v, d = 2) => Number.isFinite(+v) ? (+v).toFixed(d) : '0.00';
const sign = (v) => (+v >= 0 ? `+${fmt(v)}` : fmt(v));

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DIAGRAM — Cisterna (subterránea)
// ═══════════════════════════════════════════════════════════════════════════════
function CisternaSVG({ dim }) {
    const d = { ...DEFAULT, ...dim };

    // ── Elevation calculations ──
    const nv = useMemo(() => {
        const top = parseNum(d.nivelagua);            // +0.65  outer top slab
        const altIng = parseNum(d.alturaUtil) <= 12 ? 0.15
            : parseNum(d.alturaUtil) <= 30 ? 0.20 : 0.30;
        const hrVal = parseNum(d.alturaUtil) > 30 ? 0.15 : 0.10;

        const interiorTop = top - 0.20;                     // inner cavity top (approx slab offset)
        const n1 = +(top - 0.20).toFixed(4);               // +0.45 → top of inner cavity
        const n2 = +(n1 - parseNum(d.alturaTecho)).toFixed(4); // after H.techo
        const n3 = +(n2 - altIng).toFixed(4);              // after H.ingreso
        const n4 = +(n3 - hrVal).toFixed(4);               // after H.rebose
        const n5 = +(n4 - parseNum(d.alturaUtil)).toFixed(4);  // bottom
        const ntn = 0.00;                                   // NTN ground level

        return { top, interiorTop: n1, n1, n2, n3, n4, n5, altIng, hrVal, ntn };
    }, [d]);

    // ── SVG layout ──
    const VW = 820, VH = 520;
    const tL = 46, tW = 270;
    const svgTop = 60, svgBot = 450;
    const span = svgBot - svgTop;
    const wT = 16, slabT = 16; // wall thickness, slab thickness

    // Map elevation → y (top=svgTop corresponds to nv.top, bottom=svgBot to nv.n5 - slabExtra)
    const elevMin = nv.n5 - 0.15; // a bit below bottom
    const elevMax = nv.top + 0.05;
    const e2y = (e) => svgTop + ((elevMax - e) / (elevMax - elevMin)) * span;

    const yTop = e2y(nv.top);          // outer top slab top
    const yIntTop = e2y(nv.n1);           // inner cavity top
    const yN2 = e2y(nv.n2);           // after techo
    const yN3 = e2y(nv.n3);           // after ingreso (rebose top / max water)
    const yN4 = e2y(nv.n4);           // after rebose (water surface)
    const yN5 = e2y(nv.n5);           // bottom inner
    const yFondo = yN5 + slabT;          // outer bottom
    const yNTN = e2y(nv.ntn);          // ground level y

    const iL = tL + wT, iR = tL + tW - wT, iW = iR - iL;

    // Annotation zone
    const aX = tL + tW + 32;
    const bW = 30;
    const lX = aX + bW + 10;
    const nBW = 128, nBX = VW - nBW - 6;

    // ── Bracket ──
    const Bracket = ({ y1, y2, color, label, sub, val }) => {
        if (!Number.isFinite(y1) || !Number.isFinite(y2) || Math.abs(y2 - y1) < 4) return null;
        const my = (y1 + y2) / 2;
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

    // ── Nivel box ──
    const NvBox = ({ y, label, red, bold }) => (
        <g>
            <line x1={iR + 2} y1={y} x2={nBX - 8} y2={y}
                stroke={red ? '#c00' : '#aaa'} strokeWidth={red ? 1.5 : 0.8} strokeDasharray={red ? '0' : '5 3'} />
            <line x1={nBX - 8} y1={y} x2={nBX} y2={y} stroke={red ? '#c00' : '#555'} strokeWidth={1.5} />
            <rect x={nBX} y={y - 11} width={nBW} height={22} rx={2}
                fill={red ? '#fff0f0' : 'white'} stroke={red ? '#c00' : '#999'} strokeWidth={1.5} />
            <text x={nBX + nBW / 2} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill={red ? '#c00' : '#222'} fontFamily="'Courier New',monospace"
                fontWeight={bold || red ? 'bold' : 'normal'}>
                Nivel = {label} m
            </text>
        </g>
    );

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}
            xmlns="http://www.w3.org/2000/svg">
            <rect width={VW} height={VH} fill="white" />

            {/* ── Hatching def ── */}
            <defs>
                <pattern id="ch" patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(45)">
                    <line x1={0} y1={0} x2={0} y2={7} stroke="#999" strokeWidth={1} opacity={0.5} />
                </pattern>
            </defs>

            {/* ── Ground line (NTN) ── */}
            <line x1={tL - 50} y1={yNTN} x2={tL + tW + 60} y2={yNTN}
                stroke="#555" strokeWidth={1.5} strokeDasharray="10 4" />
            <text x={tL - 48} y={yNTN - 5} fontSize={10} fill="#555" fontFamily="'Courier New',monospace">NTN</text>

            {/* ── Ground fill (soil above NTN on sides) ── */}
            <rect x={tL - 50} y={yNTN} width={46} height={yFondo - yNTN + 20} fill="#e8e0c8" opacity={0.4} />
            <rect x={tL + tW + 4} y={yNTN} width={46} height={yFondo - yNTN + 20} fill="#e8e0c8" opacity={0.4} />

            {/* ── Outer concrete walls ── */}
            <rect x={tL} y={yTop} width={tW} height={yFondo - yTop}
                fill="#c8c8c0" stroke="#666" strokeWidth={2} rx={2} />
            {/* Hatch overlays on walls */}
            <rect x={tL} y={yTop} width={wT} height={yFondo - yTop} fill="url(#ch)" />
            <rect x={iR} y={yTop} width={wT} height={yFondo - yTop} fill="url(#ch)" />
            <rect x={tL} y={yTop} width={tW} height={yIntTop - yTop} fill="url(#ch)" />
            <rect x={tL} y={yN5} width={tW} height={slabT} fill="url(#ch)" />

            {/* ── Inner cavity white ── */}
            <rect x={iL} y={yIntTop} width={iW} height={yN5 - yIntTop} fill="white" />

            {/* ── Borde libre zone (intTop → n3 = max water level = rebose) ── */}
            <rect x={iL} y={yIntTop} width={iW} height={Math.max(yN4 - yIntTop, 0)} fill="#f0f0ea" />

            {/* ── Water zone (n4 → n5) ── */}
            <rect x={iL} y={yN4} width={iW} height={Math.max(yN5 - yN4, 0)} fill="#c5e5f8" />

            {/* ── Inner border ── */}
            <rect x={iL} y={yIntTop} width={iW} height={yN5 - yIntTop} fill="none" stroke="#888" strokeWidth={1.5} />

            {/* ── BORDE LIBRE text ── */}
            {(yN4 - yIntTop) > 30 && (
                <text x={iL + iW / 2} y={(yIntTop + yN4) / 2}
                    fontSize={20} fontFamily="'Courier New',monospace" fontWeight="bold"
                    fill="#bbb" textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(-18,${iL + iW / 2},${(yIntTop + yN4) / 2})`}
                    letterSpacing={3} opacity={0.65}>
                    BORDE LIBRE
                </text>
            )}

            {/* ── Dashed internal lines ── */}
            {[
                { y: yN2, c: '#cc7744' },
                { y: yN3, c: '#4488cc' },
                { y: yN4, c: '#c03030' },
                { y: yN5, c: '#aaa' },
            ].map((l, i) => (
                <line key={i} x1={iL + 4} y1={l.y} x2={iR - 4} y2={l.y}
                    stroke={l.c} strokeWidth={1.5} strokeDasharray="8 5" />
            ))}

            {/* ── Pipes on right wall ── */}
            {/* Ingreso (orange) */}
            <rect x={iR + 1} y={yN2 - 12} width={7} height={24} fill="#cc7744" stroke="#994422" strokeWidth={1} />
            <rect x={iR - 8} y={yN2 - 8} width={22} height={16} fill="#cc7744" stroke="#994422" strokeWidth={1.5} rx={2} />
            {/* Rebose (green) */}
            <rect x={iR + 1} y={yN3 - 12} width={7} height={24} fill="#559944" stroke="#337722" strokeWidth={1} />
            <rect x={iR - 8} y={yN3 - 8} width={22} height={16} fill="#559944" stroke="#337722" strokeWidth={1.5} rx={2} />

            {/* ── Top nivel label box ── */}
            <rect x={tL} y={yTop - 18} width={120} height={20} rx={2}
                fill="#1a1a1a" stroke="#1a1a1a" strokeWidth={1} />
            <text x={tL + 60} y={yTop - 8} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill="white" fontFamily="'Courier New',monospace" fontWeight="bold">
                Nivel = {sign(nv.top)} m
            </text>

            {/* NTN label at right */}
            <rect x={aX + 10} y={yNTN - 12} width={100} height={20} rx={2} fill="white" stroke="#c00" strokeWidth={1.5} />
            <text x={aX + 60} y={yNTN - 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill="#c00" fontFamily="'Courier New',monospace" fontWeight="bold">
                NTN = +0.00 m
            </text>

            {/* ── Brackets ── */}
            <Bracket y1={yIntTop} y2={yN2} color="#994422" label="H. techo" sub="(Ht)" val={fmt(d.alturaTecho)} />
            <Bracket y1={yN2} y2={yN3} color="#4488cc" label="H. ingreso" sub="(Hi)" val={fmt(nv.altIng)} />
            <Bracket y1={yN3} y2={yN4} color="#c03030" label="H. rebose" sub="(Hr)" val={fmt(nv.hrVal)} />

            {/* Altura agua label */}
            {(yN5 - yN4) > 16 && (
                <text x={lX} y={(yN4 + yN5) / 2} dominantBaseline="middle"
                    fontSize={13} fill="#111" fontFamily="'Courier New',monospace">
                    Altura de agua (Ha) = <tspan fontWeight="bold">{fmt(d.alturaUtil)} m</tspan>
                </text>
            )}

            {/* ── Nivel boxes ── */}
            <NvBox y={yIntTop} label={sign(nv.n1)} />
            <NvBox y={yN2} label={sign(nv.n2)} />
            <NvBox y={yN3} label={sign(nv.n3)} />
            <NvBox y={yN4} label={sign(nv.n4)} red />
            <NvBox y={yN5} label={sign(nv.n5)} />

            {/* ── H dimension indicator (left side) ── */}
            <line x1={tL - 22} y1={yIntTop} x2={tL - 22} y2={yN5} stroke="#333" strokeWidth={1.5} />
            <line x1={tL - 30} y1={yIntTop} x2={tL - 14} y2={yIntTop} stroke="#333" strokeWidth={1.5} />
            <line x1={tL - 30} y1={yN5} x2={tL - 14} y2={yN5} stroke="#333" strokeWidth={1.5} />
            <text x={tL - 40} y={(yIntTop + yN5) / 2} textAnchor="middle"
                transform={`rotate(-90,${tL - 40},${(yIntTop + yN5) / 2})`}
                fontSize={13} fontWeight="bold" fill="#333" fontFamily="'Courier New',monospace">
                H
            </text>

            {/* ── Largo dimension ── */}
            <line x1={iL} y1={yFondo + 22} x2={iR} y2={yFondo + 22} stroke="#333" strokeWidth={1.5} />
            <line x1={iL} y1={yFondo + 16} x2={iL} y2={yFondo + 28} stroke="#333" strokeWidth={1.5} />
            <line x1={iR} y1={yFondo + 16} x2={iR} y2={yFondo + 28} stroke="#333" strokeWidth={1.5} />
            <text x={(iL + iR) / 2} y={yFondo + 40} textAnchor="middle"
                fontSize={12} fill="#333" fontFamily="'Courier New',monospace">
                L = {fmt(d.largo)} m
            </text>
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DimInput
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
            <label style={{ fontSize: 12, color: '#222', fontWeight: highlight ? '700' : '500', flex: 1 }}>
                {label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="number" step="0.01" name={name} value={value} onChange={onChange}
                    style={{
                        width: 82, padding: '5px 8px', fontSize: 15, fontWeight: 'bold',
                        border: `2px solid ${highlight ? '#d4a020' : '#3a7abf'}`,
                        borderRadius: 4, color: '#000', background: 'white',
                        textAlign: 'right', fontFamily: 'inherit',
                    }} />
                <span style={{ fontSize: 12, color: '#666', minWidth: 14 }}>m</span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Cisterna = ({ initialData, editMode, onChange, globalDemandaTotal }) => {
    const [consumoDiario, setConsumoDiario] = useState(
        (globalDemandaTotal && globalDemandaTotal > 0) ? globalDemandaTotal : (initialData?.consumoDiario ?? 0)
    );
    const [dim, setDim] = useState(() => {
        const s = initialData || {};
        return {
            largo: parseNum(s.largo, DEFAULT.largo),
            ancho: parseNum(s.ancho, DEFAULT.ancho),
            alturaUtil: parseNum(s.alturaUtil, DEFAULT.alturaUtil),
            bordeLibre: parseNum(s.bordeLibre, DEFAULT.bordeLibre),
            nivelagua: parseNum(s.nivelagua, DEFAULT.nivelagua),
            alturaTecho: parseNum(s.alturaTecho, DEFAULT.alturaTecho),
        };
    });

    useEffect(() => {
        if (globalDemandaTotal > 0) setConsumoDiario(parseFloat(globalDemandaTotal));
    }, [globalDemandaTotal]);

    useEffect(() => {
        if (!initialData) return;
        const s = initialData;
        setDim({
            largo: parseNum(s.largo, DEFAULT.largo),
            ancho: parseNum(s.ancho, DEFAULT.ancho),
            alturaUtil: parseNum(s.alturaUtil, DEFAULT.alturaUtil),
            bordeLibre: parseNum(s.bordeLibre, DEFAULT.bordeLibre),
            nivelagua: parseNum(s.nivelagua, DEFAULT.nivelagua),
            alturaTecho: parseNum(s.alturaTecho, DEFAULT.alturaTecho),
        });
    }, [initialData]);

    const handleDim = (e) => {
        const { name, value } = e.target;
        setDim(p => ({ ...p, [name]: value === '' ? '' : parseNum(value) }));
    };

    // ── Calculations ──
    const ceil1 = (v) => Math.ceil(v * 10) / 10;
    const volumenCisterna = useMemo(() => ceil1((3 / 4) * (parseFloat(consumoDiario) || 0) / 1000), [consumoDiario]);
    const volumenTotalMinimo = volumenCisterna;
    const alturaAguaMin = useMemo(() => {
        const area = parseNum(dim.largo) * parseNum(dim.ancho);
        return area > 0 ? (volumenTotalMinimo / area) : 0;
    }, [volumenTotalMinimo, dim.largo, dim.ancho]);
    const volumenCalculado = useMemo(() => parseNum(dim.largo) * parseNum(dim.ancho) * parseNum(dim.alturaUtil), [dim]);
    const alturaTotal = useMemo(() => +(parseNum(dim.alturaUtil) + parseNum(dim.bordeLibre) + parseNum(dim.alturaTecho)).toFixed(2), [dim]);
    const ok = volumenCalculado >= volumenCisterna;

    const cisternaData = useMemo(() => {
        const altIng = parseNum(dim.alturaUtil) <= 12 ? 0.15 : parseNum(dim.alturaUtil) <= 30 ? 0.20 : 0.30;
        const hrVal = parseNum(dim.alturaUtil) > 30 ? 0.15 : 0.10;
        const n1 = +(parseNum(dim.nivelagua) - 0.20).toFixed(4);
        const n2 = +(n1 - parseNum(dim.alturaTecho)).toFixed(4);
        const n3 = +(n2 - altIng).toFixed(4);
        const n4 = +(n3 - hrVal).toFixed(4);
        const n5 = +(n4 - parseNum(dim.alturaUtil)).toFixed(4);
        return { altIng, hrVal, n1, n2, n3, n4, n5, nivel5: n5 };
    }, [dim]);

    const sendUpdate = useCallback(() => {
        const data = { consumoDiario, ...dim, volumenCisterna, volumenCalculado, alturaTotal, ...cisternaData };
        document.dispatchEvent(new CustomEvent('cisterna-updated', { detail: data }));
        if (onChange) onChange(data);
    }, [consumoDiario, dim, volumenCisterna, volumenCalculado, alturaTotal, cisternaData, onChange]);

    useEffect(() => { const t = setTimeout(sendUpdate, 150); return () => clearTimeout(t); }, [sendUpdate]);

    useEffect(() => {
        const onD = (e) => setConsumoDiario(parseFloat(e.detail?.totalCaudal || 0));
        document.addEventListener('demanda-diaria-updated', onD);
        return () => document.removeEventListener('demanda-diaria-updated', onD);
    }, []);

    const font = "'Times New Roman', Georgia, serif";
    const mono = "'Courier New', monospace";

    return (
        <div style={{ fontFamily: font, color: '#111', background: 'white', padding: '20px 24px' }}>

            {/* ══ HEADER ══ */}
            <div style={{ borderBottom: '3px solid #2a5a8a', paddingBottom: 8, marginBottom: 18 }}>
                <div style={{ fontSize: 17, fontWeight: 'bold', color: '#0a2a4a' }}>2.1. CISTERNA</div>
            </div>

            {/* ══ 2.1.1 ══ */}
            <div style={{ background: '#dce8f0', border: '1px solid #90b0cc', padding: '6px 12px', marginBottom: 14 }}>
                <strong style={{ fontSize: 13 }}>2.1.1. CALCULO DE VOLUMEN DE LA CISTERNA</strong>
            </div>

            {/* Formula */}
            <div style={{ border: '1px solid #aaa', textAlign: 'center', padding: '9px', marginBottom: 14, fontWeight: 'bold', fontSize: 13, background: '#fafaf4' }}>
                VOL. DE CISTERNA = 3/4 × CONSUMO DIARIO TOTAL
            </div>

            {/* Result cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14, maxWidth: 880 }}>
                {[
                    { l: 'Consumo Diario', v: `${fmt(consumoDiario)} Lt`, c: '#1a4a7a', bg: '#f8fafc', icon: 'fas fa-tint' },
                    { l: 'Vol. de Cisterna', v: `${fmt(volumenCisterna)} m³`, c: '#1a4a7a', bg: '#eaf0fa' },
                    { l: 'Vol. Total mínimo', v: `${fmt(volumenTotalMinimo)} m³`, c: '#2a6a4a', bg: '#eaf5ee' },
                    { l: 'Altura de agua mín.', v: `${fmt(alturaAguaMin)} m`, c: '#6a3a1a', bg: '#faf0e8' },
                ].map(({ l, v, c, bg, icon }) => (
                    <div key={l} style={{ border: `2px solid ${c}`, borderRadius: 6, padding: '10px 14px', textAlign: 'center', background: bg }}>
                        <div style={{ fontSize: 10, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {icon && <i className={`${icon} mr-1 opacity-70`}></i>} {l}
                        </div>
                        <div style={{ fontSize: 19, fontWeight: 'bold', color: c }}>{v}</div>
                    </div>
                ))}
            </div>

            {/* Consumo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 13 }}>
                <span style={{ color: '#555' }}>Consumo Diario Total (Lt/día):</span>
                <input type="number" value={consumoDiario || ''} readOnly
                    style={{ width: 110, padding: '4px 8px', border: '1px solid #bbb', borderRadius: 3, fontSize: 13, color: '#000', background: '#f5f5f2', fontFamily: mono }} />
                {!consumoDiario && <span style={{ fontSize: 11, color: '#e07030' }}>⚠ Ingresa datos en sección 1</span>}
            </div>

            {/* Dims + callout */}
            <p style={{ marginBottom: 10, fontSize: 13 }}>Cisterna de Concreto de cuyas dimensiones serán:</p>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                    {[['Largo (L)', 'largo'], ['Ancho (A)', 'ancho'], ['Altura agua (H)', 'alturaUtil']].map(([l, k]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 150, textAlign: 'right', fontSize: 13 }}>{l} =</span>
                            <input type="number" step="0.01" name={k} value={dim[k]} onChange={handleDim}
                                style={{ width: 82, padding: '4px 9px', fontSize: 15, fontWeight: 'bold', border: '2px solid #2a5a9a', borderRadius: 4, color: '#000', background: 'white', textAlign: 'right', fontFamily: mono }} />
                            <span style={{ fontSize: 13, color: '#444' }}>m</span>
                        </div>
                    ))}
                </div>
                <div style={{ border: '2px solid #2a5a8a', borderRadius: 5, padding: '10px 16px', background: '#f0f4fa', maxWidth: 215, fontSize: 12, fontWeight: 'bold', color: '#0a2a5a', textAlign: 'center', lineHeight: 1.55 }}>
                    Altura asumida como mínimo para mantenimiento y limpieza de la cisterna
                </div>
            </div>

            {/* VOLUMEN box */}
            <div style={{ border: '2px solid #888', background: ok ? '#f5f5d8' : '#fff0f0', padding: '10px 20px', textAlign: 'center', fontWeight: 'bold', fontSize: 15, marginBottom: 22 }}>
                VOLUMEN DE CISTERNA = {fmt(volumenCalculado)} m³
                {!ok && <span style={{ color: '#c00', marginLeft: 12, fontSize: 12 }}>⚠ CORREGIR DIMENSIONES (mín. {fmt(volumenCisterna)} m³)</span>}
            </div>

            {/* ══ 2.1.2 ══ */}
            <div style={{ background: '#dce8f0', border: '1px solid #90b0cc', padding: '6px 12px', marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>2.1.2. DIMENSIONES DE LA CISTERNA</strong>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
                <tbody>
                    {[
                        ['ANCHO', 'Ancho de la Cisterna'],
                        ['LARGO', 'Largo de la Cisterna'],
                        ['ALTURA DE AGUA', 'Altura de agua de la Cisterna'],
                        ['ALTURA DE TUB. REBOSE', 'La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0,10 m'],
                        ['ALTURA DE TUB. DE INGRESO', 'La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0,15 m'],
                        ['ALTURA DE NIVEL DE TECHO', 'La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0,20 m'],
                    ].map(([k, v]) => (
                        <tr key={k}>
                            <td style={{ border: '1px solid #bbb', padding: '5px 8px', fontWeight: 'bold', width: '28%', background: '#f4f8fc', fontSize: 11 }}>{k}</td>
                            <td style={{ border: '1px solid #bbb', padding: '5px 8px', verticalAlign: 'top' }}>{v}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ══ DIAGRAM + INPUTS ══ */}
            <p style={{ marginBottom: 10, fontSize: 13 }}>Cisterna cuyas dimensiones serán:</p>

            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>

                {/* DIAGRAM */}
                <div style={{ flex: '1 1 60%', border: '1.5px solid #ccc', borderRadius: 6, padding: '8px', background: 'white', minWidth: 0 }}>
                    <CisternaSVG dim={dim} />
                </div>

                {/* INPUTS PANEL */}
                <div style={{ flex: '0 0 290px', background: '#f4f8fc', border: '1.5px solid #b0c8e0', borderRadius: 8, padding: '16px' }}>

                    <div style={{ fontSize: 14, fontWeight: 'bold', color: '#0a2a4a', marginBottom: 14, borderBottom: '2px solid #90b0cc', paddingBottom: 8 }}>
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
                            <span>Requerido:</span>  <strong>{fmt(volumenCisterna)} m³</strong>
                            <span>Calculado:</span>  <strong>{fmt(volumenCalculado)} m³</strong>
                            <span>Área base:</span>  <strong>{fmt(parseNum(dim.largo) * parseNum(dim.ancho))} m²</strong>
                            <span>H. total:</span>   <strong>{fmt(alturaTotal)} m</strong>
                        </div>
                    </div>

                    {/* Niveles calculados */}
                    <div style={{ marginBottom: 12, background: 'white', border: '1px solid #c0d4e8', borderRadius: 5, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, fontWeight: 'bold', color: '#2a5a8a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Niveles calculados
                        </div>
                        {[
                            ['Top slab', cisternaData.n1],
                            ['Techo', cisternaData.n2],
                            ['Ingreso', cisternaData.n3],
                            ['Rebose', cisternaData.n4],
                            ['Fondo', cisternaData.n5],
                        ].map(([l, v]) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                <span style={{ color: '#555' }}>Nivel {l}:</span>
                                <strong style={{ fontFamily: mono }}>{sign(v)} m</strong>
                            </div>
                        ))}
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 'bold', color: '#1a4a7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                        ★ Geometría principal
                    </div>
                    <DimInput label="Largo (L)" name="largo" value={dim.largo} onChange={handleDim} highlight />
                    <DimInput label="Ancho (A)" name="ancho" value={dim.ancho} onChange={handleDim} highlight />
                    <DimInput label="Altura Útil (H)" name="alturaUtil" value={dim.alturaUtil} onChange={handleDim} highlight />
                    <DimInput label="Borde Libre (bl)" name="bordeLibre" value={dim.bordeLibre} onChange={handleDim} />

                    <div style={{ fontSize: 10, fontWeight: 'bold', color: '#1a4a7a', textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 6px' }}>
                        Nivel y techo
                    </div>
                    <DimInput label="Nivel agua (m)" name="nivelagua" value={dim.nivelagua} onChange={handleDim} />
                    <DimInput label="H. Techo (Ht)" name="alturaTecho" value={dim.alturaTecho} onChange={handleDim} />

                    <button onClick={() => setDim(DEFAULT)}
                        style={{ width: '100%', marginTop: 12, padding: '8px', fontSize: 12, background: '#2a4a6a', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', letterSpacing: 0.5 }}>
                        ↺ Restablecer valores por defecto
                    </button>
                </div>
            </div>

            {/* ══ Bottom summary ══ */}
            <div style={{ marginTop: 24, fontSize: 13 }}>
                <p style={{ marginBottom: 10 }}>Cisterna de Concreto de cuyas dimensiones serán:</p>
                <div style={{ display: 'flex', gap: 60 }}>
                    <div>
                        {[
                            ['Largo (L)', dim.largo],
                            ['Ancho (A)', dim.ancho],
                            ['Altura Útil de Agua (H)', dim.alturaUtil],
                            ['Borde Libre (bl)', dim.bordeLibre],
                            ['Altura total (HT)', alturaTotal],
                        ].map(([l, v]) => (
                            <div key={l} style={{ display: 'flex', marginBottom: 5 }}>
                                <span style={{ width: 230, textAlign: 'right', paddingRight: 10 }}>{l} =</span>
                                <strong style={{ fontSize: 14, fontFamily: mono }}>{fmt(v)} m</strong>
                            </div>
                        ))}
                    </div>
                    <div style={{ paddingTop: 60, fontSize: 13, color: '#444' }}>
                        Diametro de rebose según el RNE es de 4&quot;
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Cisterna;