import { create } from 'zustand';
import { produce } from 'immer';

export interface SupervisionRow {
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
}

interface SupervisionState {
    rows: SupervisionRow[];
    loading: boolean;
    isDirty: boolean;
    
    setRows: (rows: SupervisionRow[]) => void;
    setLoading: (loading: boolean) => void;
    setDirty: (dirty: boolean) => void;
    updateCell: (path: string[], field: keyof SupervisionRow, value: any) => void;
    calculateTree: () => void;
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

    setRows: (rows) => set({ rows, isDirty: false }),
    setLoading: (loading) => set({ loading }),
    setDirty: (isDirty) => set({ isDirty }),

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
                        return row.total || 0;
                    }
                    let sum = 0;
                    for (const hijo of row.hijos) {
                        hijo.total = calculateSectionTotal(hijo);
                        sum += hijo.total;
                    }
                    row.total = Number(sum.toFixed(2));
                    return row.total;
                };

                // Section I and II
                const totalI = calculateSectionTotal(rows[0]);
                const totalII = calculateSectionTotal(rows[1]);

                // Section III: COSTO DIRECTO = Section I + Section II
                rows[2].total = Number((totalI + totalII).toFixed(2));

                // Section IV: GASTOS GENERALES (Captured/Manual)
                // Keep it as is unless updated

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
    }
}));
