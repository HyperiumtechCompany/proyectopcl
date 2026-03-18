import { create } from 'zustand';
import { produce } from 'immer';
import axios from 'axios';

export interface SupervisionRow {
    id?: number | null;
    item: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    meses: number;
    precio: number;
    subtotal: number;
    total: number;
    tipo: 'seccion' | 'subseccion' | 'partida' | 'calculo' | 'captura';
    hijos?: SupervisionRow[];
    // Campos de base de datos
    item_codigo?: string;
    concepto?: string;
    parent_id?: number | null;
    tipo_fila?: 'etapa' | 'seccion' | 'detalle';
}

// Interfaz para datos de la base de datos
export interface SupervisionDbRow {
    id: number;
    presupuesto_id: number;
    parent_id: number | null;
    tipo_fila: 'etapa' | 'seccion' | 'detalle';
    item_codigo: string;
    concepto: string;
    unidad: string | null;
    cantidad: number;
    meses: number;
    importe: number;
    subtotal: number;
    total_seccion: number;
    item_order: number;
}

interface SupervisionState {
    rows: SupervisionRow[];
    loading: boolean;
    isDirty: boolean;
    projectId: number | null;
    isSaving: boolean;
    
    setRows: (rows: SupervisionRow[]) => void;
    setLoading: (loading: boolean) => void;
    setDirty: (dirty: boolean) => void;
    setProjectId: (projectId: number) => void;
    updateCell: (path: string[], field: keyof SupervisionRow, value: any) => void;
    calculateTree: () => void;
    loadFromDatabase: (projectId: number) => Promise<void>;
    saveToDatabase: () => Promise<boolean>;
    /** Update Section IV total from the Detalle GG modal and recalculate downstream */
    setGastosGeneralesFromDetalle: (total: number) => void;
}

const toNumber = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

// Funciones de mapeo de datos
function mapDbRowsToStoreRows(dbRows: SupervisionDbRow[]): SupervisionRow[] {
    // Crear un mapa para búsquedas rápidas por ID
    const rowMap = new Map<number, SupervisionRow>();
    
    // Primero, crear todas las filas sin hijos
    dbRows.forEach(row => {
        const storeRow: SupervisionRow = {
            id: row.id,
            item: row.item_codigo || '',
            descripcion: row.concepto || '',
            unidad: row.unidad || '',
            cantidad: toNumber(row.cantidad),
            meses: toNumber(row.meses),
            precio: toNumber(row.importe),
            subtotal: toNumber(row.subtotal),
            total: toNumber(row.total_seccion ?? row.subtotal),
            tipo: mapTipoFila(row.tipo_fila),
            item_codigo: row.item_codigo,
            concepto: row.concepto,
            parent_id: row.parent_id,
            tipo_fila: row.tipo_fila,
            hijos: []
        };
        rowMap.set(row.id, storeRow);
    });
    
    // Ahora construir la jerarquía
    const rootRows: SupervisionRow[] = [];
    dbRows.forEach(row => {
        const storeRow = rowMap.get(row.id)!;
        if (row.parent_id && rowMap.has(row.parent_id)) {
            const parent = rowMap.get(row.parent_id)!;
            if (!parent.hijos) parent.hijos = [];
            parent.hijos.push(storeRow);
        } else {
            rootRows.push(storeRow);
        }
    });
    
    // Si hay datos de la base de datos, reorganizar según la estructura de supervisión
    if (rootRows.length > 0) {
        return reorganizeToSupervisionStructure(rootRows);
    }
    
    return initialRows;
}

function mapStoreRowsToDbRows(storeRows: SupervisionRow[]): any[] {
    const dbRows: any[] = [];
    let order = 0;
    
    const traverse = (rows: SupervisionRow[], parentId: number | null) => {
        rows.forEach(row => {
            // Skip calculated and captured rows (sections III-VIII)
            if (row.tipo === 'calculo' || row.tipo === 'captura') {
                // Still traverse children in case they contain detail rows
                if (row.hijos && row.hijos.length > 0) {
                    traverse(row.hijos, parentId);
                }
                return;
            }
            
            const dbRow: any = {
                id: row.id,
                parent_id: parentId,
                tipo_fila: row.tipo_fila || mapStoreTipoToDb(row.tipo),
                item_codigo: row.item_codigo || row.item,
                concepto: row.concepto || row.descripcion,
                unidad: row.unidad || null,
                cantidad: row.cantidad,
                meses: row.meses,
                importe: row.precio,
                item_order: order++
            };
            dbRows.push(dbRow);
            
            if (row.hijos && row.hijos.length > 0) {
                traverse(row.hijos, row.id ?? null);
            }
        });
    };
    
    // Only traverse first two rows (Section I and II - supervision details)
    if (storeRows.length >= 2) {
        traverse([storeRows[0], storeRows[1]], null);
    }
    
    return dbRows;
}

