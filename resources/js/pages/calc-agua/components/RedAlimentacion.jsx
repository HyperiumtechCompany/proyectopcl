import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import longEquival from '../lib/longitud-components.js';

// Configuration
const config = {
    diametros: {
        '1/2 pulg': { mm: 15, area: 0.50, pulg: '1/2' },
        '3/4 pulg': { mm: 20, area: 0.74, pulg: '3/4' },
        '1 pulg': { mm: 25, area: 1, pulg: '1' },
        '1 1/4 pulg': { mm: 32, area: 1.25, pulg: '1 1/4' },
        '1 1/2 pulg': { mm: 40, area: 1.5, pulg: '1 1/2' },
        '2 pulg': { mm: 50, area: 2, pulg: '2' },
        '2 1/2 pulg': { mm: 50, area: 2.5, pulg: '2' },
        '3 pulg': { mm: 50, area: 3, pulg: '2' },
        '4 pulg': { mm: 50, area: 4, pulg: '2' },
        '6 pulg': { mm: 50, area: 6, pulg: '2' },
    },
    accesoriosDisponibles: [
        { label: 'Codo de 45°', key: 'codo45' },
        { label: 'Codo de 90°', key: 'codo90' },
        { label: 'Tee', key: 'tee' },
        { label: 'Válvula Compuerta', key: 'valCompuerta' },
        { label: 'Válvula Check', key: 'valCheck' },
        { label: 'Canastilla', key: 'canastilla' },
        { label: 'Reducción 1', key: 'reduccion1' },
        { label: 'Reducción 2', key: 'reduccion2' }
    ]
};

// Data logic functions
const datosReales = {
    15: [[0.4, 0.1], [0.5, 0.15], [0.6, 0.2], [0.7, 0.27], [0.8, 0.35], [0.9, 0.44], [1, 0.5], [1.1, 0.58], [1.2, 0.7], [1.3, 0.82], [1.4, 0.95], [1.5, 1.1], [1.7, 1.4], [2, 2], [2.5, 3], [3, 4.5], [3.5, 6.2], [4, 8]],
    20: [[0.6, 0.1], [0.7, 0.12], [0.8, 0.15], [0.9, 0.19], [1, 0.25], [1.2, 0.35], [1.4, 0.42], [1.5, 0.5], [1.7, 0.65], [2, 0.8], [2.5, 1.25], [3, 1.8], [3.5, 2.4], [4, 3.2], [4.5, 4.1], [5, 5], [6, 7.2], [7, 9.8], [8, 12.5], [9, 15.8], [10, 19.5]],
    25: [[0.8, 0.1], [0.9, 0.12], [1, 0.15], [1.2, 0.22], [1.4, 0.26], [1.5, 0.3], [1.7, 0.38], [2, 0.5], [2.5, 0.78], [3, 1.1], [3.5, 1.5], [4, 2], [4.5, 2.55], [5, 3.1], [5.5, 3.75], [6, 4.5], [7, 6.2], [8, 8], [9, 10.2], [10, 12.5], [12, 18], [15, 28], [18, 40], [20, 50]],
    32: [[1, 0.1], [1.2, 0.14], [1.4, 0.17], [1.5, 0.2], [1.7, 0.25], [2, 0.3], [2.2, 0.38], [2.5, 0.48], [3, 0.65], [3.5, 0.85], [4, 1.15], [4.5, 1.45], [5, 1.8], [5.5, 2.2], [6, 2.6], [7, 3.6], [8, 4.6], [9, 5.8], [10, 7.2], [12, 10.5], [15, 16], [18, 22], [20, 28], [25, 44], [30, 63], [35, 86], [40, 112]],
    40: [[1.5, 0.08], [2, 0.1], [2.2, 0.12], [2.5, 0.15], [3, 0.2], [3.5, 0.27], [4, 0.35], [4.5, 0.44], [5, 0.55], [5.5, 0.67], [6, 0.8], [7, 1.1], [8, 1.4], [9, 1.75], [10, 2.2], [12, 3.2], [15, 5], [18, 7.2], [20, 8.9], [25, 14], [30, 20], [35, 27], [40, 35]],
    50: [[2, 0.06], [2.5, 0.08], [3, 0.1], [3.5, 0.12], [4, 0.15], [4.5, 0.19], [5, 0.25], [5.5, 0.29], [6, 0.35], [7, 0.48], [8, 0.6], [9, 0.75], [10, 0.95], [12, 1.35], [15, 2.1], [18, 3], [20, 3.8], [25, 6], [30, 8.5], [35, 11.5], [40, 15], [45, 19], [50, 23]]
};

