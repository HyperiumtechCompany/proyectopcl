import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';

const USO_OPTIONS = [
    { label: 'DEPOSITO', value: 'DEPOSITO' },
    { label: 'ALMACEN', value: 'ALMACEN' },
    { label: 'OFICINA', value: 'OFICINA' },
    { label: 'CONSULTORIO', value: 'CONSULTORIO' },
    { label: 'LABORATORIO', value: 'LABORATORIO' },
    { label: 'COMEDOR', value: 'COMEDOR' },
];

const DOTACION_OPTIONS = [
    { label: '0.50 Lt x m2 / dia', value: 0.5 },
    { label: '2.00 Lt x m2 / dia', value: 2 },
    { label: '6.00 Lt x m2 / dia', value: 6 },
    { label: '40.00 Lt x m2 / dia', value: 40 },
    { label: '50.00 Lt x per / dia', value: 50 },
    { label: '200.00 Lt x per / dia', value: 200 },
    { label: '500.00 Lt /dia', value: 500 },
];

const DEFAULT_TABLA1 = [
    { id: 'tabla1_1', ambiente: '(DOCENTES) NIVEL INICIAL', uso: 'DOCENTES', cantidad: 3, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_2', ambiente: '(DOCENTES) NIVEL INICIAL', uso: 'DOCENTES', cantidad: 3, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_3', ambiente: '(DOCENTES) NIVEL PRIMARIA', uso: 'DOCENTES', cantidad: 15, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_4', ambiente: '(ALUMNOS) NIVEL INICIAL', uso: 'ALUMNOS/2 aulas 31 c/u', cantidad: 62, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_5', ambiente: '(ALUMNOS) NIVEL PRIMARIA', uso: 'ALUM./10 aulas 25 c/u +16', cantidad: 266, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_6', ambiente: 'DIRECTOR', uso: 'DIRECTOR', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_7', ambiente: 'GUARDIAN', uso: 'GUARDIAN', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_8', ambiente: 'PER.SERVICIO', uso: 'PER.SERVICIO', cantidad: 2, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_9', ambiente: 'BIBLIOTECARIA', uso: 'BIBLIOTECARIA', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
    { id: 'tabla1_10', ambiente: 'SECRETARIA', uso: 'SECRETARIA', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
];

const DEFAULT_TABLA2 = [
    {
        id: 'piso_0',
        modulos: [
            { id: 'piso0_mod0', ambiente: 'ALMACEN GENERAL', uso: 'ALMACEN', cantidad: 28.91, dotacion: '0.50 Lt x m2 / dia' },
            { id: 'piso0_mod2', ambiente: 'ALMACEN GENERAL', uso: 'ALMACEN', cantidad: 28.91, dotacion: '0.50 Lt x m2 / dia' },
            { id: 'piso0_mod3', ambiente: 'DEPOSITO SUM', uso: 'DEPOSITO', cantidad: 30.08, dotacion: '0.50 Lt x m2 / dia' },
            { id: 'piso0_mod4', ambiente: 'DEPOSITO DE MATERIALES DEPORT.', uso: 'DEPOSITO', cantidad: 16.01, dotacion: '0.50 Lt x m2 / dia' },
            { id: 'piso0_mod5', ambiente: 'COMEDOR', uso: 'COMEDOR', cantidad: 118.06, dotacion: '40.00 Lt x m2 / dia' },
            { id: 'piso0_mod6', ambiente: 'BIBLIOTECA /AREA DE LIBROS', uso: 'OFICINA', cantidad: 93.8, dotacion: '6.00 Lt x m2 / dia' },
        ],
    },
    {
        id: 'piso_1',
        modulos: [
            { id: 'piso1_mod0', ambiente: 'MODULO DE CONECTIVIDAD', uso: 'OFICINA', cantidad: 24.53, dotacion: '6.00 Lt x m2 / dia' },
        ],
    },
];

const DEFAULT_TABLA3 = [
    { id: 'tabla3_1', ambiente: 'JARDINES', uso: 'AREAS VERDES', cantidad: 533.06, dotacion: '2.00 Lt x m2 / dia' },
    { id: 'tabla3_2', ambiente: 'DEPOSITO', uso: 'DEPOSITOS', cantidad: 137.36, dotacion: '0.50 Lt x m2 / dia' },
];

const toNumber = (value) => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Number.parseFloat((Number.isFinite(value) ? value : 0).toFixed(2));

const extractDotacionValue = (dotacion) => {
    if (typeof dotacion === 'number') return dotacion;
    const text = String(dotacion ?? '');

    const option = DOTACION_OPTIONS.find((d) => d.label === text);
    if (option) return option.value;

    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? toNumber(match[1]) : 0;
};

const calcCaudal = (item) => {
    const cantidad = toNumber(item.cantidad);
    const dotacion = String(item.dotacion ?? '');
    const dotacionValue = extractDotacionValue(dotacion);

    if (dotacion.includes('Lt /dia')) {
        return round2(dotacionValue);
    }

    return round2(cantidad * dotacionValue);
};

const normalizeRow = (row, fallbackDotacion, prefix) => {
    const normalized = {
        id: row?.id ?? `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ambiente: row?.ambiente ?? 'Nuevo Ambiente',
        uso: row?.uso ?? 'Nuevo Uso',
        cantidad: toNumber(row?.cantidad),
        dotacion: row?.dotacion ?? fallbackDotacion,
    };

    return {
        ...normalized,
        caudal: calcCaudal(normalized),
    };
};

const normalizeTabla2 = (tabla2) =>
    (Array.isArray(tabla2) ? tabla2 : []).map((piso, pisoIndex) => ({
        id: piso?.id ?? `piso_${pisoIndex}_${Date.now()}`,
        modulos: (Array.isArray(piso?.modulos) ? piso.modulos : []).map((modulo, modIndex) =>
            normalizeRow(modulo, '0.50 Lt x m2 / dia', `piso${pisoIndex}_mod${modIndex}`),
        ),
    }));

const buildState = (initialData) => {
    const tabla1 = (Array.isArray(initialData?.tabla1) ? initialData.tabla1 : DEFAULT_TABLA1).map((row, idx) =>
        normalizeRow(row, '50.00 Lt x per / dia', `tabla1_${idx}`),
    );

    const tabla2 = normalizeTabla2(Array.isArray(initialData?.tabla2) ? initialData.tabla2 : DEFAULT_TABLA2);

    const tabla3 = (Array.isArray(initialData?.tabla3) ? initialData.tabla3 : DEFAULT_TABLA3).map((row, idx) =>
        normalizeRow(row, '2.00 Lt x m2 / dia', `tabla3_${idx}`),
    );

    return { tabla1, tabla2, tabla3 };
};

const calcTotalCaudal = (tabla1, tabla2, tabla3) => {
    const total1 = tabla1.reduce((sum, item) => sum + toNumber(item.caudal), 0);
    const total2 = tabla2.reduce(
        (sum, piso) => sum + piso.modulos.reduce((sub, item) => sub + toNumber(item.caudal), 0),
        0,
    );
    const total3 = tabla3.reduce((sum, item) => sum + toNumber(item.caudal), 0);

    return round2(total1 + total2 + total3);
};

const DemandaDiaria = ({ initialData, canEdit, editMode, onChange }) => {
    const mode = canEdit && editMode ? 'edit' : 'view';

    const initialState = useMemo(() => buildState(initialData), [initialData]);
    const [tabla1, setTabla1] = useState(initialState.tabla1);
    const [tabla2, setTabla2] = useState(initialState.tabla2);
    const [tabla3, setTabla3] = useState(initialState.tabla3);

    const skipOnChangeRef = useRef(true);
    const idleCallbackRef = useRef(null);

    useEffect(() => {
        skipOnChangeRef.current = true;
        setTabla1(initialState.tabla1);
        setTabla2(initialState.tabla2);
        setTabla3(initialState.tabla3);
    }, [initialState]);

    const totalCaudal = useMemo(() => calcTotalCaudal(tabla1, tabla2, tabla3), [tabla1, tabla2, tabla3]);

    const updateTimeoutRef = useRef(null);

    useEffect(() => {
        if (!onChange) return;
        if (skipOnChangeRef.current) {
            skipOnChangeRef.current = false;
            return;
        }

        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        if (idleCallbackRef.current && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(idleCallbackRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
            const payload = { tabla1, tabla2, tabla3, totalCaudal };

            // Disparar evento para Cisterna y Tanque
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('demanda-diaria-updated', { detail: payload });
                document.dispatchEvent(event);
            }

            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                idleCallbackRef.current = window.requestIdleCallback(() => onChange(payload), { timeout: 500 });
            } else {
                onChange(payload);
            }
        }, 200);

        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            if (idleCallbackRef.current && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
                window.cancelIdleCallback(idleCallbackRef.current);
            }
        };
    }, [tabla1, tabla2, tabla3, totalCaudal, onChange]);

    const tablePersonalAdminRef = useRef(null);
    const tablePlantaGeneralRef = useRef(null);
    const tablesPisosRef = useRef([]);
    const tableReadyRef = useRef({
        personal: false,
        planta: false,
        pisos: [],
    });
    const pendingDataRef = useRef({
        personal: null,
        planta: null,
        pisos: [],
    });

    const generateId = (prefix = 'item') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const applyEditToRows = (rows, rowId, field, value) =>
        rows.map((row) => {
            if (row.id !== rowId) return row;
            const updated = { ...row, [field]: value };
            return { ...updated, caudal: calcCaudal(updated) };
        });

    const handleCellEdit = useCallback((cell) => {
        const field = cell.getField();
        const rowData = cell.getRow().getData();
        const rowId = rowData.id;
        const newValue = cell.getValue();

        let handled = false;

        setTabla1((prev) => {
            if (!prev.some((item) => item.id === rowId)) return prev;
            handled = true;
            return applyEditToRows(prev, rowId, field, newValue);
        });

        if (handled) return;

        setTabla3((prev) => {
            if (!prev.some((item) => item.id === rowId)) return prev;
            handled = true;
            return applyEditToRows(prev, rowId, field, newValue);
        });

        if (handled) return;

        setTabla2((prev) =>
            prev.map((piso) => {
                if (!piso.modulos.some((mod) => mod.id === rowId)) return piso;
                return {
                    ...piso,
                    modulos: applyEditToRows(piso.modulos, rowId, field, newValue),
                };
            }),
        );
    }, []);

    const handleDeleteRow = useCallback((cell) => {
        const rowId = cell.getRow().getData().id;

        setTabla1((prev) => prev.filter((item) => item.id !== rowId));
        setTabla3((prev) => prev.filter((item) => item.id !== rowId));
        setTabla2((prev) => prev.map((piso) => ({ ...piso, modulos: piso.modulos.filter((m) => m.id !== rowId) })));
    }, []);

    const getColumns = useCallback(() => {
        const baseColumns = [
            {
                title: 'AMBIENTE',
                field: 'ambiente',
                editor: mode === 'edit' ? 'input' : false,
                headerSort: false,
                cssClass: 'text-left',
                cellEdited: mode === 'edit' ? handleCellEdit : undefined,
            },
            {
                title: 'USO',
                field: 'uso',
                editor: mode === 'edit' ? 'list' : false,
                editorParams:
                    mode === 'edit'
                        ? {
                            values: USO_OPTIONS.reduce((acc, item) => {
                                acc[item.label] = item.label;
                                return acc;
                            }, {}),
                            autocomplete: true,
                            listOnEmpty: true,
                            freetext: true,
                        }
                        : {},
                headerSort: false,
                cssClass: 'text-center',
                cellEdited: mode === 'edit' ? handleCellEdit : undefined,
            },
            {
                title: 'CANTIDAD',
                field: 'cantidad',
                editor: mode === 'edit' ? 'number' : false,
                headerSort: false,
                cssClass: 'text-center',
                formatter: (cell) => `${toNumber(cell.getValue()).toFixed(2)} m2`,
                cellEdited: mode === 'edit' ? handleCellEdit : undefined,
            },
            {
                title: 'DOTACION',
                field: 'dotacion',
                editor: mode === 'edit' ? 'list' : false,
                editorParams:
                    mode === 'edit'
                        ? {
                            values: DOTACION_OPTIONS.reduce((acc, item) => {
                                acc[item.label] = item.label;
                                return acc;
                            }, {}),
                            autocomplete: true,
                            listOnEmpty: true,
                        }
                        : {},
                headerSort: false,
                cssClass: 'text-center',
                cellEdited: mode === 'edit' ? handleCellEdit : undefined,
            },
            {
                title: 'CAUDAL',
                field: 'caudal',
                headerSort: false,
                cssClass: 'text-center font-semibold text-blue-600',
                formatter: (cell) => `${toNumber(cell.getValue()).toFixed(2)} Lt/dia`,
            },
        ];

        if (mode === 'edit') {
            baseColumns.push({
                title: 'ACCIONES',
                field: 'actions',
                headerSort: false,
                cssClass: 'text-center',
                width: 90,
                formatter: () =>
                    '<button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" title="Eliminar">Eliminar</button>',
                cellClick: (e, cell) => {
                    e.stopPropagation();
                    if (e.target.closest('.delete-btn')) {
                        handleDeleteRow(cell);
                    }
                },
            });
        }

        return baseColumns;
    }, [mode, handleCellEdit, handleDeleteRow]);

    const columns = useMemo(() => getColumns(), [getColumns]);

    const safeReplaceData = useCallback((table, data) => {
        if (!table) return;
        try {
            const promise = table.replaceData(data);
            if (promise && typeof promise.catch === 'function') {
                promise.catch(() => { });
            }
        } catch (_) {
            // Table may have been destroyed between render cycles.
        }
    }, []);

    const createTable = useCallback((elementId, data, onBuilt) => {
        const el = document.getElementById(elementId);
        if (!el) return null;

        let table = null;
        table = new Tabulator(el, {
            data,
            layout: 'fitColumns',
            responsiveLayout: 'hide',
            pagination: false,
            columns,
            headerSort: false,
            virtualDom: true,
            persistence: false,
            tableBuilt: () => onBuilt?.(table),
        });
        return table;
    }, [columns]);

    // Rebuild fixed tables only when configuration changes
    useEffect(() => {
        tableReadyRef.current.personal = false;
        tableReadyRef.current.planta = false;
        tablePersonalAdminRef.current?.destroy();
        tablePlantaGeneralRef.current?.destroy();

        tablePersonalAdminRef.current = createTable('table-personal-administrativo', tabla1, (table) => {
            if (table !== tablePersonalAdminRef.current) return;
            tableReadyRef.current.personal = true;
            if (pendingDataRef.current.personal) {
                safeReplaceData(table, pendingDataRef.current.personal);
                pendingDataRef.current.personal = null;
            }
        });
        tablePlantaGeneralRef.current = createTable('table-planta-general', tabla3, (table) => {
            if (table !== tablePlantaGeneralRef.current) return;
            tableReadyRef.current.planta = true;
            if (pendingDataRef.current.planta) {
                safeReplaceData(table, pendingDataRef.current.planta);
                pendingDataRef.current.planta = null;
            }
        });

        return () => {
            tableReadyRef.current.personal = false;
            tableReadyRef.current.planta = false;
            tablePersonalAdminRef.current?.destroy();
            tablePlantaGeneralRef.current?.destroy();
            tablePersonalAdminRef.current = null;
            tablePlantaGeneralRef.current = null;
        };
    }, [createTable, safeReplaceData]);

    // Update fixed table data without destroying instances
    useEffect(() => {
        if (tableReadyRef.current.personal && tablePersonalAdminRef.current) {
            safeReplaceData(tablePersonalAdminRef.current, tabla1);
            return;
        }
        pendingDataRef.current.personal = tabla1;
    }, [tabla1, safeReplaceData]);

    useEffect(() => {
        if (tableReadyRef.current.planta && tablePlantaGeneralRef.current) {
            safeReplaceData(tablePlantaGeneralRef.current, tabla3);
            return;
        }
        pendingDataRef.current.planta = tabla3;
    }, [tabla3, safeReplaceData]);

    // Rebuild piso tables only when count or config changes
    useEffect(() => {
        tableReadyRef.current.pisos = [];
        pendingDataRef.current.pisos = [];
        tablesPisosRef.current.forEach((table) => table?.destroy());
        tablesPisosRef.current = [];

        tabla2.forEach((piso, pisoIndex) => {
            tablesPisosRef.current[pisoIndex] = createTable(`table-piso-${pisoIndex}`, piso.modulos, (table) => {
                if (table !== tablesPisosRef.current[pisoIndex]) return;
                tableReadyRef.current.pisos[pisoIndex] = true;
                if (pendingDataRef.current.pisos[pisoIndex]) {
                    safeReplaceData(table, pendingDataRef.current.pisos[pisoIndex]);
                    pendingDataRef.current.pisos[pisoIndex] = null;
                }
            });
        });

        return () => {
            tableReadyRef.current.pisos = [];
            tablesPisosRef.current.forEach((table) => table?.destroy());
            tablesPisosRef.current = [];
        };
    }, [createTable, tabla2.length, safeReplaceData]);

    // Update piso data without recreating tables
    useEffect(() => {
        tabla2.forEach((piso, pisoIndex) => {
            const table = tablesPisosRef.current[pisoIndex];
            if (tableReadyRef.current.pisos[pisoIndex] && table) {
                safeReplaceData(table, piso.modulos);
                return;
            }
            pendingDataRef.current.pisos[pisoIndex] = piso.modulos;
        });
    }, [tabla2, safeReplaceData]);

    const addRowTabla1 = () => {
        const row = normalizeRow(
            { id: generateId('tabla1'), ambiente: 'Nuevo Ambiente', uso: 'Nuevo Uso', cantidad: 0, dotacion: '50.00 Lt x per / dia' },
            '50.00 Lt x per / dia',
            'tabla1',
        );
        setTabla1((prev) => [...prev, row]);
    };

    const addPiso = () => {
        const pisoIndex = tabla2.length;
        const firstModulo = normalizeRow(
            { id: generateId(`piso${pisoIndex}_mod`), ambiente: 'Nuevo Modulo', uso: 'Nuevo Uso', cantidad: 0, dotacion: '0.50 Lt x m2 / dia' },
            '0.50 Lt x m2 / dia',
            `piso${pisoIndex}_mod`,
        );

        setTabla2((prev) => [...prev, { id: generateId('piso'), modulos: [firstModulo] }]);
    };

    const removePiso = (pisoIndex) => {
        setTabla2((prev) => prev.filter((_, index) => index !== pisoIndex));
    };

    const addModulo = (pisoIndex) => {
        const modulo = normalizeRow(
            { id: generateId(`piso${pisoIndex}_mod`), ambiente: 'Nuevo Modulo', uso: 'Nuevo Uso', cantidad: 0, dotacion: '0.50 Lt x m2 / dia' },
            '0.50 Lt x m2 / dia',
            `piso${pisoIndex}_mod`,
        );

        setTabla2((prev) =>
            prev.map((piso, index) => (index === pisoIndex ? { ...piso, modulos: [...piso.modulos, modulo] } : piso)),
        );
    };

    const addRowTabla3 = () => {
        const row = normalizeRow(
            { id: generateId('tabla3'), ambiente: 'Nuevo Ambiente', uso: 'Nuevo Uso', cantidad: 0, dotacion: '2.00 Lt x m2 / dia' },
            '2.00 Lt x m2 / dia',
            'tabla3',
        );
        setTabla3((prev) => [...prev, row]);
    };

    return (
        <div className="w-full p-4">
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 rounded-2xl shadow-lg sticky top-1 z-50">
                <div className="w-full mx-auto px-2 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
                                <i className="fas fa-water text-white text-lg"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">1. CALCULO DE LA DEMANDA DIARIA</h1>
                                <p className="text-sm text-slate-600">Calculo de consumo de agua</p>
                            </div>
                        </div>

                        <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${mode === 'edit' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                                }`}
                        >
                            {mode === 'edit' ? 'Editando' : 'Solo lectura'}
                        </span>
                    </div>
                </div>
            </header>

            <main className="w-full px-2 py-4 space-y-2">
                <section className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <i className="fas fa-users mr-2"></i>
                            ALUMNOS Y PERSONAL ADMINISTRATIVO
                        </h2>
                    </div>
                    <div className="p-2">
                        <div id="table-personal-administrativo" className="border border-slate-200 rounded-lg overflow-hidden"></div>
                        {mode === 'edit' && (
                            <button
                                onClick={addRowTabla1}
                                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
                            >
                                <i className="fas fa-plus mr-2"></i>
                                Agregar Fila
                            </button>
                        )}
                    </div>
                </section>

                <section className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <i className="fas fa-building mr-2"></i>
                            MODULOS PROYECTADOS EN ARQUITECTURA
                        </h2>
                    </div>
                    <div className="p-2">
                        {mode === 'edit' && (
                            <div className="mb-4 flex justify-between items-center">
                                <button
                                    onClick={addPiso}
                                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
                                >
                                    <i className="fas fa-plus mr-2"></i>
                                    Agregar Piso
                                </button>
                            </div>
                        )}

                        {tabla2.map((piso, pisoIndex) => (
                            <div key={piso.id} className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                                <div className="flex justify-between items-center mb-4">
                                    <h5 className="font-semibold text-slate-700 flex items-center">
                                        <i className="fas fa-layer-group mr-2 text-green-600"></i>
                                        PISO {pisoIndex + 1}
                                    </h5>
                                    {mode === 'edit' && (
                                        <button
                                            onClick={() => removePiso(pisoIndex)}
                                            className="text-red-500 hover:text-red-700 px-3 py-1 rounded transition-colors duration-200 flex items-center"
                                        >
                                            <i className="fas fa-trash mr-1"></i>
                                            Eliminar Piso
                                        </button>
                                    )}
                                </div>

                                <div id={`table-piso-${pisoIndex}`} className="border border-slate-200 rounded-lg overflow-hidden mb-4"></div>

                                {mode === 'edit' && (
                                    <button
                                        onClick={() => addModulo(pisoIndex)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
                                    >
                                        <i className="fas fa-plus mr-2"></i>
                                        Agregar Ambiente
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <i className="fas fa-map mr-2"></i>
                            PLANTA GENERAL PROYECTADA EN ARQUITECTURA
                        </h2>
                    </div>
                    <div className="p-2">
                        <div id="table-planta-general" className="border border-slate-200 rounded-lg overflow-hidden"></div>
                        {mode === 'edit' && (
                            <button
                                onClick={addRowTabla3}
                                className="mt-4 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
                            >
                                <i className="fas fa-plus mr-2"></i>
                                Agregar Fila
                            </button>
                        )}
                    </div>
                </section>

                <section className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-medium mb-2 flex items-center">
                                <i className="fas fa-tint mr-2"></i>
                                VOLUMEN DE DEMANDA DIARIA
                            </div>
                            <div className="text-4xl font-bold">{totalCaudal.toFixed(2)} Lt/dia</div>
                        </div>
                        <div className="text-6xl opacity-20">
                            <i className="fas fa-water"></i>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default DemandaDiaria;