function mapTipoFila(tipo: string): 'seccion' | 'subseccion' | 'partida' | 'calculo' | 'captura' {
    switch (tipo) {
        case 'etapa': return 'seccion';
        case 'seccion': return 'subseccion';
        case 'detalle': return 'partida';
        default: return 'partida';
    }
}

function mapStoreTipoToDb(tipo: string): 'etapa' | 'seccion' | 'detalle' {
    switch (tipo) {
        case 'seccion': return 'etapa';
        case 'subseccion': return 'seccion';
        case 'partida': return 'detalle';
        default: return 'detalle';
    }
}

// Reorganizar los datos de la base de datos a la estructura de supervisión
function reorganizeToSupervisionStructure(rows: SupervisionRow[]): SupervisionRow[] {
    // Buscar las dos etapas principales (I y II)
    const etapaIRows = rows.filter(r => r.item?.startsWith('I'));
    const etapaIIRows = rows.filter(r => r.item?.startsWith('II'));
    
    // Construir la estructura de supervisión
    const sectionI: SupervisionRow = {
        item: 'I',
        descripcion: 'I. ETAPA DE SUPERVISION DE OBRA',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: calculateTotal(etapaIRows),
        tipo: 'seccion',
        hijos: etapaIRows.length > 0 ? etapaIRows : initialRows[0].hijos
    };
    
    const sectionII: SupervisionRow = {
        item: 'II',
        descripcion: 'II. ETAPA RECEPCIÓN Y LIQUIDACION DE OBRA',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: calculateTotal(etapaIIRows),
        tipo: 'seccion',
        hijos: etapaIIRows.length > 0 ? etapaIIRows : initialRows[1].hijos
    };
    
    const costoDirecto = sectionI.total + sectionII.total;
    // Section IV: GASTOS GENERALES - Calculated as 22.8% of Costo Directo (CD)
    const ggPercentage = 0.228; // 22.8%
    const gastosGenerales = Number((costoDirecto * ggPercentage).toFixed(2));
    const utilidad = Number((costoDirecto * 0.05).toFixed(2));
    const total = costoDirecto + gastosGenerales + utilidad;
    const igv = Number((total * 0.18).toFixed(2));
    const totalConIgv = total + igv;
    
    return [
        sectionI,
        sectionII,
        {
            item: 'III',
            descripcion: 'III. COSTO DIRECTO',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: costoDirecto,
            tipo: 'calculo'
        },
        {
            item: 'IV',
            descripcion: 'IV. GASTOS GENERALES',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: gastosGenerales,
            tipo: 'captura'
        },
        {
            item: 'V',
            descripcion: 'V. UTILIDAD (5% CD)',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: utilidad,
            tipo: 'calculo'
        },
        {
            item: 'VI',
            descripcion: 'VI. TOTAL',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: total,
            tipo: 'calculo'
        },
        {
            item: 'VII',
            descripcion: 'VII. IGV (18 %)',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: igv,
            tipo: 'calculo'
        },
        {
            item: 'VIII',
            descripcion: 'VIII. TOTAL',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: totalConIgv,
            tipo: 'calculo'
        },
        {
            item: '%',
            descripcion: 'PORCENTAJE',
            unidad: '',
            cantidad: 0,
            meses: 0,
            precio: 0,
            subtotal: 0,
            total: 0,
            tipo: 'calculo'
        }
    ];
}

function calculateTotal(rows: SupervisionRow[]): number {
    return rows.reduce((sum, row) => {
        if (row.hijos && row.hijos.length > 0) {
            return sum + calculateTotal(row.hijos);
        }
        return sum + (row.total || 0);
    }, 0);
}

