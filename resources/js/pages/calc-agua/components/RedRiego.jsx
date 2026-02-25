import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import longEquival from '../lib/longitud-components.js';
import uhData from '../lib/uh-componets.js';
import {
    DIAMETRO_LABELS,
    ACCESORIO_LABEL_MAP,
    ACCESORIO_OPTIONS,
    calcularLongitudTotal,
    calcularHidraulicaCascada,
    verificacionFormatter,
    longitudTotalFormatter,
    TABULATOR_BASE_OPTIONS,
    TABULATOR_COLUMN_DEFAULTS,
} from '../lib/agua-tabulator.ts';

const MODULO_PREFIJO = 'CALCULO DEL MODULO';
const MODULO_SUFIJO = '(RED DE RIEGO)';

const RedRiego = ({ initialData, canEdit, editMode, onChange, maximaDemandaData, tuberiasrdData }) => {
    const mode = canEdit && editMode ? 'edit' : 'view';
    const prevModeRef = useRef(mode);

    const [config, setConfig] = useState({
        npisoterminado: initialData?.config?.npisoterminado ?? 0.65,
        altasumfondotanqueelevado: initialData?.config?.altasumfondotanqueelevado ?? 13.85,
    });
    const [grades, setGrades] = useState({ inicial: true, primaria: false, secundaria: false });
    const [tables, setTables] = useState(() => {
        if (initialData?.tables) return initialData.tables;
        if (initialData?.tablas) return initialData.tablas;
        return {
            inicial: { modules: [], expanded: true },
            primaria: { modules: [], expanded: false },
            secundaria: { modules: [], expanded: false },
        };
    });
    const [accesoriosConfig, setAccesoriosConfig] = useState({
        inicial: { codo90: 'codo90', tee: 'tee', val_compuerta: 'valCompuerta', reduccion2: 'reduccion2' },
        primaria: { codo90: 'codo90', tee: 'tee', val_compuerta: 'valCompuerta', reduccion2: 'reduccion2' },
        secundaria: { codo90: 'codo90', tee: 'tee', val_compuerta: 'valCompuerta', reduccion2: 'reduccion2' },
    });
    const [totals, setTotals] = useState({ totalUDPorGrado: {} });
    const [exterioresData, setExterioresData] = useState({});

    // Refs para evitar stale closures
    const tabulatorsRef = useRef({});
    const tablesRef = useRef(tables);
    const gradesRef = useRef(grades);
    const totalsRef = useRef(totals);
    const exterioresRef = useRef(exterioresData);
    const accesoriosRef = useRef(accesoriosConfig);
    const configRef = useRef(config);
    const onChangeRef = useRef(onChange);
    const notifyTimer = useRef(null);

    useEffect(() => { tablesRef.current = tables; }, [tables]);
    useEffect(() => { gradesRef.current = grades; }, [grades]);
    useEffect(() => { totalsRef.current = totals; }, [totals]);
    useEffect(() => { exterioresRef.current = exterioresData; }, [exterioresData]);
    useEffect(() => { accesoriosRef.current = accesoriosConfig; }, [accesoriosConfig]);
    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const activeTuberiasRdData = useRef({});

    useEffect(() => {
        const sourceTables = tuberiasrdData?.tables || tuberiasrdData?.tablas;
        if (sourceTables) {
            const points = {};
            Object.entries(sourceTables).forEach(([g, tableObj]) => {
                if (!tableObj || !tableObj.modules) return;
                points[g] = [];
                tableObj.modules.forEach(mod => {
                    if (mod.data) {
                        mod.data.forEach(row => {
                            if (!row.isStatic && row.punto) {
                                points[g].push({ label: row.punto, value: row.punto, hpiez: row.hpiez, uh_total: row.uh_total, caudal: row.caudal });
                            }
                        });
                    }
                });
            });
            activeTuberiasRdData.current = points;
        }
    }, [tuberiasrdData]);

    const nivelasumfondotanqueelevado = useMemo(() =>
        Number((config.npisoterminado + config.altasumfondotanqueelevado).toFixed(3)),
        [config]
    );

    const getTankFlow = useCallback((units) => {
        const u = parseFloat(units);
        if (isNaN(u) || u <= 0) return 0;

        const exact = uhData.find(item => Math.abs(item.units - u) < 0.0001);
        if (exact) return exact.tankFlow;

        let lower = null;
        let higher = null;
        for (const item of uhData) {
            if (item.units < u) lower = item;
            else if (item.units > u) { higher = item; break; }
        }

        if (lower && higher) {
            return lower.tankFlow + (u - lower.units) * (higher.tankFlow - lower.tankFlow) / (higher.units - lower.units);
        }
        if (higher) return higher.tankFlow;
        if (lower) return lower.tankFlow;
        return 0;
    }, []);

    const obtenerLongitudEquivalente = useCallback((tipo, diametro) => {
        if (!tipo || !diametro) return 0;
        const d = String(diametro).trim();
        const t = String(tipo).trim();
        return longEquival?.[t]?.[d] ?? 0;
    }, []);

    // notifyChange usa refs — sin stale closure
    const notifyChange = useCallback(() => {
        if (!onChangeRef.current) return;
        const ct = tablesRef.current;
        const tablasActualizadas = {};
        Object.keys(ct).forEach(grado => {
            tablasActualizadas[grado] = {
                ...ct[grado],
                modules: ct[grado].modules.map(modulo => {
                    const key = `${grado}-${modulo.id}`;
                    const tab = tabulatorsRef.current[key];
                    return { ...modulo, data: tab ? tab.getData() : modulo.data || [] };
                }),
            };
        });
        onChangeRef.current({
            config: configRef.current,
            grades: gradesRef.current,
            tables: tablasActualizadas,
            totals: totalsRef.current,
            exterioresData: exterioresRef.current,
        });
    }, []);

    const scheduleNotify = useCallback(() => {
        if (notifyTimer.current) clearTimeout(notifyTimer.current);
        notifyTimer.current = setTimeout(notifyChange, 400);
    }, [notifyChange]);

    // actualizarResultados acepta overrides directos para evitar state stale
    const actualizarResultados = useCallback((overrides = {}) => {
        const cg = overrides.grades ?? gradesRef.current;
        const ct = overrides.totals ?? totalsRef.current;
        const ce = overrides.exterioresData ?? exterioresRef.current;
        const cfg = overrides.config ?? configRef.current;

        const nivel = Number((cfg.npisoterminado + cfg.altasumfondotanqueelevado).toFixed(3));

        const uhSuma = {};
        Object.entries(cg).filter(([, act]) => act).forEach(([grado]) => {
            const base = ct?.totalUDPorGrado?.[grado] || 0;
            const ext = Object.values(ce || {}).find(e => e.nombre?.toLowerCase().includes(grado.toLowerCase()));
            uhSuma[grado] = base + (ext ? Number(((ext.uhTotal ?? (ext.salidasRiego * ext.uh) ?? 0)).toFixed(3)) : 0);
        });

        Object.entries(tabulatorsRef.current).forEach(([key, tab]) => {
            if (!tab) return;
            const [grado] = key.split('-');
            if (!cg[grado]) return;
            const data = tab.getData();
            if (!Array.isArray(data) || !data.length) return;

            const sumaInicial = uhSuma[grado] || 0;
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (row.isStatic) {
                    const pt = activeTuberiasRdData.current[grado]?.find(p => p.value === row.punto);
                    if (pt) {
                        row.uh_total = pt.uh_total;
                        row.caudal = pt.caudal;
                    } else {
                        row.uh_total = '';
                        row.caudal = '';
                    }
                    continue;
                }

                let prevUH = sumaInicial;
                if (i > 0) {
                    const prevRow = data[i - 1];
                    if (!prevRow.isStatic) {
                        prevUH = parseFloat(prevRow.uh_total) || 0;
                    } else if (prevRow.uh_total !== '' && prevRow.uh_total !== undefined && prevRow.punto) {
                        prevUH = parseFloat(prevRow.uh_total);
                    }
                }

                const parcial = parseFloat(row.uh_parcial) || 0;
                const uhTotal = i === 1 ? prevUH : (prevUH - parcial);
                row.uh_total = Number(uhTotal.toFixed(3));
                const flow = getTankFlow(uhTotal);
                row.caudal = flow > 0 ? Number(flow.toFixed(3)) : 0;
            }

            calcularHidraulicaCascada(data, nivel);

            tab._updating = true;
            tab.setData(data).then(() => { tab._updating = false; }).catch(() => { tab._updating = false; });
        });

        scheduleNotify();
    }, [getTankFlow, scheduleNotify]);

    const crearFilaVacia = useCallback((grado = 'inicial') => {
        const acc = accesoriosRef.current[grado] || accesoriosRef.current.inicial;
        const diam = ''; // En riego suele empezar vacío
        const row = {
            id: `${Date.now()}-${Math.random()}`,
            segmento: '', punto: '', cota: '', rawCota: null,
            uh_parcial: '', uh_total: '', caudal: '',
            longitud: '', diametro: diam,
            n1: '', n2: '', n3: '', n4: '',
            longitudtotal: '', coefrug: '',
            s: '', hf: '', hpiez: '', velocidad: '', presion: '',
            verificacion1: '', verificacion2: '',
        };
        if (diam) {
            row.codo90 = obtenerLongitudEquivalente(acc.codo90, diam);
            row.tee = obtenerLongitudEquivalente(acc.tee, diam);
            row.val_compuerta = obtenerLongitudEquivalente(acc.val_compuerta, diam);
            row.reduccion2 = obtenerLongitudEquivalente(acc.reduccion2, diam);
            row.longitudtotal = calcularLongitudTotal(row);
        } else {
            row.codo90 = ''; row.tee = ''; row.val_compuerta = ''; row.reduccion2 = '';
        }
        return row;
    }, [obtenerLongitudEquivalente]);

    const crearModulo = useCallback((grado, count) => {
        const cfg = configRef.current;
        const nivel = Number((cfg.npisoterminado + cfg.altasumfondotanqueelevado).toFixed(3));
        const isFirst = count === 1;
        const filaVacia = crearFilaVacia(grado);
        return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            nombre: `${MODULO_PREFIJO} ${count} ${MODULO_SUFIJO} - ${grado.toUpperCase()}`,
            data: [{
                id: `static-${Date.now()}-${Math.random()}`, isStatic: true,
                segmento: 'TE', punto: '', cota: isFirst ? nivel : 0, rawCota: null,
                uh_parcial: '', uh_total: '', caudal: '',
                longitud: '', diametro: '',
                n1: '', codo90: '', n2: '', tee: '', n3: '', val_compuerta: '', n4: '', reduccion2: '',
                longitudtotal: '', coefrug: isFirst ? 0 : '',
                s: 0, hf: 0, hpiez: isFirst ? nivel : 0,
                velocidad: '', presion: '', verificacion1: '', verificacion2: '',
            }, filaVacia],
        };
    }, [crearFilaVacia]);

    const getFormulaEditor = useCallback((field, rawField) => (cell, onRendered, success, cancel) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full h-full min-h-[28px] px-1 text-sm border-2 border-blue-400 rounded focus:outline-none focus:border-blue-600 bg-white text-gray-800';
        input.style.boxSizing = 'border-box';

        input.value = cell.getData()[rawField] ?? cell.getValue() ?? '';
        onRendered(() => { input.focus(); input.select(); });

        const commit = () => {
            const val = input.value.trim();
            const nd = { [field]: val, [rawField]: null };
            if (val.startsWith('=')) {
                try {
                    const result = Function(`"use strict"; return (${val.slice(1)})`)();
                    nd[field] = isNaN(result) ? 'Error' : Number(result.toFixed(3));
                    nd[rawField] = val;
                } catch { nd[field] = 'Error'; nd[rawField] = val; }
            }

            if (field === 'longitud') {
                const rowData = { ...cell.getData(), ...nd };
                nd.longitudtotal = calcularLongitudTotal(rowData);
            }

            cell.getRow().update(nd);
            success(nd[field]);
            actualizarResultados();
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); });
        input.addEventListener('blur', commit);
        return input;
    }, [actualizarResultados]);

    const getFormulaFormatter = useCallback((field, rawField) => (cell) => {
        const d = cell.getData();
        return d[rawField]?.startsWith('=') ? d[field] : (cell.getValue() ?? '');
    }, []);

    const getColumns = useCallback((grado, moduloId) => {
        const editable = mode === 'edit';
        const onLong = (c) => {
            c.getRow().update({ longitudtotal: calcularLongitudTotal(c.getRow().getData()) });
            actualizarResultados();
        };
        const headerFilterFn = (field, grado) => (cell) => {
            const el = document.createElement('select');
            el.className = 'w-full text-xs p-0 border-none bg-transparent focus:ring-0';
            el.style.minWidth = '85px';
            const gradeAccs = accesoriosRef.current[grado] || accesoriosRef.current.inicial;
            el.innerHTML = ACCESORIO_OPTIONS.map(o =>
                `<option value="${o.value}" ${gradeAccs[field] === o.value ? 'selected' : ''}>${o.label}</option>`
            ).join('');
            el.addEventListener('change', () => {
                const valor = el.value;
                if (!valor) return;

                setAccesoriosConfig(prev => {
                    const next = { ...prev, [grado]: { ...prev[grado], [field]: valor } };
                    accesoriosRef.current = next;
                    return next;
                });

                Object.entries(tabulatorsRef.current).forEach(([key, t]) => {
                    if (!t || !key.startsWith(grado)) return;
                    t.getRows().forEach(row => {
                        const d = row.getData();
                        if (d.diametro) {
                            const leq = obtenerLongitudEquivalente(valor, d.diametro);
                            row.update({
                                [field]: leq,
                                longitudtotal: calcularLongitudTotal({ ...d, [field]: leq })
                            });
                        }
                    });
                });

                actualizarResultados();
            });
            return el;
        };
        const accCol = (field, nField) => [
            { title: 'N°', field: nField, width: 35, editor: editable ? 'input' : false, headerVertical: true, cellEdited: editable ? onLong : undefined },
            {
                title: editable ? '' : (ACCESORIO_LABEL_MAP[accesoriosConfig[grado]?.[field]] || 'Accesorio'),
                field,
                hozAlign: 'center',
                width: 75,
                editor: editable ? 'input' : false,
                headerFilter: editable ? headerFilterFn(field, grado) : false,
                headerVertical: false,
                cellEdited: editable ? onLong : undefined,
            },
        ];
        return [
            {
                title: 'Segmento', field: 'segmento', editor: editable ? 'input' : false, width: 65, headerVertical: true,
                cellEdited: editable ? (cell) => {
                    const row = cell.getRow();
                    const d = row.getData();
                    if (!d.isStatic && typeof d.segmento === 'string' && d.segmento.includes('-')) {
                        const parts = d.segmento.split('-');
                        const segundo = parts[1]?.trim();
                        if (segundo) row.update({ punto: segundo });
                    }
                    actualizarResultados();
                } : undefined
            },
            {
                title: 'Punto', field: 'punto', width: 55, headerVertical: true,
                editor: editable ? (cell, onRendered, success, cancel) => {
                    const row = cell.getRow();
                    const d = row.getData();
                    if (d.isStatic) {
                        const select = document.createElement('select');
                        select.className = 'w-full text-xs p-1 h-full font-bold focus:ring-blue-500 max-w-[100px] border border-gray-300 rounded';
                        const points = activeTuberiasRdData.current[grado] || [];
                        select.innerHTML = `<option value="">--</option>` + points.map(p => `<option value="${p.value}" ${d.punto === p.value ? 'selected' : ''}>${p.label}</option>`).join('');

                        onRendered(() => {
                            select.focus();
                        });

                        const handleChange = () => {
                            const val = select.value;
                            const pt = points.find(p => p.value === val);
                            if (pt) {
                                // Auto-sequence the rows
                                const tableRows = row.getTable().getRows();
                                let currentPrefix = val;
                                tableRows.forEach((r, idx) => {
                                    if (idx === 0) {
                                        r.update({ punto: val, cota: pt.hpiez, rawCota: null, uh_total: pt.uh_total, caudal: pt.caudal });
                                    } else {
                                        const newPunto = `${val}${idx}`;
                                        r.update({
                                            segmento: `${currentPrefix}-${newPunto}`,
                                            punto: newPunto
                                        });
                                        currentPrefix = newPunto;
                                    }
                                });
                            } else {
                                row.update({ punto: val, cota: '', rawCota: null, uh_total: '', caudal: '' });
                            }
                            success(val);
                            actualizarResultados();
                        };

                        select.addEventListener('change', handleChange);
                        select.addEventListener('blur', () => success(select.value));
                        return select;
                    }

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = cell.getValue() || '';
                    input.className = 'w-full h-full p-1 border-gray-300 rounded';
                    onRendered(() => { input.focus(); });
                    input.addEventListener('change', () => success(input.value));
                    input.addEventListener('blur', () => success(input.value));
                    return input;
                } : false,
                cellEdited: editable ? () => actualizarResultados() : undefined
            },
            { title: 'Cota', field: 'cota', editor: editable ? getFormulaEditor('cota', 'rawCota') : false, formatter: getFormulaFormatter('cota', 'rawCota'), headerVertical: true, width: 65, cellEdited: editable ? () => actualizarResultados() : undefined },
            {
                title: 'U.H.', columns: [
                    { title: 'Parcial', field: 'uh_parcial', editor: editable ? 'input' : false, headerVertical: true, width: 50, cellEdited: editable ? () => actualizarResultados() : undefined },
                    { title: 'Total', field: 'uh_total', editor: false, width: 55, headerVertical: true },
                ]
            },
            { title: 'Caudal (l/s)', field: 'caudal', headerVertical: true, width: 55, editor: false },
            { title: 'Longitud (m)', field: 'longitud', editor: editable ? getFormulaEditor('longitud', 'rawLongitud') : false, formatter: getFormulaFormatter('longitud', 'rawLongitud'), headerVertical: true, width: 65, cellEdited: editable ? onLong : undefined },
            {
                title: 'Diámetro plg', field: 'diametro',
                editor: editable ? 'list' : false,
                editorParams: editable ? { values: DIAMETRO_LABELS } : {},
                headerVertical: true, width: 85,
                cellEdited: editable ? (cell) => {
                    const row = cell.getRow(); const d = row.getData();
                    const gradeAccs = accesoriosRef.current[grado] || accesoriosRef.current.inicial;
                    const updates = {
                        codo90: obtenerLongitudEquivalente(gradeAccs.codo90, d.diametro),
                        tee: obtenerLongitudEquivalente(gradeAccs.tee, d.diametro),
                        val_compuerta: obtenerLongitudEquivalente(gradeAccs.val_compuerta, d.diametro),
                        reduccion2: obtenerLongitudEquivalente(gradeAccs.reduccion2, d.diametro),
                    };
                    updates.longitudtotal = calcularLongitudTotal({ ...d, ...updates });
                    row.update(updates);
                    actualizarResultados();
                } : undefined,
            },
            { title: 'Longitud Equivalente (m)', columns: [...accCol('codo90', 'n1'), ...accCol('tee', 'n2'), ...accCol('val_compuerta', 'n3'), ...accCol('reduccion2', 'n4')] },
            { title: 'Longitud Total (m)', field: 'longitudtotal', editor: false, headerVertical: true, width: 75, formatter: longitudTotalFormatter },
            { title: 'Coef. Rug.H-W', field: 'coefrug', editor: editable ? 'input' : false, headerVertical: true, width: 60, cellEdited: editable ? () => actualizarResultados() : undefined },
            { title: 'S(m/m)', field: 's', headerVertical: true, width: 55 },
            { title: 'Hf(m)', field: 'hf', headerVertical: true, width: 55 },
            { title: 'H. Piez. (m)', field: 'hpiez', headerVertical: true, width: 65 },
            { title: 'Velocidad(m/s)', field: 'velocidad', headerVertical: true, width: 65 },
            { title: 'Presión (mca)', field: 'presion', headerVertical: true, width: 65 },
            {
                title: 'VERIFICACIONES', columns: [
                    { title: '0.60<V< Adm?', field: 'verificacion1', headerVertical: true, width: 55, formatter: verificacionFormatter },
                    { title: 'P>2mca?', field: 'verificacion2', headerVertical: true, width: 55, formatter: verificacionFormatter },
                ]
            },
            ...(editable ? [{
                title: '', field: 'actions', hozAlign: 'center', headerSort: false, width: 40,
                formatter: cell => cell.getData().isStatic ? '' : '<button style="color:red;font-size:16px">×</button>',
                cellClick: (e, cell) => { if (!cell.getData().isStatic) { cell.getRow().delete(); scheduleNotify(); } },
            }] : []),
        ];
    }, [mode, getFormulaEditor, getFormulaFormatter, actualizarResultados, obtenerLongitudEquivalente, scheduleNotify, activeTuberiasRdData, accesoriosConfig]);

    const initTabulator = useCallback((grado, moduloId, data = [], attempt = 0) => {
        const id = `tabulator-table-redriego-${grado}-${moduloId}`;
        const el = document.getElementById(id);
        if (!el) {
            if (attempt < 15) setTimeout(() => initTabulator(grado, moduloId, data, attempt + 1), 80);
            return;
        }
        const key = `${grado}-${moduloId}`;
        if (tabulatorsRef.current[key]) { try { tabulatorsRef.current[key].destroy(); } catch (_) { } delete tabulatorsRef.current[key]; }
        try {
            const tab = new Tabulator(`#${id}`, {
                ...TABULATOR_BASE_OPTIONS,
                data: data.length > 0 ? data : [crearFilaVacia(grado)],
                columns: getColumns(grado, moduloId),
                movableRows: mode === 'edit',
                columnDefaults: TABULATOR_COLUMN_DEFAULTS,
            });
            tabulatorsRef.current[key] = tab;
            setTimeout(() => {
                tab.on('dataChanged', () => {
                    if (tab._updating) return;
                    actualizarResultados();
                });
                actualizarResultados();
            }, 150);
        } catch (err) { console.error(`Error Tabulator #${id}:`, err); }
    }, [getColumns, crearFilaVacia, actualizarResultados, mode]);

    const addModulo = useCallback((grado) => {
        const count = (tablesRef.current[grado]?.modules?.length || 0) + 1;
        const modulo = crearModulo(grado, count);
        setTables(prev => ({ ...prev, [grado]: { ...prev[grado], modules: [...(prev[grado]?.modules || []), modulo] } }));
        setTimeout(() => { initTabulator(grado, modulo.id, modulo.data); scheduleNotify(); }, 0);
    }, [crearModulo, initTabulator, scheduleNotify]);

    const removeModulo = useCallback((grado, id) => {
        const key = `${grado}-${id}`;
        if (tabulatorsRef.current[key]) { try { tabulatorsRef.current[key].destroy(); } catch (_) { } delete tabulatorsRef.current[key]; }
        setTables(prev => ({ ...prev, [grado]: { ...prev[grado], modules: prev[grado].modules.filter(m => m.id !== id) } }));
        scheduleNotify();
    }, [scheduleNotify]);

    const addRow = useCallback((grado, moduloId) => {
        const tab = tabulatorsRef.current[`${grado}-${moduloId}`];
        if (tab) {
            const rows = tab.getData();
            let newFila = crearFilaVacia(grado);

            // Auto-sequence logic if possible
            if (rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                const lastPunto = lastRow.punto || '';
                if (lastPunto) {
                    const match = lastPunto.match(/^([A-Za-z]+)(\d*)$/);
                    if (match) {
                        const prefix = match[1];
                        const nextNum = match[2] ? parseInt(match[2], 10) + 1 : 1;
                        const newPunto = `${prefix}${nextNum}`;
                        newFila.segmento = `${lastPunto}-${newPunto}`;
                        newFila.punto = newPunto;
                    }
                }
            }

            tab.addRow(newFila);
            setTimeout(() => actualizarResultados(), 80);
        }
    }, [crearFilaVacia, actualizarResultados]);

    // Efecto 1: maximaDemandaData cambia
    useEffect(() => {
        if (!maximaDemandaData) return;
        const { grades: ng, totals: nt, exterioresData: ne } = maximaDemandaData;
        if (ng) { setGrades(ng); gradesRef.current = ng; }
        if (nt) { setTotals(nt); totalsRef.current = nt; }
        if (ne) { setExterioresData(ne); exterioresRef.current = ne; }
        actualizarResultados({ grades: ng, totals: nt, exterioresData: ne });
    }, [maximaDemandaData]); // eslint-disable-line

    // Efecto 2: grades cambia → crear módulo inicial si aún no existe
    useEffect(() => {
        setTables(prev => {
            let changed = false; const next = { ...prev };
            Object.keys(prev).forEach(grado => {
                if (!grades[grado]) return;
                const curr = prev[grado];
                if (!curr.modules?.length) { changed = true; next[grado] = { modules: [crearModulo(grado, 1)], expanded: true }; }
                else if (!curr.expanded) { changed = true; next[grado] = { ...curr, expanded: true }; }
            });
            return changed ? next : prev;
        });
    }, [grades]); // eslint-disable-line

    // Efecto 3: tables cambia → inicializar nuevas tablas
    useEffect(() => {
        Object.entries(tables).forEach(([grado, { modules }]) =>
            modules.forEach(mod => { if (!tabulatorsRef.current[`${grado}-${mod.id}`]) initTabulator(grado, mod.id, mod.data); })
        );
    }, [tables]); // eslint-disable-line

    // Efecto 4: modo cambia → actualizar columnas SIN destruir datos
    useEffect(() => {
        if (prevModeRef.current === mode) return;
        prevModeRef.current = mode;
        Object.entries(tabulatorsRef.current).forEach(([key, tab]) => {
            if (!tab) return;
            const parts = key.split('-'); const grado = parts[0]; const moduloId = parts.slice(1).join('-');
            try { const data = tab.getData(); tab.setColumns(getColumns(grado, moduloId)); tab.setData(data); }
            catch (err) {
                const mod = tablesRef.current[grado]?.modules?.find(m => String(m.id) === moduloId);
                initTabulator(grado, moduloId, mod?.data || []);
            }
        });
    }, [mode]); // eslint-disable-line

    // Sincronizar columnas cuando cambian accesorios
    useEffect(() => {
        Object.entries(tabulatorsRef.current).forEach(([key, tab]) => {
            if (!tab) return;
            const parts = key.split('-');
            const grado = parts[0];
            const moduloId = parts.slice(1).join('-');
            try {
                const data = tab.getData();
                tab.setColumns(getColumns(grado, moduloId));
                tab.setData(data);
            } catch (err) { console.warn("Error sync columns", err); }
        });
    }, [accesoriosConfig]); // eslint-disable-line

    // Efecto 5: cleanup al desmontar
    useEffect(() => () => {
        if (notifyTimer.current) clearTimeout(notifyTimer.current);
        Object.values(tabulatorsRef.current).forEach(tab => { try { tab?.destroy(); } catch (_) { } });
        tabulatorsRef.current = {};
    }, []);

    return (
        <div className="w-full p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-lg sticky top-12 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-600 to-green-700 rounded-xl shadow-lg">
                            <i className="fas fa-seedling text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">8. CÁLCULO DE LA RED DE RIEGO</h1>
                            <p className="text-sm text-slate-600">Red hidráulica de riego exterior</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full py-4 space-y-6">
                {/* Configuración */}
                <div className="p-6 bg-white rounded-xl shadow">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Nivel de Piso Terminado', key: 'npisoterminado' },
                            { label: 'Altura asumida Fondo Tanque Elevado', key: 'altasumfondotanqueelevado' },
                            { label: 'Nivel asumido Fondo Tanque Elevado', key: 'nivel', computed: true },
                        ].map(({ label, key, computed }) => (
                            <div key={key} className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 tracking-wide">{label}</label>
                                <div className="flex items-center">
                                    <input type="number" step="0.001"
                                        value={computed ? nivelasumfondotanqueelevado : config[key]}
                                        disabled={computed || mode !== 'edit'}
                                        onChange={e => {
                                            if (computed) return;
                                            const val = parseFloat(e.target.value) || 0;
                                            const newCfg = { ...configRef.current, [key]: val };
                                            setConfig(newCfg); configRef.current = newCfg; scheduleNotify();
                                        }}
                                        className={`w-full px-3 py-2 font-semibold rounded-l-md border-2 text-gray-950 focus:outline-none ${computed ? 'bg-white border-gray-300' : 'bg-yellow-100 border-yellow-300'}`}
                                    />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border border-gray-300">m</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tablas por grado */}
                {Object.entries(tables).filter(([grado]) => grades[grado]).map(([grado, table]) => (
                    <div key={grado} className="bg-white/90 rounded-xl shadow-lg border border-slate-200/60 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white">
                            <div className="flex items-center space-x-3">
                                <i className="fas fa-layer-group"></i>
                                <span className="text-lg font-semibold capitalize">{grado}</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                {mode === 'edit' && (
                                    <button onClick={() => addModulo(grado)} className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded text-sm flex items-center gap-1">
                                        <i className="fas fa-plus"></i>Módulo
                                    </button>
                                )}
                                <button onClick={() => setTables(p => ({ ...p, [grado]: { ...p[grado], expanded: !p[grado].expanded } }))} className="text-white hover:text-gray-200">
                                    <i className={`fas ${table.expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                </button>
                            </div>
                        </div>
                        {table.expanded && (
                            <div className="bg-white">
                                {table.modules.map(modulo => (
                                    <div key={modulo.id} className="mb-8 border border-slate-200 rounded-xl shadow-inner bg-slate-50 mx-3 mt-3">
                                        <div className="flex items-center justify-between px-4 py-2 bg-green-100 rounded-t-xl">
                                            <div className="flex items-center space-x-3">
                                                <i className="fas fa-cube text-green-700"></i>
                                                {mode === 'edit' ? (
                                                    <input type="text" value={modulo.nombre}
                                                        onChange={e => setTables(p => ({ ...p, [grado]: { ...p[grado], modules: p[grado].modules.map(m => m.id === modulo.id ? { ...m, nombre: e.target.value } : m) } }))}
                                                        className="font-semibold text-green-800 bg-white border border-green-300 rounded px-2 py-1 text-sm w-full max-w-xl"
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-green-800">{modulo.nombre}</span>
                                                )}
                                            </div>
                                            {mode === 'edit' && (
                                                <button onClick={() => removeModulo(grado, modulo.id)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                                                    <i className="fas fa-trash-alt"></i>Eliminar
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <div id={`tabulator-table-redriego-${grado}-${modulo.id}`} className="w-full overflow-x-auto border rounded-lg shadow-inner min-h-[160px]"></div>
                                            {mode === 'edit' && (
                                                <div className="flex justify-end mt-3">
                                                    <button onClick={() => addRow(grado, modulo.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                                                        <i className="fas fa-plus"></i>Fila
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </main>
        </div>
    );
};

export default RedRiego;
