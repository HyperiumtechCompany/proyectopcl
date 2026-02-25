import React, { useState, useEffect, useMemo, useCallback } from 'react';
import longEquival from "../lib/longitud-components.js";

const asNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
    diametros: {
        '1/2 pulg': { mm: 0.5, area: 0.000177, pulg: '1/2' },
        '3/4 pulg': { mm: 0.75, area: 0.000314, pulg: '3/4' },
        '1 pulg': { mm: 1, area: 0.000491, pulg: '1' },
        '1 1/4 pulg': { mm: 1.25, area: 0.000804, pulg: '1 1/4' },
        '1 1/2 pulg': { mm: 1.5, area: 0.001257, pulg: '1 1/2' },
        '2 pulg': { mm: 2, area: 0.001963, pulg: '2' },
        '2 1/2 pulg': { mm: 2.5, area: 0.001963, pulg: '2 1/2' },
        '3 pulg': { mm: 3, area: 0.001963, pulg: '3' },
        '4 pulg': { mm: 4, area: 0.001963, pulg: '4' },
        '6 pulg': { mm: 6, area: 0.001963, pulg: '6' },
        '8 pulg': { mm: 8, area: 0.001963, pulg: '8' },
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
    ],
    diametrotubsuccion: {
        '0.00': '1 pulg',
        '0.50': '1 1/4 pulg',
        '1.00': '1 1/2 pulg',
        '1.60': '2 pulg',
        '3.00': '2 1/2 pulg',
        '5.00': '3 pulg',
        '8.00': '4 pulg',
        '15.0': '6 pulg',
        '25.0': '8 pulg',
    },
    diametrotubimpulsion: {
        '0.00': '3/4 pulg',
        '0.50': '1 pulg',
        '1.00': '1 1/4 pulg',
        '1.60': '1 1/2 pulg',
        '3.00': '2 pulg',
        '5.00': '2 1/2 pulg',
        '8.00': '3 pulg',
        '15.0': '4 pulg',
        '25.0': '6 pulg',
    },
    leqTabla: longEquival,
};