// Initial structure based on user request and image
const initialRows: SupervisionRow[] = [
    {
        item: 'I',
        descripcion: 'I. ETAPA DE SUPERVISION DE OBRA',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 183035.94,
        tipo: 'seccion',
        hijos: [
            {
                item: 'A',
                descripcion: 'A. SUELDOS Y SALARIOS (INC. LEYES SOCIALES)',
                unidad: '',
                cantidad: 0,
                meses: 0,
                precio: 0,
                subtotal: 0,
                total: 173050.00,
                tipo: 'subseccion',
                hijos: [
                    {
                        item: 'A.1',
                        descripcion: 'A.1. PERSONAL PROFESIONAL CLAVE PARA LA SUPERVISION DE LA OBRA',
                        unidad: '',
                        cantidad: 0,
                        meses: 0,
                        precio: 0,
                        subtotal: 0,
                        total: 173050.00,
                        tipo: 'subseccion',
                        hijos: [
                            { item: '1', descripcion: 'Ingeniero Supervisor', unidad: 'Mes', cantidad: 1, meses: 6, precio: 13300.00, subtotal: 79800.00, total: 79800.00, tipo: 'partida' },
                            { item: '2', descripcion: 'Especialista en Estructuras', unidad: 'Mes', cantidad: 0.5, meses: 4, precio: 8800.00, subtotal: 17600.00, total: 17600.00, tipo: 'partida' },
                            { item: '3', descripcion: 'Especialista en Arquitectura', unidad: 'Mes', cantidad: 0.5, meses: 3, precio: 8800.00, subtotal: 13200.00, total: 13200.00, tipo: 'partida' },
                            { item: '4', descripcion: 'Especialista Electrico', unidad: 'Mes', cantidad: 0.5, meses: 2, precio: 8800.00, subtotal: 8800.00, total: 8800.00, tipo: 'partida' },
                            { item: '5', descripcion: 'Especialista Sanitario', unidad: 'Mes', cantidad: 0.5, meses: 2, precio: 8800.00, subtotal: 8800.00, total: 8800.00, tipo: 'partida' },
                            { item: '6', descripcion: 'Especialista en Estudio e Impacto Ambiental', unidad: 'Mes', cantidad: 0.25, meses: 6, precio: 8800.00, subtotal: 13200.00, total: 13200.00, tipo: 'partida' },
                            { item: '7', descripcion: 'Especialista Planeamiento y Costos', unidad: 'Mes', cantidad: 0.5, meses: 6, precio: 8800.00, subtotal: 26400.00, total: 26400.00, tipo: 'partida' },
                            { item: '8', descripcion: 'Asistente Administrativo', unidad: 'Mes', cantidad: 0.25, meses: 6, precio: 3500.00, subtotal: 5250.00, total: 5250.00, tipo: 'partida' },
                        ]
                    }
                ]
            },
            {
                item: 'B',
                descripcion: 'B. OFICINAS ADM. DE CAMPO: UTILES DE OFICINA, AMORTIZACIÓN DE EQUIPOS:',
                unidad: '',
                cantidad: 0,
                meses: 0,
                precio: 0,
                subtotal: 0,
                total: 9985.94,
                tipo: 'subseccion',
                hijos: [
                    { item: '1', descripcion: 'Oficinas incl. Mobiliario y utiles de ofic.', unidad: 'mes', cantidad: 1, meses: 6, precio: 497.66, subtotal: 2985.96, total: 2985.96, tipo: 'partida' },
                    { item: '2', descripcion: 'Equipos de Cómputo, fotocopiadoras, etc.', unidad: 'Und', cantidad: 2, meses: 1, precio: 3500.00, subtotal: 7000.00, total: 7000.00, tipo: 'partida' },
                ]
            }
        ]
    },
    {
        item: 'II',
        descripcion: 'II. ETAPA RECEPCIÓN Y LIQUIDACION DE OBRA',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 19950.00,
        tipo: 'seccion',
        hijos: [
            {
                item: 'A',
                descripcion: 'A. SUELDOS Y SALARIOS (INC. LEYES SOCIALES)',
                unidad: '',
                cantidad: 0,
                meses: 0,
                precio: 0,
                subtotal: 0,
                total: 19450.00,
                tipo: 'subseccion',
                hijos: [
                    {
                        item: 'A.1',
                        descripcion: 'A.1. PERSONAL PROFESIONAL CLAVE',
                        unidad: '',
                        cantidad: 0,
                        meses: 0,
                        precio: 0,
                        subtotal: 0,
                        total: 19450.00,
                        tipo: 'subseccion',
                        hijos: [
                            { item: '1', descripcion: 'Ingeniero Supervisor', unidad: 'Mes', cantidad: 1, meses: 1, precio: 13300.00, subtotal: 13300.00, total: 13300.00, tipo: 'partida' },
                            { item: '2', descripcion: 'Especialista Planeamiento y Costos', unidad: 'Mes', cantidad: 0.5, meses: 1, precio: 8800.00, subtotal: 4400.00, total: 4400.00, tipo: 'partida' },
                            { item: '3', descripcion: 'Asistente Administrativo', unidad: 'Mes', cantidad: 0.5, meses: 1, precio: 3500.00, subtotal: 1750.00, total: 1750.00, tipo: 'partida' },
                        ]
                    }
                ]
            },
            {
                item: 'B',
                descripcion: 'B. OFICINAS ADM. DE CAMPO: UTILES DE OFICINA, :',
                unidad: '',
                cantidad: 0,
                meses: 0,
                precio: 0,
                subtotal: 0,
                total: 500.00,
                tipo: 'subseccion',
                hijos: [
                    { item: '1', descripcion: 'Oficinas incl. Mobiliario y utiles de ofic.', unidad: 'mes', cantidad: 1, meses: 1, precio: 500.00, subtotal: 500.00, total: 500.00, tipo: 'partida' },
                ]
            }
        ]
    },
    {
        item: 'III',
        descripcion: 'III. COSTO DIRECTO',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 202985.94,
        tipo: 'calculo',
    },
    {
        item: 'IV',
        descripcion: 'IV. GASTOS GENERALES',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 46263.97,
        tipo: 'captura',
    },
    {
        item: 'V',
        descripcion: 'V. UTILIDAD (5% CD)',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 10149.30,
        tipo: 'calculo',
    },
    {
        item: 'VI',
        descripcion: 'VI. TOTAL',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 259399.21,
        tipo: 'calculo',
    },
    {
        item: 'VII',
        descripcion: 'VII. IGV (18 %)',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 46691.86,
        tipo: 'calculo',
    },
    {
        item: 'VIII',
        descripcion: 'VIII. TOTAL',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 306091.06,
        tipo: 'calculo',
    },
    {
        item: '%',
        descripcion: 'PORCENTAJE',
        unidad: '',
        cantidad: 0,
        meses: 0,
        precio: 0,
        subtotal: 0,
        total: 0,
        tipo: 'calculo',
    }
];

