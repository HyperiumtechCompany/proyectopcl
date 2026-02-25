import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import longEquival from '../lib/longitud-components.js';
import UHData from '../lib/uh-componets.js';
import {
    DIAMETRO_OPTIONS,
    DIAMETRO_LABELS,
    ACCESORIO_LABEL_MAP,
    ACCESORIO_OPTIONS,
    sanitize,
    calcularLongitudTotal,
    calcularHidraulicaCascada,
    verificacionFormatter,
    longitudTotalFormatter,
    TABULATOR_BASE_OPTIONS,
    TABULATOR_COLUMN_DEFAULTS,
} from '../lib/agua-tabulator.ts';

// La tabla de Hunter (UHData) se importa desde uh-componets.js

const TuberiasRD = ({ initialData, canEdit, editMode, onChange, maximaDemandaData }) => {
    const mode = canEdit && editMode ? 'edit' : 'view';
    const prevModeRef = useRef(mode);

    const [config, setConfig] = useState({
        npisoterminado: initialData?.config?.npisoterminado ?? 0.65,
        altasumfondotanqueelevado: initialData?.config?.altasumfondotanqueelevado ?? 13.85,
    });
    const [grades, setGrades] = useState({ inicial: true, primaria: false, secundaria: false });
    const [tables, setTables] = useState(() => {
        if (initialData?.tables || initialData?.tablas) return initialData.tables ?? initialData.tablas;
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

    // Refs — evitan stale closures en callbacks Tabulator
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

    const nivelasumfondotanqueelevado = useMemo(() =>
        Number((config.npisoterminado + config.altasumfondotanqueelevado).toFixed(3)),
        [config]
    );

    const getTankFlow = useCallback((units) => {
        const u = parseFloat(units);
        if (isNaN(u) || u <= 0) return 0;

        // Exact match with small tolerance
        const exact = UHData.find(item => Math.abs(item.units - u) < 0.0001);
        if (exact) return exact.tankFlow;

        // Find surrounding values for interpolation
        let lower = null;
        let higher = null;

        for (const item of UHData) {
            if (item.units < u) {
                lower = item;
            } else if (item.units > u) {
                higher = item;
                break;
            }
        }

        if (lower && higher) {
            // Linear interpolation: y = y0 + (x - x0) * (y1 - y0) / (x1 - x0)
            return lower.tankFlow + (u - lower.units) * (higher.tankFlow - lower.tankFlow) / (higher.units - lower.units);
        }

        if (higher) return higher.tankFlow;
        if (lower) return lower.tankFlow; // Return last known value for values above the table
        return 0;
    }, []);

    const obtenerLongitudEquivalente = useCallback((tipo, diametro) => {
        if (!tipo || !diametro) return 0;
        const d = String(diametro).trim();
        const t = String(tipo).trim();
        return longEquival?.[t]?.[d] ?? 0;
    }, []);

    // ── notifyChange: usa refs para no tener stale closure ───────────────────
    const notifyChange = useCallback(() => {
        if (!onChangeRef.current) return;
        const ct = tablesRef.current;
        const cfg = configRef.current;
        const nivel = Number((cfg.npisoterminado + cfg.altasumfondotanqueelevado).toFixed(3));

        const tablas = {};
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

            // Emit format
            tablas[grado] = ct[grado].modules.map(modulo => {
                const key = `${grado}-${modulo.id}`;
                const tab = tabulatorsRef.current[key];
                return { nombre: modulo.nombre, data: tab ? tab.getData() : modulo.data || [] };
            });
        });

        // Emitir el evento global para los tabs dependientes (RedesInteriores, RedRiego)
        document.dispatchEvent(new CustomEvent('red-alimentacion-updated', {
            detail: { config: cfg, nivelasumfondotanqueelevado: nivel, tablas },
        }));

        onChangeRef.current({
            config: cfg,
            grades: gradesRef.current,
            tables: tablasActualizadas,
            totals: totalsRef.current,
            exterioresData: exterioresRef.current,
            tablas,
        });
    }, []);

    const scheduleNotify = useCallback(() => {
        if (notifyTimer.current) clearTimeout(notifyTimer.current);
        notifyTimer.current = setTimeout(notifyChange, 400);
    }, [notifyChange]);

    // ── actualizarResultados: UH en cascada + Hazen-Williams ─────────────────
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

            // UH y caudal en cascada
            const sumaInicial = uhSuma[grado] || 0;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (row.isStatic) {
                    row.uh_total = '';
                    row.caudal = '';
                    continue;
                }

                // Si es la primera fila no estática, toma la suma inicial
                // Si hay una fila anterior (estática o no), pero somos la primera con cálculos, 
                // necesitamos saber si somos el inicio de la cadena.
                // En este diseño, la primera fila de datos (idx 1 usualmente, tras la estática) es la que recibe la sumaInicial.

                let prevUH = sumaInicial;
                // Buscar la fila anterior que tenga uh_total real (no estática)
                // O simplemente usar la lógica de índice si la estructura es fija
                if (i > 0) {
                    const prevRow = data[i - 1];
                    if (!prevRow.isStatic) {
                        prevUH = parseFloat(prevRow.uh_total) || 0;
                    }
                }

                const parcial = parseFloat(row.uh_parcial) || 0;
                const uhTotal = i === 1 ? sumaInicial : (prevUH - parcial);

                row.uh_total = Number(uhTotal.toFixed(3));
                const flow = getTankFlow(uhTotal);
                row.caudal = flow > 0 ? Number(flow.toFixed(3)) : 0;
            }

            // Hazen-Williams en cascada (velocidades, presiones, etc)
            calcularHidraulicaCascada(data, nivel);

            // Actualizar masivamente
            tab._updating = true;
            tab.setData(data).then(() => {
                tab._updating = false;
            }).catch(e => {
                tab._updating = false;
            });
        });

        scheduleNotify();
    }, [getTankFlow, scheduleNotify]);

    // ── Fábrica de filas y módulos ────────────────────────────────────────────
    const crearFilaVacia = useCallback((grado = 'inicial') => {
        const acc = accesoriosRef.current[grado] || accesoriosRef.current.inicial;
        const diam = '2 1/2 pulg';
        const row = {
            id: `${Date.now()}-${Math.random()}`,
            segmento: 'TE', punto: 'TE', cota: 14.5, rawCota: null,
            uh_parcial: '', uh_total: 0, caudal: 0,
            longitud: 15.5, diametro: diam,
            n1: 1, n2: 0, n3: 0, n4: 0,
            coefrug: 150,
            s: 0, hf: 0, hpiez: 0, velocidad: 0, presion: 0,
            verificacion1: '', verificacion2: '',
        };
        // Calcular longitudes equivalentes base
        row.codo90 = obtenerLongitudEquivalente(acc.codo90, diam);
        row.tee = obtenerLongitudEquivalente(acc.tee, diam);
        row.val_compuerta = obtenerLongitudEquivalente(acc.val_compuerta, diam);
        row.reduccion2 = obtenerLongitudEquivalente(acc.reduccion2, diam);
        row.longitudtotal = calcularLongitudTotal(row);
        return row;
    }, [obtenerLongitudEquivalente]);

    const crearModulo = useCallback((grado, count) => {
        const cfg = configRef.current;
        const nivel = Number((cfg.npisoterminado + cfg.altasumfondotanqueelevado).toFixed(3));
        const isFirst = count === 1;
        const filaVacia = crearFilaVacia(grado);
        return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            nombre: `CALCULO DE LA RED DE DISTRIBUCION ${count} (MAS DESFAVORABLE LAVATORIO) CIRCUITO ${count} - ${grado.toUpperCase()}`,
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

    // ── Editor de celdas con fórmulas ─────────────────────────────────────────
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

    // ── Definición de columnas ────────────────────────────────────────────────
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

                // Solo actualizar tabuladores del grado correspondiente
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
                field, hozAlign: 'center', width: 75,
                editor: editable ? 'input' : false,
                headerSort: false,
                headerFilter: editable ? headerFilterFn(field, grado) : false,
                headerVertical: false,
                cellEdited: editable ? onLong : undefined,
            },
        ];

        const cols = [
            {
                title: 'Segmento', field: 'segmento', editor: editable ? 'input' : false, width: 65, headerVertical: true,
                cellEdited: editable ? (cell) => {
                    const val = cell.getValue();
                    if (typeof val === 'string' && val.includes('-')) {
                        const segundo = val.split('-')[1]?.trim();
                        if (segundo) cell.getRow().update({ punto: segundo });
                    }
                    actualizarResultados();
                } : undefined,
            },
            {
                title: 'Punto', field: 'punto', editor: editable ? 'input' : false, width: 55, headerVertical: true,
                cellEdited: editable ? () => actualizarResultados() : undefined,
            },
            {
                title: 'Cota', field: 'cota', editor: editable ? getFormulaEditor('cota', 'rawCota') : false, formatter: getFormulaFormatter('cota', 'rawCota'), headerVertical: true, width: 65,
                cellEdited: editable ? () => actualizarResultados() : undefined,
            },
            {
                title: 'U.H.', columns: [
                    { title: 'Parcial', field: 'uh_parcial', editor: editable ? 'input' : false, width: 50, headerVertical: true, cellEdited: editable ? () => actualizarResultados() : undefined },
                    { title: 'Total', field: 'uh_total', editor: false, width: 55, headerVertical: true },
                ]
            },
            { title: 'Caudal (l/s)', field: 'caudal', headerVertical: true, width: 55, editor: false },
            { title: 'Longitud (m)', field: 'longitud', editor: editable ? getFormulaEditor('longitud', 'rawLongitud') : false, formatter: getFormulaFormatter('longitud', 'rawLongitud'), width: 65, headerVertical: true, cellEdited: editable ? onLong : undefined },
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
        return cols;
    }, [mode, getFormulaEditor, getFormulaFormatter, actualizarResultados, obtenerLongitudEquivalente, scheduleNotify, accesoriosConfig]);

    // ── initTabulator con retry limitado ──────────────────────────────────────
    const initTabulator = useCallback((grado, moduloId, data = [], attempt = 0) => {
        const id = `tabulator-tuberiasrd-${grado}-${moduloId}`;
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
                printAsHtml: true,
                printHeader: '<h1>Red de Distribución</h1>',
            });
            tabulatorsRef.current[key] = tab;
            setTimeout(() => {
                tab.on('dataChanged', () => {
                    // Evitar bucles infinitos si updateRow dispara dataChanged
                    if (tab._updating) return;
                    actualizarResultados();
                });
                actualizarResultados();
            }, 150);
        } catch (err) { console.error(`Error Tabulator #${id}:`, err); }
    }, [getColumns, crearFilaVacia, actualizarResultados, mode]);

    // ── Acciones de módulos y filas ───────────────────────────────────────────
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
        if (tab) { tab.addRow(crearFilaVacia(grado)); setTimeout(() => actualizarResultados(), 80); }
    }, [crearFilaVacia, actualizarResultados]);

    // ── Efectos ───────────────────────────────────────────────────────────────

    // 1. maximaDemandaData → actualizar grades/totals/ext y recalcular
    useEffect(() => {
        if (!maximaDemandaData) return;
        const { grades: ng, totals: nt, exterioresData: ne } = maximaDemandaData;
        const prevG = gradesRef.current;

        if (ng) { setGrades(ng); gradesRef.current = ng; }
        if (nt) { setTotals(nt); totalsRef.current = nt; }
        if (ne) { setExterioresData(ne); exterioresRef.current = ne; }

        // Destruir tablas de grados que se desactivaron
        if (ng) {
            Object.keys(prevG).forEach(grado => {
                if (prevG[grado] && !ng[grado]) {
                    (tablesRef.current[grado]?.modules || []).forEach(m => {
                        const k = `${grado}-${m.id}`;
                        if (tabulatorsRef.current[k]) { try { tabulatorsRef.current[k].destroy(); } catch (_) { } delete tabulatorsRef.current[k]; }
                    });
                    setTables(prev => ({ ...prev, [grado]: { ...prev[grado], modules: [], expanded: false } }));
                }
            });
        }
        actualizarResultados({ grades: ng, totals: nt, exterioresData: ne });
    }, [maximaDemandaData]); // eslint-disable-line

    // 2. grades cambia → crear módulo inicial
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

    // 3. tables cambia → inicializar nuevos tabulators
    useEffect(() => {
        Object.entries(tables).forEach(([grado, { modules }]) =>
            modules.forEach(mod => { if (!tabulatorsRef.current[`${grado}-${mod.id}`]) initTabulator(grado, mod.id, mod.data); })
        );
    }, [tables]); // eslint-disable-line

    // 4. Cambio de modo → setColumns en lugar de destruir/recrear
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

    // 6. Sincronizar columnas cuando cambian accesorios
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

    // 7. Cleanup
    useEffect(() => () => {
        if (notifyTimer.current) clearTimeout(notifyTimer.current);
        Object.values(tabulatorsRef.current).forEach(tab => { try { tab?.destroy(); } catch (_) { } });
        tabulatorsRef.current = {};
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-lg sticky top-12 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
                            <i className="fas fa-pipes text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">6. CÁLCULO DE LA RED DE DISTRIBUCIÓN</h1>
                            <p className="text-sm text-slate-600">Red de distribución hidráulica</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full py-4 space-y-4">
                {/* Configuración */}
                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-xl shadow">
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
                                        className={`w-full px-3 py-2 bg-${computed ? 'white border-gray-300' : 'yellow-100 border-yellow-300'} border-2 text-gray-700 font-semibold rounded-l-md focus:outline-none`}
                                    />
                                    <span className="px-3 py-2 bg-gray-200 text-sm text-gray-700 rounded-r-md border border-gray-300">m</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tablas por grado */}
                {Object.entries(tables).map(([grado, table]) => grades[grado] && (
                    <div key={grado} className="bg-white/90 rounded-xl shadow-lg border border-slate-200/60 mb-6 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
                            <div className="flex items-center space-x-2">
                                <i className="fas fa-layer-group text-white"></i>
                                <span className="text-lg font-semibold text-white capitalize">{grado}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {mode === 'edit' && (
                                    <button onClick={() => addModulo(grado)} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                        <i className="fas fa-plus"></i>Módulo
                                    </button>
                                )}
                                <button onClick={() => setTables(prev => ({ ...prev, [grado]: { ...prev[grado], expanded: !prev[grado].expanded } }))} className="text-white">
                                    <i className={`fas ${table.expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                </button>
                            </div>
                        </div>
                        {table.expanded && (
                            <div className="p-4 bg-white">
                                {table.modules.map(modulo => (
                                    <div key={modulo.id} className="mb-8 border border-slate-200 rounded-xl shadow-inner bg-slate-50">
                                        <div className="flex items-center justify-between px-4 py-2 bg-blue-100 rounded-t-xl">
                                            <div className="flex items-center space-x-2">
                                                <i className="fas fa-cube text-blue-700"></i>
                                                {mode === 'edit' ? (
                                                    <input type="text" value={modulo.nombre}
                                                        onChange={e => setTables(prev => ({ ...prev, [grado]: { ...prev[grado], modules: prev[grado].modules.map(m => m.id === modulo.id ? { ...m, nombre: e.target.value } : m) } }))}
                                                        className="font-semibold text-blue-800 bg-white border border-blue-300 rounded px-2 py-1 text-sm w-full max-w-xl"
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-blue-800">{modulo.nombre}</span>
                                                )}
                                            </div>
                                            {mode === 'edit' && (
                                                <button onClick={() => removeModulo(grado, modulo.id)} className="text-red-600 hover:text-red-800 text-xs flex items-center gap-1">
                                                    <i className="fas fa-trash-alt"></i>Eliminar módulo
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <div id={`tabulator-tuberiasrd-${grado}-${modulo.id}`} className="tabulator-table-container w-full overflow-x-auto border rounded-lg shadow-inner min-h-[160px]"></div>
                                            {mode === 'edit' && (
                                                <div className="flex justify-end mt-2">
                                                    <button onClick={() => addRow(grado, modulo.id)} className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
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

export default TuberiasRD;