const asignarColor = d => ({ 15: '#e74c3c', 20: '#F44336', 25: '#9C27B0', 32: '#FF9800', 40: '#2196F3', 50: '#4CAF50' })[d] || '#333';

const interpolarLog = (x, pts) => {
    if (!pts || !pts.length || x <= 0) return null;
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        if (x >= x1 && x <= x2) return Math.exp(Math.log(y1) + (Math.log(y2) - Math.log(y1)) * (Math.log(x) - Math.log(x1)) / (Math.log(x2) - Math.log(x1)));
    }
    return null;
};

const generarCurva = d => {
    const pts = datosReales[d], c = [];
    if (!pts) return c;
    for (let i = 0; i <= 200; i++) {
        const x = 0.4 * Math.pow(50 / 0.4, i / 200), y = interpolarLog(x, pts);
        if (y !== null) c.push([x, y]);
    }
    return c;
};

const dCurvas = Object.fromEntries(Object.keys(datosReales).map(d => [d, generarCurva(d)]));

export default function RedAlimentacion({ initialData, canEdit, editMode, onChange, cisternaData }) {
    const isEdit = canEdit && editMode;
    const data = initialData || {};
    const chartRef = useRef(null), myChart = useRef(null);

    const [volCisterna, setVolCisterna] = useState(data?.volCisterna || 2000);
    const [volRequerido, setVolRequerido] = useState(data?.volRequerido || 0);
    const [consumoDiario, setConsumoDiario] = useState(data?.consumoDiario || 0);
    const [tiempoLlenado, setTiempoLlenado] = useState(data?.tiempoLlenado || 10);
    const [nivelTerreno, setNivelTerreno] = useState(data?.nivelTerreno || 0);
    const [presionConn, setPresionConn] = useState(data?.presionConn || 10.00);
    const [presionSalida, setPresionSalida] = useState(data?.presionSalida || 2.00);
    const [nivIngCist, setNivIngCist] = useState(data?.nivIngCist || 0);

    const [diamConn, setDiamConn] = useState(data?.diamConn || '1 pulg');
    const [micro, setMicro] = useState(data?.micro || 'SI');
    const [lTuberia, setLTuberia] = useState(data?.lTuberia || 5.40);
    const [hfMed, setHfMed] = useState(data?.hfMed || 1.10);
    const [accs, setAccs] = useState(data?.accs || [
        { tipo: 'codo45', cantidad: 0, leq: 0.477 }, { tipo: 'codo90', cantidad: 3, leq: 1.023 },
        { tipo: 'tee', cantidad: 1, leq: 2.045 }, { tipo: 'valCompuerta', cantidad: 2, leq: 0.216 },
        { tipo: 'valCheck', cantidad: 0, leq: 2.114 }, { tipo: 'reduccion2', cantidad: 1, leq: 1.045 }
    ]);
    const [anCarga, setAnCarga] = useState(data?.anCarga || [{ d: 25.4 }, { d: 31.8 }, { d: 38.1 }]);
    const [modTuberia, setModTuberia] = useState(data?.modTuberia || []);

    const [diaSel, setDiaSel] = useState(data?.diaSel || '1 pulg');
    const [diaLTub, setDiaLTub] = useState(data?.diaLTub || 15.88);
    const [diaAccs, setDiaAccs] = useState(data?.diaAccs || [
        { tipo: 'codo45', cantidad: 0, leq: 0.477 }, { tipo: 'codo90', cantidad: 7, leq: 1.023 },
        { tipo: 'tee', cantidad: 2, leq: 2.045 }, { tipo: 'valCompuerta', cantidad: 2, leq: 0.216 },
        { tipo: 'valCheck', cantidad: 0, leq: 2.114 }, { tipo: 'reduccion2', cantidad: 0, leq: 1.045 }
    ]);

    const qLlenado = useMemo(() => (tiempoLlenado > 0 && volCisterna > 0) ? parseFloat((volCisterna / (tiempoLlenado * 3600)).toFixed(3)) : 0, [volCisterna, tiempoLlenado]);
    const qLlenadoM3h = parseFloat((qLlenado * 3.6).toFixed(2));
    const nivTubConn = parseFloat((nivelTerreno - 0.70).toFixed(2));
    const altEstatica = parseFloat((nivIngCist - nivTubConn).toFixed(2));
    const cargaDispTot = parseFloat((presionConn - presionSalida - altEstatica).toFixed(2));

    const getLeq = (tp, d) => longEquival[tp]?.[d] || 0;
    const calcV = (q, d) => config.diametros[d]?.area ? +((q / 1000) / (Math.PI * Math.pow(config.diametros[d].area * 2.54 / 100, 2) / 4)).toFixed(3) : 0;
    const calcS = (q, d) => config.diametros[d]?.area && q > 0 ? +(Math.pow((q / 1000 / 0.2785 / 140) / Math.pow(config.diametros[d].area * 2.54 / 100, 2.63), 1.85)).toFixed(6) : 0;

    const vel = useMemo(() => calcV(qLlenado, diamConn), [qLlenado, diamConn]);
    const leqT = useMemo(() => Math.round(accs.reduce((s, a) => s + a.cantidad * a.leq, 0) * 1000) / 1000, [accs]);
    const lTot = parseFloat((leqT + lTuberia).toFixed(2));
    const sH = useMemo(() => calcS(qLlenado, diamConn), [qLlenado, diamConn]);
    const hf = parseFloat((lTot * sH).toFixed(2));
    const hfMedV = micro === 'SI' ? parseFloat(hfMed.toFixed(2)) : 0;
    const pTotCarga = parseFloat((hf + hfMedV).toFixed(2));
    const cDisp = parseFloat((cargaDispTot - hfMed - hf).toFixed(2));

    const dVel = useMemo(() => calcV(qLlenado, diaSel), [qLlenado, diaSel]);
    const dLeqT = useMemo(() => Math.round(diaAccs.reduce((s, a) => s + a.cantidad * a.leq, 0) * 1000) / 1000, [diaAccs]);
    const dLTot = parseFloat((dLeqT + diaLTub).toFixed(2));
    const dS = useMemo(() => calcS(qLlenado, diaSel), [qLlenado, diaSel]);
    const dHf = parseFloat((dLTot * dS).toFixed(2));
    const dCDisp = parseFloat((cDisp - dHf).toFixed(2));

    useEffect(() => {
        const hd = e => {
            if (e.detail?.volumenCalculado !== undefined) {
                setVolCisterna(parseFloat(e.detail.volumenCalculado) * 1000);
            }
            if (e.detail?.volumenCisterna !== undefined) {
                setVolRequerido(parseFloat(e.detail.volumenCisterna) * 1000);
            }
            if (e.detail?.consumoDiario !== undefined) {
                setConsumoDiario(parseFloat(e.detail.consumoDiario));
            }
            if (e.detail?.n2 !== undefined) setNivIngCist(parseFloat(e.detail.n2));
        };
        document.addEventListener('cisterna-updated', hd);
        return () => document.removeEventListener('cisterna-updated', hd);
    }, []);

    // Also sync from prop if available (handles tab switching)
    useEffect(() => {
        if (cisternaData?.volumenCalculado) {
            setVolCisterna(parseFloat(cisternaData.volumenCalculado) * 1000);
        }
        if (cisternaData?.volumenCisterna) {
            setVolRequerido(parseFloat(cisternaData.volumenCisterna) * 1000);
        }
        if (cisternaData?.consumoDiario) {
            setConsumoDiario(parseFloat(cisternaData.consumoDiario));
        }
        if (cisternaData?.n2 !== undefined) {
            setNivIngCist(parseFloat(cisternaData.n2));
        }
    }, [cisternaData?.volumenCalculado, cisternaData?.volumenCisterna, cisternaData?.consumoDiario, cisternaData?.n2]);

    useEffect(() => {
        if (onChange) onChange({ volCisterna, volRequerido, consumoDiario, tiempoLlenado, nivelTerreno, presionConn, presionSalida, nivIngCist, diamConn, micro, lTuberia, hfMed, accs, anCarga, modTuberia, diaSel, diaLTub, diaAccs });
    }, [onChange, volCisterna, volRequerido, consumoDiario, tiempoLlenado, nivelTerreno, presionConn, presionSalida, nivIngCist, diamConn, micro, lTuberia, hfMed, accs, anCarga, modTuberia, diaSel, diaLTub, diaAccs]);

    useEffect(() => { setAccs(prev => prev.map(a => ({ ...a, leq: getLeq(a.tipo, diamConn) }))); }, [diamConn]);
    useEffect(() => { setDiaAccs(prev => prev.map(a => ({ ...a, leq: getLeq(a.tipo, diaSel) }))); }, [diaSel]);

    useEffect(() => {
        if (!myChart.current && chartRef.current) {
            myChart.current = echarts.init(chartRef.current);
            window.addEventListener('resize', () => myChart.current?.resize());
        }
        if (myChart.current) {
            const series = Object.keys(dCurvas).map(d => ({ name: `Ø ${d} mm`, type: 'line', smooth: false, showSymbol: false, data: dCurvas[d], lineStyle: { color: asignarColor(d), width: 2 }, z: 1 }));
            const dMm = config.diametros[diamConn]?.mm || 25, perd = interpolarLog(qLlenadoM3h, datosReales[dMm]);
            if (perd && qLlenadoM3h > 0) series.push({ name: 'Punto', type: 'scatter', data: [[qLlenadoM3h, perd]], symbolSize: 12, itemStyle: { color: '#9C27B0' }, markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9C27B0', type: 'dashed' }, data: [{ xAxis: qLlenadoM3h }, { yAxis: perd }] }, z: 3 });
            myChart.current.setOption({
                title: { text: 'Curva de Pérdida de Presión', left: 'center' },
                grid: { left: '15%', right: '5%', bottom: '15%', top: '15%', containLabel: true, backgroundColor: '#fff', show: true, borderColor: '#000', borderWidth: 2 },
                xAxis: { type: 'log', name: 'Caudal - m³/h', nameLocation: 'middle', nameGap: 35, min: 0.4, max: 50 },
                yAxis: { type: 'log', name: 'Pérdida de Presión (m.c.a.)', nameLocation: 'middle', nameGap: 60, min: 0.05, max: 12 },
                series, animation: false, legend: { show: true, bottom: 10 }
            }, true);
        }
    }, [diamConn, qLlenadoM3h]);

    const RTr = ({ acc, idx, arr, setArr, dmt, vVal, lPipe, lTotal, sVal, hfVal }) => (
        <tr className="hover:bg-gray-50 transition-all duration-200">
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-semibold text-blue-600 text-center">{qLlenado} L/s</td>}
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-semibold text-center">{dmt}</td>}
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-semibold text-green-600 text-center">{vVal} m/s</td>}
            <td className="px-6 py-3">
                <select disabled={!isEdit} value={acc.tipo} onChange={e => { const n = [...arr]; n[idx].tipo = e.target.value; n[idx].leq = getLeq(e.target.value, dmt); setArr(n); }} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccione</option>
                    {config.accesoriosDisponibles.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
            </td>
            <td className="px-6 py-3">
                <input disabled={!isEdit} type="number" min="0" value={acc.cantidad} onChange={e => { const n = [...arr]; n[idx].cantidad = +e.target.value; setArr(n); }} className="w-20 px-3 py-2 border rounded-lg text-center" />
            </td>
            <td className="px-6 py-3 text-center">{acc.leq.toFixed(3)}</td>
            <td className="px-6 py-3 text-center font-semibold">{(acc.cantidad * acc.leq).toFixed(3)}</td>
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-semibold text-center">{lPipe} m</td>}
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-semibold text-purple-600 text-center">{lTotal} m</td>}
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-mono text-xs text-center">{sVal}</td>}
            {idx === 0 && <td rowSpan={6} className="px-6 py-3 font-bold text-red-600 text-center">{hfVal} m</td>}
        </tr>
    );

    return (
        <div className="max-w-full mx-auto p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 rounded-2xl shadow-lg sticky top-1 z-50">
                <div className="max-w-full mx-auto px-2 py-2 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg"><i className="fas fa-water text-white text-lg"></i></div>
                        <div><h1 className="text-2xl font-bold text-slate-800">3. CALCULO DE LA RED DE ALIMENTACION</h1><p className="text-sm text-slate-600">Cálculo de consumo de agua</p></div>
                    </div>
                </div>
            </header>

            <main className="max-w-full mx-auto px-2 py-4 space-y-6">
                <div className="bg-white rounded-lg shadow border">
                    <div className="bg-gray-100 px-4 py-3 border-b">
                        <h2 className="font-semibold text-gray-800">3.1. CAUDAL DE ENTRADA</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div><label className="text-sm font-medium text-gray-950">Consumo Diario</label><div className="flex"><input disabled value={consumoDiario.toFixed(2)} className="flex-1 px-3 py-2 text-gray-950 bg-gray-50 border rounded-md font-medium" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">L</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Vol. Cisterna (Real)</label><div className="flex"><input disabled value={volCisterna.toFixed(2)} className="flex-1 px-3 py-2 text-gray-950 bg-yellow-100 border-2 border-yellow-300 rounded-md font-medium" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">L</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Tiempo de Llenado</label><div className="flex"><input disabled={!isEdit} type="number" step="0.1" value={tiempoLlenado} onChange={e => setTiempoLlenado(+e.target.value)} className="text-gray-950 flex-1 px-3 py-2 bg-yellow-100 border-2 border-yellow-300 rounded-md font-medium " /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">hrs</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Q llenado</label><div className="flex"><input disabled value={qLlenado.toFixed(3)} className="text-gray-950 flex-1 bg-gray-50 border px-3 py-2 rounded-md font-bold" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">L/s</span></div></div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow border"><div className="bg-gray-100 px-4 py-3 border-b"><h2 className="font-semibold text-gray-800">3.2. CARGA DISPONIBLE</h2></div><div className="p-6 space-y-6">
                    <h3 className="text-center bg-blue-50 py-2 rounded text-gray-950">Datos de la FACTIBILIDAD DE SERVICIO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div><label className="text-sm font-medium text-gray-950">Nivel del terreno cnx.</label><div className="flex"><input disabled={!isEdit} type="number" value={nivelTerreno} onChange={e => setNivelTerreno(+e.target.value)} className="w-full border px-3 py-2 rounded-md text-gray-950" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">m</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Nivel de la tubería de cnx.</label><div className="flex"><input disabled value={nivTubConn} className="w-full bg-gray-50 border px-3 py-2 rounded-md font-bold text-gray-950" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">m</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Nivel de tubería ingreso a cist.</label><div className="flex"><input disabled value={nivIngCist} className="w-full bg-gray-50 border px-3 py-2 rounded-md font-bold text-gray-950" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">m</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Presión en CONEXIÓN PÚBLICA</label><div className="flex"><input disabled={!isEdit} type="number" value={presionConn} onChange={e => setPresionConn(+e.target.value)} className="w-full border px-3 py-2 rounded-md text-gray-950" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">m</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Presión de salida en tub.</label><div className="flex"><input disabled={!isEdit} type="number" value={presionSalida} onChange={e => setPresionSalida(+e.target.value)} className="w-full border px-3 py-2 rounded-md text-gray-950" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">m</span></div></div>
                        <div><label className="text-sm font-medium text-gray-950">Altura estática est.</label><div className="flex"><input disabled value={altEstatica} className="w-full bg-gray-50 border px-3 py-2 rounded-md font-bold text-gray-950" /><span className="bg-gray-100 px-2 py-2 rounded text-gray-950">m</span></div></div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 flex justify-between text-gray-950"><span className="font-semibold">Carga Disponible (Hd 1)</span><span className="text-xl font-bold text-blue-600">{cargaDispTot} m</span></div>
                </div></div>

                <div className="bg-white rounded-lg shadow border hover:shadow-lg"><div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-4 border-b font-bold text-xl text-gray-950">3.3. PÉRDIDA DE CARGA: TRAMO RED PÚBLICA - MEDIDOR</div><div className="p-8 space-y-8">
                    <div className="bg-white p-6 rounded-xl shadow-md border grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="font-semibold text-gray-950">Diámetro Conexión</label><select disabled={!isEdit} value={diamConn} onChange={e => setDiamConn(e.target.value)} className="w-full px-4 py-2 bg-blue-50 border rounded-lg text-gray-950">{Object.keys(config.diametros).map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                        <div><label className="font-semibold text-gray-950">Micromedidor</label><select disabled={!isEdit} value={micro} onChange={e => setMicro(e.target.value)} className="w-full px-4 py-2 bg-yellow-50 border rounded-lg text-gray-950"><option>SI</option><option>NO</option></select></div>
                        <div><label className="font-semibold text-gray-950">Longitud Tubería (m)</label><div className="flex gap-2"><input disabled={!isEdit} type="number" value={lTuberia} onChange={e => setLTuberia(+e.target.value)} className="flex-1 px-4 py-2 border rounded-lg text-gray-950" /><span className="bg-gray-100 px-3 py-2 rounded-lg text-gray-950">m</span></div></div>
                        <div><label className="font-semibold text-gray-950">Hf medidor (m)</label><div className="flex gap-2"><input disabled={!isEdit} type="number" value={hfMed} onChange={e => setHfMed(+e.target.value)} className="flex-1 px-4 py-2 border rounded-lg text-gray-950" /><span className="bg-gray-100 px-3 py-2 rounded-lg text-gray-950">m</span></div></div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border shadow-sm">
                        <table className="min-w-full divide-y bg-white"><thead className="bg-blue-600 text-white text-sm"><tr><th rowSpan={2} className="px-6 py-3 ">q (L/s)</th><th rowSpan={2} className="px-6 py-3">Diámetro</th><th rowSpan={2} className="px-6 py-3">V (m/s)</th><th colSpan={4} className="px-6 py-3">L accesorios</th><th rowSpan={2} className="px-6 py-3">L tubería</th><th rowSpan={2} className="px-6 py-3">L total</th><th rowSpan={2} className="px-6 py-3">S (m/m)</th><th rowSpan={2} className="px-6 py-3">hf (m)</th></tr><tr className="bg-blue-700"><th className="px-6 py-3">Accesorio</th><th className="px-6 py-3">#</th><th className="px-6 py-3">Leq</th><th className="px-6 py-3">Leq.T</th></tr></thead>
                            <tbody className="text-sm text-gray-950">{accs.map((a, i) => <RTr key={i} acc={a} idx={i} arr={accs} setArr={setAccs} dmt={diamConn} vVal={vel} lPipe={lTuberia} lTotal={lTot} sVal={sH} hfVal={hf} />)}</tbody>
                            <tfoot><tr className="bg-gray-50 font-semibold text-gray-950"><td colSpan={6} className="text-right px-6 py-3 text-gray-950">L. EQ TOTAL:</td><td className="px-6 py-3 text-blue-600">{leqT.toFixed(3)}</td><td colSpan={4}></td></tr></tfoot></table>
                    </div>

                    <div className="bg-gray-50 border-2 rounded-lg p-6 shadow-sm"><div ref={chartRef} style={{ width: '100%', height: '500px' }}></div></div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm"><div className="text-sm text-gray-950">Carga Disponible</div><div className="text-xl font-bold text-blue-600">{cargaDispTot} m</div></div>
                        <div className="bg-red-50 p-5 rounded-lg border-l-4 border-red-500 shadow-sm"><div className="text-sm text-gray-950">Pérdida Medidor</div><div className="text-xl font-bold text-red-600">{hfMedV} m</div></div>
                        <div className="bg-green-50 p-5 rounded-lg border-l-4 border-green-500 shadow-sm"><div className="text-sm text-gray-950">Pérdida Red - Medidor</div><div className="text-xl font-bold text-green-600">{hf} m</div></div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md border grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm"><div className="text-sm text-gray-950">Diámetro de Alimentación</div><div className="text-xl font-bold text-blue-600">{diamConn}</div></div>
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm"><div className="text-sm text-gray-950">Carga Disponible (Hd 2)</div><div className="text-xl font-bold text-blue-600">{cDisp} m</div></div>
                    </div>
                </div></div>

                <div className="bg-white rounded-lg shadow border hover:shadow-lg"><div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-4 border-b font-bold text-xl text-gray-950">3.4. PERDIDA DE CARGA: MEDIDOR - CISTERNA</div><div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-950"><div><label className="font-semibold text-gray-950">Longitud (m)</label><input disabled={!isEdit} type="number" value={diaLTub} onChange={e => setDiaLTub(+e.target.value)} className="w-full px-4 py-2 border rounded-lg" /></div><div><label className="font-semibold">Tuberías</label><select disabled={!isEdit} value={diaSel} onChange={e => setDiaSel(e.target.value)} className="w-full px-4 py-2 bg-blue-50 border rounded-lg">{Object.keys(config.diametros).map(k => <option key={k} value={k}>{k}</option>)}</select></div></div>
                    <div className="overflow-x-auto rounded-lg border shadow-sm">
                        <table className="min-w-full divide-y bg-white"><thead className="bg-blue-600 text-white text-sm"><tr><th rowSpan={2} className="px-6 py-3">q (L/s)</th><th rowSpan={2} className="px-6 py-3">Diámetro</th><th rowSpan={2} className="px-6 py-3">V (m/s)</th><th colSpan={4} className="px-6 py-3">L accesorios</th><th rowSpan={2} className="px-6 py-3">L tubería</th><th rowSpan={2} className="px-6 py-3">L total</th><th rowSpan={2} className="px-6 py-3">S (m/m)</th><th rowSpan={2} className="px-6 py-3">hf (m)</th></tr><tr className="bg-blue-700"><th className="px-6 py-3">Accesorio</th><th className="px-6 py-3">#</th><th className="px-6 py-3">Leq</th><th className="px-6 py-3">Leq.T</th></tr></thead>
                            <tbody className="text-sm text-gray-950">{diaAccs.map((a, i) => <RTr key={i} acc={a} idx={i} arr={diaAccs} setArr={setDiaAccs} dmt={diaSel} vVal={dVel} lPipe={diaLTub} lTotal={dLTot} sVal={dS} hfVal={dHf} />)}</tbody>
                            <tfoot><tr className="bg-gray-50 font-semibold"><td colSpan={6} className="text-right px-6 py-3 text-gray-950">L. EQ TOTAL:</td><td className="px-6 py-3 text-blue-600">{dLeqT.toFixed(3)}</td><td colSpan={4}></td></tr></tfoot></table>
                    </div>
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 shadow-sm text-gray-950"><div className="text-sm text-gray-950">Carga Disponible (Hd 2)</div><div className="text-xl font-bold text-blue-600">{cDisp} m</div></div>
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 shadow-sm text-gray-950"><div className="text-sm text-gray-950">Pérdida Medidor - Cisterna</div><div className="text-xl font-bold text-blue-600">{dHf} m</div></div>
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 shadow-sm text-gray-950"><div className="text-sm text-gray-950">Carga Disponible (Hd 3)</div><div className="text-xl font-bold text-blue-600">{dCDisp} m</div></div>
                    </div>
                </div></div>

                <div className="bg-white rounded-lg shadow border hover:shadow-lg"><div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-4 border-b font-bold text-xl text-gray-950">3.5. RESULTADOS</div><div className="p-8">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm text-gray-950"><div className="text-sm">Q llenado</div><div className="text-xl font-bold text-blue-600">{qLlenado} L/s</div></div>
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm text-gray-950"><div className="text-sm">Diametro (Red P - Medidor)</div><div className="text-xl font-bold text-blue-600">{diamConn}</div></div>
                        <div className="flex-1 bg-blue-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm text-gray-950"><div className="text-sm">Diametro (Medidor - Cist)</div><div className="text-xl font-bold text-blue-600">{diaSel}</div></div>
                    </div>
                </div></div>
            </main>
        </div>
    );
}