export const useSupervisionStore = create<SupervisionState>((set, get) => ({
    rows: initialRows,
    loading: false,
    isDirty: false,
    projectId: null,
    isSaving: false,

    setRows: (rows) => set({ rows, isDirty: false }),
    setLoading: (loading) => set({ loading }),
    setDirty: (isDirty) => set({ isDirty }),
    setProjectId: (projectId) => set({ projectId }),

    loadFromDatabase: async (projectId: number) => {
        set({ loading: true, projectId });
        try {
            const response = await axios.get(`/costos/proyectos/${projectId}/presupuesto/supervision/data`);
            if (response.data?.success && response.data.rows?.length > 0) {
                // Convertir datos de la base de datos al formato del store
                const dbRows = response.data.rows as SupervisionDbRow[];
                const mappedRows = mapDbRowsToStoreRows(dbRows);
                set({ rows: mappedRows, loading: false, isDirty: false });
            } else {
                // Si no hay datos, usar los datos iniciales
                set({ rows: initialRows, loading: false, isDirty: false });
            }
        } catch (error) {
            console.error('Error loading supervision data:', error);
            set({ rows: initialRows, loading: false, isDirty: false });
        }
    },

    saveToDatabase: async () => {
        const { rows, projectId, isSaving } = get();
        if (!projectId || isSaving) return false;
        
        set({ isSaving: true });
        try {
            // Convertir filas del store al formato de base de datos
            const dbRows = mapStoreRowsToDbRows(rows);
            
            const response = await axios.patch(`/costos/proyectos/${projectId}/presupuesto/supervision`, {
                rows: dbRows
            });
            
            if (response.data?.success) {
                set({ isDirty: false, isSaving: false });
                return true;
            }
            set({ isSaving: false });
            return false;
        } catch (error) {
            console.error('Error saving supervision data:', error);
            set({ isSaving: false });
            return false;
        }
    },

    updateCell: (path, field, value) => {
        set(
            produce((state: SupervisionState) => {
                let current: any = state.rows;
                for (let i = 0; i < path.length; i++) {
                    const idx = current.findIndex((r: any) => r.item === path[i] || r.descripcion === path[i]);
                    if (idx === -1) return;
                    if (i === path.length - 1) {
                        current[idx][field] = value;
                        if (field === 'cantidad' || field === 'meses' || field === 'precio') {
                             current[idx].subtotal = Number(((Number(current[idx].cantidad) || 0) * (Number(current[idx].meses) || 1) * (Number(current[idx].precio) || 0)).toFixed(2));
                             current[idx].total = current[idx].subtotal;
                        }
                    } else {
                        if (!current[idx].hijos) current[idx].hijos = [];
                        current = current[idx].hijos;
                    }
                }
                state.isDirty = true;
            })
        );
        get().calculateTree();
    },

    calculateTree: () => {
        set(
            produce((state: SupervisionState) => {
                const rows = state.rows;

                const calculateSectionTotal = (row: SupervisionRow): number => {
                    if (!row.hijos || row.hijos.length === 0) {
                        return toNumber(row.total);
                    }
                    let sum = 0;
                    for (const hijo of row.hijos) {
                        hijo.total = calculateSectionTotal(hijo);
                        sum += toNumber(hijo.total);
                    }
                    row.total = Number(sum.toFixed(2));
                    return row.total;
                };

                // Section I and II
                const totalI = calculateSectionTotal(rows[0]);
                const totalII = calculateSectionTotal(rows[1]);

                // Section III: COSTO DIRECTO = Section I + Section II
                rows[2].total = Number((totalI + totalII).toFixed(2));

                // Section IV: GASTOS GENERALES — driven by supervision_gg_detalle store;
                // do NOT recalculate here, preserve whatever was set by setGastosGeneralesFromDetalle.

                // Section V: UTILIDAD (5% CD) = ROUND(Section III * 5 / 100, 2)
                rows[4].total = Number((rows[2].total * 0.05).toFixed(2));

                // Section VI: TOTAL = III + IV + V
                rows[5].total = Number((rows[2].total + rows[3].total + rows[4].total).toFixed(2));

                // Section VII: IGV (18%) = VI * 0.18
                rows[6].total = Number((rows[5].total * 0.18).toFixed(2));

                // Section VIII: TOTAL = VI + VII
                rows[7].total = Number((rows[5].total + rows[6].total).toFixed(2));
            })
        );
    },

    setGastosGeneralesFromDetalle: (total: number) => {
        set(
            produce((state: SupervisionState) => {
                const rows = state.rows;
                // Section IV index = 3
                if (rows[3]) {
                    rows[3].total = Number(toNumber(total).toFixed(2));
                }
                // Recalculate downstream
                // Section V: UTILIDAD (5% CD)
                if (rows[4]) rows[4].total = Number((toNumber(rows[2]?.total) * 0.05).toFixed(2));
                // Section VI: TOTAL = III + IV + V
                if (rows[5]) {
                    const totalVI = toNumber(rows[2]?.total) + toNumber(rows[3]?.total) + toNumber(rows[4]?.total);
                    rows[5].total = Number(totalVI.toFixed(2));
                }
                // Section VII: IGV (18%)
                if (rows[6]) rows[6].total = Number((toNumber(rows[5]?.total) * 0.18).toFixed(2));
                // Section VIII: TOTAL = VI + VII
                if (rows[7]) {
                    const totalVIII = toNumber(rows[5]?.total) + toNumber(rows[6]?.total);
                    rows[7].total = Number(totalVIII.toFixed(2));
                }
                state.isDirty = true;
            })
        );
    },
}));