const BombeoTanqueElevado = ({ initialData, canEdit, editMode, onChange, tanqueData, cisternaData, redAlimentacionData, maximaDemandaData }) => {
    const volumenTanqueCalculadoInicial = Number(tanqueData?.volumenCalculado);
    const volumenTanqueInicialLitros = Number.isFinite(volumenTanqueCalculadoInicial)
        ? volumenTanqueCalculadoInicial * 1000
        : null;
    const qmdsInicial = Number(maximaDemandaData?.totals?.qmdsTotal);
    const nivelFondoTanquePersistido = asNumber(
        redAlimentacionData?.config?.altasumfondotanqueelevado ?? tanqueData?.nivelFondoTanque,
        NaN
    );
    const nivelRebosePersistido = Array.isArray(tanqueData?.niveles)
        ? tanqueData.niveles.find(n => n.numero === 4)
        : null;
    const nivelAguaTanquePersistido = asNumber(nivelRebosePersistido?.valor, NaN);
    const nivelFondoCisternaPersistido = asNumber(cisternaData?.nivel5, NaN);

    // States from initialData or default values
    const [volumenTE, setVolumenTE] = useState(initialData?.volumenTE ?? volumenTanqueInicialLitros ?? 2268);
    const [tiempoLlenadobomb, setTiempoLlenadobomb] = useState(initialData?.tiempoLlenadobomb ?? 2);
    const [QMDS, setQMDS] = useState(initialData?.QMDS ?? (Number.isFinite(qmdsInicial) ? qmdsInicial : 0));
    const [longitudTuberiaSuccion, setLongitudTuberiaSuccion] = useState(initialData?.longitudTuberiaSuccion ?? 4.25);
    const [micromedidorSuccion, setMicromedidorSuccion] = useState(initialData?.micromedidorSuccion ?? 'SI');
    const [hfMedidorSuccion, setHfMedidorSuccion] = useState(initialData?.hfMedidorSuccion ?? 1.10);
    const [cargaDisponibleSuccion, setCargaDisponibleSuccion] = useState(initialData?.cargaDisponibleSuccion ?? 0);
    const [accesoriosSuccion, setAccesoriosSuccion] = useState(initialData?.accesoriosSuccion ?? [
        { tipo: 'codo45', cantidad: 0, leq: 0.477 },
        { tipo: 'codo90', cantidad: 1, leq: 1.023 },
        { tipo: 'codo90', cantidad: 0, leq: 2.045 }, // It seems the original had two 'codo90', perhaps one was meant to be another type
        { tipo: 'valCompuerta', cantidad: 1, leq: 0.216 },
        { tipo: 'canastilla', cantidad: 1, leq: 2.114 },
        { tipo: 'reduc2', cantidad: 0, leq: 1.045 }
    ]);
    const [longitudTuberiaImpulsion, setLongitudTuberiaImpulsion] = useState(initialData?.longitudTuberiaImpulsion ?? 16.95);
    const [micromedidorImpulsion, setMicromedidorImpulsion] = useState(initialData?.micromedidorImpulsion ?? 'SI');
    const [hfMedidorImpulsion, setHfMedidorImpulsion] = useState(initialData?.hfMedidorImpulsion ?? 1.10);
    const [cargaDisponibleImpulsion, setCargaDisponibleImpulsion] = useState(initialData?.cargaDisponibleImpulsion ?? 0);
    const [accesoriosImpulsion, setAccesoriosImpulsion] = useState(initialData?.accesoriosImpulsion ?? [
        { tipo: 'codo45', cantidad: 0, leq: 0.477 },
        { tipo: 'codo90', cantidad: 2, leq: 1.023 },
        { tipo: 'tee', cantidad: 2, leq: 2.045 },
        { tipo: 'valCompuerta', cantidad: 0, leq: 0.216 },
        { tipo: 'valCheck', cantidad: 0, leq: 2.114 },
        { tipo: 'reduc2', cantidad: 0, leq: 1.045 }
    ]);
    const [nivelFondoTanque, setNivelFondoTanque] = useState(initialData?.nivelFondoTanque ?? (Number.isFinite(nivelFondoTanquePersistido) ? nivelFondoTanquePersistido : 13.85));
    const [nivelAguaTanque, setNivelAguaTanque] = useState(initialData?.nivelAguaTanque ?? (Number.isFinite(nivelAguaTanquePersistido) ? nivelAguaTanquePersistido : 0));
    const [nivelFondoCisterna, setNivelFondoCisterna] = useState(initialData?.nivelFondoCisterna ?? (Number.isFinite(nivelFondoCisternaPersistido) ? nivelFondoCisternaPersistido : 0));
    const [presionSalida, setPresionSalida] = useState(initialData?.presionSalida ?? 2.00);
    const [eficiencia, setEficiencia] = useState(initialData?.eficiencia ?? 0.6);
    const [potenciaManual, setPotenciaManual] = useState(initialData?.potenciaManual ?? null);

    // Global Events Listeners
    useEffect(() => {
        const handleRedAlimentacion = (event) => {
            if (event.detail && event.detail.config) {
                setNivelFondoTanque(parseFloat(event.detail.config.altasumfondotanqueelevado || 0));
            }
        };
        const handleCisterna = (event) => {
            if (event.detail && Object.prototype.hasOwnProperty.call(event.detail, 'nivel5')) {
                const nivel5 = Number(event.detail.nivel5);
                if (Number.isFinite(nivel5)) {
                    setNivelFondoCisterna(nivel5);
                }
            }
        };
        const handleTanque = (event) => {
            if (event.detail) {
                const niveles = event.detail.niveles;
                if (Array.isArray(niveles)) {
                    const nivelRebose = niveles.find(n => n.numero === 4);
                    if (nivelRebose) setNivelAguaTanque(parseFloat(nivelRebose.valor || 0));
                }
                if (event.detail && Object.prototype.hasOwnProperty.call(event.detail, 'volumenCalculado')) {
                    const volumen = Number(event.detail.volumenCalculado);
                    if (Number.isFinite(volumen)) {
                        setVolumenTE(volumen * 1000);
                    }
                }
            }
        };
        const handleQMDS = (event) => {
            if (event.detail && event.detail.totals) {
                setQMDS(parseFloat(event.detail.totals.qmdsTotal || 0));
            }
        };

        document.addEventListener('red-alimentacion-updated', handleRedAlimentacion);
        document.addEventListener('cisterna-updated', handleCisterna);
        document.addEventListener('tanque-updated', handleTanque);
        document.addEventListener('maxima-demanda-simultanea-updated', handleQMDS);

        return () => {
            document.removeEventListener('red-alimentacion-updated', handleRedAlimentacion);
            document.removeEventListener('cisterna-updated', handleCisterna);
            document.removeEventListener('tanque-updated', handleTanque);
            document.removeEventListener('maxima-demanda-simultanea-updated', handleQMDS);
        };
    }, []);

    useEffect(() => {
        const volumen = Number(tanqueData?.volumenCalculado);
        if (Number.isFinite(volumen)) {
            setVolumenTE(volumen * 1000);
        }
    }, [tanqueData?.volumenCalculado]);

    useEffect(() => {
        const nivel = asNumber(redAlimentacionData?.config?.altasumfondotanqueelevado ?? tanqueData?.nivelFondoTanque, NaN);
        if (Number.isFinite(nivel)) {
            setNivelFondoTanque(nivel);
        }
    }, [redAlimentacionData?.config?.altasumfondotanqueelevado, tanqueData?.nivelFondoTanque]);

    useEffect(() => {
        const nivelRebose = Array.isArray(tanqueData?.niveles)
            ? tanqueData.niveles.find(n => n.numero === 4)
            : null;
        const nivel = asNumber(nivelRebose?.valor, NaN);
        if (Number.isFinite(nivel)) {
            setNivelAguaTanque(nivel);
        }
    }, [tanqueData?.niveles]);

    useEffect(() => {
        const nivel = asNumber(cisternaData?.nivel5, NaN);
        if (Number.isFinite(nivel)) {
            setNivelFondoCisterna(nivel);
        }
    }, [cisternaData?.nivel5]);

    useEffect(() => {
        const qmds = Number(maximaDemandaData?.totals?.qmdsTotal);
        if (Number.isFinite(qmds)) {
            setQMDS(qmds);
        }
    }, [maximaDemandaData?.totals?.qmdsTotal]);

    // Computed Properties
    const qLlenado = useMemo(() => {
        if (tiempoLlenadobomb <= 0 || volumenTE <= 0) return 0;
        return parseFloat((volumenTE / (tiempoLlenadobomb * 3600)).toFixed(3));
    }, [tiempoLlenadobomb, volumenTE]);

    const Qimpul = useMemo(() => {
        return Math.max(qLlenado, QMDS);
    }, [qLlenado, QMDS]);

    const diametroSuccion = useMemo(() => {
        const q = Qimpul || 0;
        const tabla = config.diametrotubsuccion;
        let valorMasCercano = null;
        let diferenciaMinima = Infinity;

        for (const clave in tabla) {
            const valorNumerico = parseFloat(clave);
            const diferencia = Math.abs(valorNumerico - q);
            if (diferencia < diferenciaMinima) {
                diferenciaMinima = diferencia;
                valorMasCercano = clave;
            }
        }
        return valorMasCercano !== null ? tabla[valorMasCercano] : '1 pulg';
    }, [Qimpul]);

    const velocidadSuccion = useMemo(() => {
        const diametroInfo = config.diametros[diametroSuccion];
        if (!diametroInfo) return 0;
        const q_m3s = Qimpul / 1000;
        const d_m = diametroInfo.mm * 2.54 / 100;
        const area_m2 = Math.PI * Math.pow(d_m, 2) / 4;
        return parseFloat((q_m3s / area_m2).toFixed(2));
    }, [Qimpul, diametroSuccion]);

    const leqTotalSuccion = useMemo(() => {
        return accesoriosSuccion.reduce((sum, acc) => sum + (acc.cantidad * acc.leq), 0);
    }, [accesoriosSuccion]);

    const longitudTotalSuccion = useMemo(() => {
        return parseFloat((leqTotalSuccion + (parseFloat(longitudTuberiaSuccion) || 0)).toFixed(2));
    }, [leqTotalSuccion, longitudTuberiaSuccion]);

    const pendienteHidraulicaSuccion = useMemo(() => {
        const diametroInfo = config.diametros[diametroSuccion];
        if (!diametroInfo) return 0;
        const q_m3s = Qimpul / 1000;
        const d_m = diametroInfo.mm * 2.54 / 100;
        const denominador = 0.2785 * 140 * Math.pow(d_m, 2.63);
        if (denominador === 0) return 0;
        return parseFloat(Math.pow(q_m3s / denominador, 1.85).toFixed(6));
    }, [Qimpul, diametroSuccion]);

    const perdidaPorFriccionSuccion = useMemo(() => {
        return parseFloat((longitudTotalSuccion * pendienteHidraulicaSuccion).toFixed(2));
    }, [longitudTotalSuccion, pendienteHidraulicaSuccion]);

    const diametroImpulsion = useMemo(() => {
        const q = Qimpul || 0;
        const tabla = config.diametrotubimpulsion;
        let valorMasCercano = null;
        let diferenciaMinima = Infinity;
        for (const clave in tabla) {
            const valorNumerico = parseFloat(clave);
            const diferencia = Math.abs(valorNumerico - q);
            if (diferencia < diferenciaMinima) {
                diferenciaMinima = diferencia;
                valorMasCercano = clave;
            }
        }
        return valorMasCercano !== null ? tabla[valorMasCercano] : '3/4 pulg';
    }, [Qimpul]);

    const velocidadImpulsion = useMemo(() => {
        const diametroInfo = config.diametros[diametroImpulsion];
        if (!diametroInfo) return 0;
        const q_m3s = Qimpul / 1000;
        const d_m = diametroInfo.mm * 2.54 / 100;
        const area_m2 = Math.PI * Math.pow(d_m, 2) / 4;
        return parseFloat((q_m3s / area_m2).toFixed(2));
    }, [Qimpul, diametroImpulsion]);

    const leqTotalImpulsion = useMemo(() => {
        return accesoriosImpulsion.reduce((sum, acc) => sum + (acc.cantidad * acc.leq), 0);
    }, [accesoriosImpulsion]);

    const longitudTotalImpulsion = useMemo(() => {
        return parseFloat((leqTotalImpulsion + (parseFloat(longitudTuberiaImpulsion) || 0)).toFixed(2));
    }, [leqTotalImpulsion, longitudTuberiaImpulsion]);

    const pendienteHidraulicaImpulsion = useMemo(() => {
        const diametroInfo = config.diametros[diametroImpulsion];
        if (!diametroInfo) return 0;
        const q_m3s = Qimpul / 1000;
        const d_m = diametroInfo.mm * 2.54 / 100;
        const denominador = 0.2785 * 140 * Math.pow(d_m, 2.63);
        if (denominador === 0) return 0;
        return parseFloat(Math.pow(q_m3s / denominador, 1.85).toFixed(6));
    }, [Qimpul, diametroImpulsion]);

    const perdidaPorFriccionImpulsion = useMemo(() => {
        return parseFloat((longitudTotalImpulsion * pendienteHidraulicaImpulsion).toFixed(2));
    }, [longitudTotalImpulsion, pendienteHidraulicaImpulsion]);

    const hdt = useMemo(() => {
        const presion = asNumber(presionSalida, 0);
        const desnivel = asNumber(nivelAguaTanque, 0) - asNumber(nivelFondoCisterna, 0);
        const total = perdidaPorFriccionImpulsion + perdidaPorFriccionSuccion + presion + desnivel;
        return parseFloat(Math.max(total, 0).toFixed(2));
    }, [perdidaPorFriccionImpulsion, perdidaPorFriccionSuccion, presionSalida, nivelAguaTanque, nivelFondoCisterna]);

    const hdtRoundedInt = useMemo(() => {
        return Math.ceil(hdt);
    }, [hdt]);

    const potencia = useMemo(() => {
        if (eficiencia === 0) return 0;
        return (Qimpul * hdt) / (75 * eficiencia);
    }, [Qimpul, hdt, eficiencia]);

    const ceilToHalf = (v) => {
        return Math.ceil(v * 2) / 2;
    };

    const potenciaRedondeada = useMemo(() => ceilToHalf(potencia), [potencia]);

    const potenciaEstimada = useMemo(() => {
        if (potenciaManual !== null && potenciaManual !== '') return parseFloat(potenciaManual);
        return potenciaRedondeada;
    }, [potenciaManual, potenciaRedondeada]);

    const potenciaDisplayStr = useMemo(() => {
        if (Number.isFinite(potenciaEstimada)) {
            return Number.isInteger(potenciaEstimada) ? potenciaEstimada.toFixed(0) : potenciaEstimada.toFixed(1);
        }
        return '';
    }, [potenciaEstimada]);

    // Send updates upwards
    const sendDataUpdate = useCallback(() => {
        if (onChange) {
            onChange({
                volumenTE,
                tiempoLlenadobomb,
                QMDS,
                longitudTuberiaSuccion,
                micromedidorSuccion,
                hfMedidorSuccion,
                cargaDisponibleSuccion,
                accesoriosSuccion,
                longitudTuberiaImpulsion,
                micromedidorImpulsion,
                hfMedidorImpulsion,
                cargaDisponibleImpulsion,
                accesoriosImpulsion,
                nivelFondoTanque,
                nivelAguaTanque,
                nivelFondoCisterna,
                presionSalida,
                eficiencia,
                potenciaManual
            });
        }
    }, [onChange, volumenTE, tiempoLlenadobomb, QMDS, longitudTuberiaSuccion, micromedidorSuccion, hfMedidorSuccion, cargaDisponibleSuccion, accesoriosSuccion, longitudTuberiaImpulsion, micromedidorImpulsion, hfMedidorImpulsion, cargaDisponibleImpulsion, accesoriosImpulsion, nivelFondoTanque, nivelAguaTanque, nivelFondoCisterna, presionSalida, eficiencia, potenciaManual]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            sendDataUpdate();
        }, 150);
        return () => clearTimeout(timeout);
    }, [sendDataUpdate]);

    // Handlers
    const actualizarLeqAccesorioSuccion = (idx, newTipo) => {
        const newAccesorios = [...accesoriosSuccion];
        newAccesorios[idx].tipo = newTipo;
        newAccesorios[idx].leq = (config.leqTabla && config.leqTabla[newTipo] && config.leqTabla[newTipo][diametroSuccion]) || 0;
        setAccesoriosSuccion(newAccesorios);
    };

    const actualizarCantAccesorioSuccion = (idx, newCant) => {
        const newAccesorios = [...accesoriosSuccion];
        newAccesorios[idx].cantidad = parseInt(newCant) || 0;
        setAccesoriosSuccion(newAccesorios);
    };

    const actualizarLeqAccesorioImpulsion = (idx, newTipo) => {
        const newAccesorios = [...accesoriosImpulsion];
        newAccesorios[idx].tipo = newTipo;
        newAccesorios[idx].leq = (config.leqTabla && config.leqTabla[newTipo] && config.leqTabla[newTipo][diametroImpulsion]) || 0;
        setAccesoriosImpulsion(newAccesorios);
    };

    const actualizarCantAccesorioImpulsion = (idx, newCant) => {
        const newAccesorios = [...accesoriosImpulsion];
        newAccesorios[idx].cantidad = parseInt(newCant) || 0;
        setAccesoriosImpulsion(newAccesorios);
    };

    return (
        <div className="max-w-full mx-auto p-4">
            {/* Header Principal */}
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 rounded-2xl shadow-lg sticky top-12 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
                                <i className="fas fa-water text-white text-lg"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">5. CALCULO DEL SISTEMA DE BOMBEO AL TANQUE ELEVADO</h1>
                                <p className="text-sm text-slate-600">Cálculo de consumo de agua</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-full mx-auto px-2 py-4 space-y-6">
                {/* 5.1. CAUDAL DE IMPULSION */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                    <div className="bg-gray-100 px-4 py-3 border-b">
                        <h2 className="text-lg font-semibold text-gray-800">5.1. CAUDAL DE IMPULSION</h2>
                        <p className="text-sm text-slate-600">En el inciso d) del ITEM 2.5. ELEVACION, el caudal de bombeo debe ser equivalente a la máxima demanda simultánea y en ningún caso inferior a la necesaria para llenar el tanque.</p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 p-4 bg-white rounded-xl shadow">
                            {/* Volumen Cisterna / TE */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 tracking-wide">VOL. TANQUE ELEVADO</label>
                                <div className="flex items-center">
                                    <input type="number" value={volumenTE.toFixed(2)} step="0.001" disabled
                                        className="w-full px-3 py-2 bg-yellow-100 border-2 border-yellow-300 text-gray-700 font-semibold rounded-l-md focus:outline-none" />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border-t border-b border-r border-gray-300">L</span>
                                </div>
                            </div>

                            {/* Tiempo Llenado */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 tracking-wide">TIEMPO DE LLENADO</label>
                                <div className="flex items-center">
                                    <input type="number" step="0.1"
                                        value={tiempoLlenadobomb}
                                        onChange={(e) => setTiempoLlenadobomb(e.target.value)}
                                        disabled={!editMode}
                                        className="w-full px-3 py-2 bg-yellow-100 border-2 border-yellow-300 text-gray-700 font-semibold rounded-l-md focus:outline-none disabled:opacity-75" />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border-t border-b border-r border-gray-300">hrs</span>
                                </div>
                            </div>

                            {/* Q Llenado */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 tracking-wide">CAUDAL DE LLENADO</label>
                                <div className="flex items-center">
                                    <input type="text" value={qLlenado} readOnly
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 text-gray-900 font-bold rounded-l-md" />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border-t border-b border-r border-gray-300">L/s</span>
                                </div>
                            </div>

                            {/* Q MDS */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 tracking-wide">Q MDS</label>
                                <div className="flex items-center">
                                    <input type="text" value={QMDS.toFixed(3)} readOnly
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 text-gray-900 font-bold rounded-l-md" />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border-t border-b border-r border-gray-300">L/s</span>
                                </div>
                            </div>

                            {/* Q Impulsión */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 tracking-wide">Q IMPULSIÓN</label>
                                <div className="flex items-center">
                                    <input type="text" value={Qimpul.toFixed(3)} readOnly
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 text-gray-900 font-bold rounded-l-md" />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border-t border-b border-r border-gray-300">L/s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5.2. PERDIDA DE CARGA */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                    <div className="bg-gray-100 px-4 py-3 border-b">
                        <h2 className="text-lg font-semibold text-gray-800">5.2. PERDIDA DE CARGA</h2>
                    </div>
                    <div className="p-6 space-y-8">

                        {/* 5.2.1. PERDIDA DE CARGA SUCCIÓN */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-800">5.2.1. PERDIDA DE CARGA SUCCIÓN</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Diámetro tub. Succión (Ø) - Calculado Automáticamente</label>
                                    <div className="w-full px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-gray-700 font-semibold flex items-center justify-between">
                                        <span>{diametroSuccion}</span>
                                        <span className="text-xs text-blue-600">Auto</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Longitud de la Tubería (m)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" step="0.01" min="0" value={longitudTuberiaSuccion}
                                            onChange={(e) => setLongitudTuberiaSuccion(e.target.value)} disabled={!editMode}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 transition disabled:bg-slate-100" />
                                        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">m</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de Succión */}
                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold">
                                        <tr>
                                            <th rowSpan="2" className="px-6 py-3 text-center">q (L/s)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">Diámetro</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">V (m/s)</th>
                                            <th colSpan="4" className="px-6 py-3 text-center">L accesorios</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">L tubería (m)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">L total (m)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">S (m/m)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">hf (m)</th>
                                        </tr>
                                        <tr className="bg-gradient-to-r from-blue-700 to-indigo-700">
                                            <th className="px-6 py-3 text-center">Accesorio</th>
                                            <th className="px-6 py-3 text-center">#</th>
                                            <th className="px-6 py-3 text-center">Leq</th>
                                            <th className="px-6 py-3 text-center">Leq.T</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100 text-sm text-gray-800">
                                        {accesoriosSuccion.map((accesorio, idx) => (
                                            <tr key={`suc-${idx}`} className="hover:bg-gray-50 transition-all duration-200">
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-semibold text-blue-600 text-center">
                                                        {Qimpul.toFixed(3)} L/s
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-semibold text-center">
                                                        {diametroSuccion}
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-semibold text-green-600 text-center">
                                                        {velocidadSuccion} m/s
                                                    </td>
                                                )}
                                                <td className="px-6 py-3">
                                                    <select value={accesorio.tipo} disabled={!editMode}
                                                        onChange={(e) => actualizarLeqAccesorioSuccion(idx, e.target.value)}
                                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 disabled:bg-slate-100">
                                                        <option value="">Seleccione</option>
                                                        {config.accesoriosDisponibles.map(item => (
                                                            <option key={item.key} value={item.key}>{item.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input type="number" min="0" step="1" value={accesorio.cantidad} disabled={!editMode}
                                                        onChange={(e) => actualizarCantAccesorioSuccion(idx, e.target.value)}
                                                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 disabled:bg-slate-100" />
                                                </td>
                                                <td className="px-6 py-3 text-center">{accesorio.leq.toFixed(3)}</td>
                                                <td className="px-6 py-3 text-center font-semibold">{(accesorio.cantidad * accesorio.leq).toFixed(3)}</td>
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-semibold text-center">
                                                        {longitudTuberiaSuccion} m
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-semibold text-purple-600 text-center">
                                                        {longitudTotalSuccion} m
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-mono text-xs text-center">
                                                        {pendienteHidraulicaSuccion}
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosSuccion.length} className="px-6 py-3 align-top font-bold text-red-600 text-center">
                                                        {perdidaPorFriccionSuccion} m
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 text-sm font-semibold">
                                            <td colSpan="6" className="px-6 py-3 text-right">LONGITUD TOTAL EQUIVALENTE (m):</td>
                                            <td className="px-6 py-3 font-bold text-blue-600 text-center">{leqTotalSuccion.toFixed(3)}</td>
                                            <td colSpan="4"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* 5.2.2. PERDIDA DE CARGA IMPULSIÓN */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-800">5.2.2. PERDIDA DE CARGA IMPULSIÓN</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Diámetro tub. Impulsión (Ø) - Calculado Automáticamente</label>
                                    <div className="w-full px-4 py-2 bg-green-100 border border-green-300 rounded-lg text-gray-700 font-semibold flex items-center justify-between">
                                        <span>{diametroImpulsion}</span>
                                        <span className="text-xs text-green-600">Auto</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Longitud de la Tubería (m)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" step="0.01" min="0" value={longitudTuberiaImpulsion}
                                            onChange={(e) => setLongitudTuberiaImpulsion(e.target.value)} disabled={!editMode}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700 transition disabled:bg-slate-100" />
                                        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">m</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de Impulsión */}
                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold">
                                        <tr>
                                            <th rowSpan="2" className="px-6 py-3 text-center">q (L/s)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">Diámetro</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">V (m/s)</th>
                                            <th colSpan="4" className="px-6 py-3 text-center">L accesorios</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">L tubería (m)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">L total (m)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">S (m/m)</th>
                                            <th rowSpan="2" className="px-6 py-3 text-center">hf (m)</th>
                                        </tr>
                                        <tr className="bg-gradient-to-r from-green-700 to-emerald-700">
                                            <th className="px-6 py-3 text-center">Accesorio</th>
                                            <th className="px-6 py-3 text-center">#</th>
                                            <th className="px-6 py-3 text-center">Leq</th>
                                            <th className="px-6 py-3 text-center">Leq.T</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100 text-sm text-gray-800">
                                        {accesoriosImpulsion.map((accesorio, idx) => (
                                            <tr key={`imp-${idx}`} className="hover:bg-gray-50 transition-all duration-200">
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-semibold text-green-600 text-center">
                                                        {Qimpul.toFixed(3)} L/s
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-semibold text-center">
                                                        {diametroImpulsion}
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-semibold text-green-600 text-center">
                                                        {velocidadImpulsion} m/s
                                                    </td>
                                                )}
                                                <td className="px-6 py-3">
                                                    <select value={accesorio.tipo} disabled={!editMode}
                                                        onChange={(e) => actualizarLeqAccesorioImpulsion(idx, e.target.value)}
                                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 disabled:bg-slate-100">
                                                        <option value="">Seleccione</option>
                                                        {config.accesoriosDisponibles.map(item => (
                                                            <option key={item.key} value={item.key}>{item.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input type="number" min="0" step="1" value={accesorio.cantidad} disabled={!editMode}
                                                        onChange={(e) => actualizarCantAccesorioImpulsion(idx, e.target.value)}
                                                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 disabled:bg-slate-100" />
                                                </td>
                                                <td className="px-6 py-3 text-center">{accesorio.leq.toFixed(3)}</td>
                                                <td className="px-6 py-3 text-center font-semibold">{(accesorio.cantidad * accesorio.leq).toFixed(3)}</td>
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-semibold text-center">
                                                        {longitudTuberiaImpulsion} m
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-semibold text-purple-600 text-center">
                                                        {longitudTotalImpulsion} m
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-mono text-xs text-center">
                                                        {pendienteHidraulicaImpulsion}
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td rowSpan={accesoriosImpulsion.length} className="px-6 py-3 align-top font-bold text-red-600 text-center">
                                                        {perdidaPorFriccionImpulsion} m
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 text-sm font-semibold">
                                            <td colSpan="6" className="px-6 py-3 text-right">LONGITUD TOTAL EQUIVALENTE (m):</td>
                                            <td className="px-6 py-3 font-bold text-green-600 text-center">{leqTotalImpulsion.toFixed(3)}</td>
                                            <td colSpan="4"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5.3. ALTURA DINAMICA TOTAL - HDT */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
                        <h2 className="text-lg font-semibold text-gray-800 tracking-wide">
                            5.3. ALTURA DINÁMICA TOTAL - HDT
                        </h2>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm text-gray-700">

                            {/* Nivel Fondo Tanque */}
                            <span className="font-medium">Nivel de Fondo del Tanque Elevado</span>
                            <span className="text-right font-semibold">
                                {nivelFondoTanque.toFixed(2)} m
                            </span>

                            {/* Nivel Agua Tanque */}
                            <span className="font-medium">Nivel de Agua del Tanque Elevado</span>
                            <span className="text-right font-semibold">
                                {nivelAguaTanque.toFixed(2)} m
                            </span>

                            {/* Nivel Fondo Cisterna */}
                            <span className="font-medium">Nivel de Fondo de Cisterna</span>
                            <span className="text-right font-semibold">
                                {nivelFondoCisterna.toFixed(2)} m
                            </span>

                            {/* Presión de salida */}
                            <span className="font-medium">Presión de Salida</span>
                            <div className="flex justify-end">
                                <div className="flex items-center bg-gray-50 border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={presionSalida}
                                        disabled={!editMode}
                                        onChange={(e) => setPresionSalida(e.target.value)}
                                        className="w-24 px-3 py-2 bg-transparent focus:outline-none focus:ring-0 text-right disabled:bg-gray-100"
                                    />
                                    <span className="px-3 py-2 bg-gray-200 text-gray-600 text-sm font-medium">
                                        m
                                    </span>
                                </div>
                            </div>

                            {/* Perdida Succión */}
                            <span className="font-medium">Pérdida de carga Tub. Succión</span>
                            <span className="text-right font-semibold">
                                {perdidaPorFriccionSuccion.toFixed(2)} m
                            </span>

                            {/* Perdida Impulsión */}
                            <span className="font-medium">Pérdida de carga Tub. Impulsión</span>
                            <span className="text-right font-semibold">
                                {perdidaPorFriccionImpulsion.toFixed(2)} m
                            </span>
                        </div>

                        {/* Resultado HDT */}
                        <div className="mt-8 flex justify-center">
                            <div className="px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-100 to-yellow-200 border border-yellow-300 shadow-md text-center">
                                <p className="text-sm font-medium text-gray-600 tracking-wide">
                                    ALTURA DINÁMICA TOTAL
                                </p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    HDT = {hdtRoundedInt} m
                                </p>
                                <p className="text-sm text-gray-700 mt-1">
                                    (real: {hdt.toFixed(2)} m)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5.4. CALCULO DEL SISTEMA DE BOMBEO */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                    <div className="bg-gray-100 px-4 py-3 border-b">
                        <h2 className="text-lg font-semibold text-gray-800">5.4. CÁLCULO DEL SISTEMA DE BOMBEO</h2>
                    </div>
                    <div className="p-6 space-y-4 text-sm text-gray-800">

                        <div className="flex justify-between items-center">
                            <span>Caudal de Impulsión =</span>
                            <span className="font-semibold">{Qimpul.toFixed(3)} L/s</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span>Altura Dinámica Total =</span>
                            <span className="font-semibold">{hdt.toFixed(2)} m</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span>Eficiencia =</span>
                            <div className="flex items-center gap-2">
                                <input type="number" step="0.01" min="0" max="1" value={eficiencia} disabled={!editMode}
                                    onChange={(e) => setEficiencia(e.target.value)}
                                    className="w-24 px-4 py-2 border border-yellow-400 bg-yellow-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-75 text-right" />
                                <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">%</span>
                            </div>
                        </div>

                        <div className="border-t pt-4 text-center">
                            <p className="text-xs text-gray-500 italic mb-3">
                                POTENCIA = (Caudal L/s × Altura m) / (75 × Eficiencia)
                            </p>
                            <div className="mt-2 font-bold text-lg flex items-center justify-center gap-4">
                                <span>POTENCIA (POT) = {potencia.toFixed(2)} <span className="text-gray-400 mx-2">→</span></span>
                                <div className="inline-flex items-center bg-yellow-100 px-3 py-1 border border-gray-400 rounded shadow-sm">
                                    <input
                                                type="number"
                                                step="0.5"
                                        className="bg-yellow-100 w-20 text-right focus:outline-none placeholder-gray-500 disabled:opacity-75"
                                        value={potenciaManual || ''}
                                        disabled={!editMode}
                                                onChange={(e) => setPotenciaManual(e.target.value)}
                                                placeholder={potenciaRedondeada.toFixed(1)}
                                    />
                                    <span className="ml-2 text-gray-700">HP</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 text-sm text-gray-700 border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg shadow-sm">
                            <p>
                                De acuerdo a la existencia en el mercado con los diámetros más similares a la de succión e impulsión requeridos,
                                se asume la potencia es de {" "}
                                <strong className="text-green-800 text-base">{potenciaDisplayStr} HP</strong>.
                            </p>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default BombeoTanqueElevado;
