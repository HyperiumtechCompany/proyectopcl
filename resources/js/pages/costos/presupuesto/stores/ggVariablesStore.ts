// stores/ggVariablesStore.ts
import { produce } from 'immer';
import { create } from 'zustand';
import { useProjectParamsStore } from './projectParamsStore';
import { useRemuneracionesStore } from './remuneracionesStore';

export type TipoFilaVariable = 'seccion' | 'grupo' | 'detalle';

export interface GGVariableNode {
    id?: number;
    presupuesto_id?: number;
    parent_id?: number | null;
    tipo_fila: TipoFilaVariable;
    item_codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_descripcion: number;
    cantidad_tiempo: number;
    participacion: number;   // 0-100
    precio: number;
    parcial: number;         // cant_desc × cant_tiempo × (part/100) × precio (calculated)
    item_order: number;
    // UI helpers
    _level?: number;
    _expanded?: boolean;
    _fromRemuneraciones?: boolean; // marks rows imported from remuneraciones
    // Para vínculo con remuneraciones
    _remuneracion_id?: number;     // ID de la remuneración fuente
}

interface GGVariablesState {
    nodes: GGVariableNode[];
    loading: boolean;
    isDirty: boolean;
    lastRemuneracionesHash?: string; // Para detectar cambios en remuneraciones

    setNodes: (nodes: GGVariableNode[]) => void;
    setLoading: (loading: boolean) => void;
    setDirty: (dirty: boolean) => void;
    updateNode: (index: number, field: keyof GGVariableNode, value: any) => void;
    addNode: (afterIndex: number | null, tipo_fila?: TipoFilaVariable, parentId?: number | null) => void;
    removeNode: (index: number) => void;
    getTotal: () => number;
    getSectionTotals: () => Record<string, number>;
    syncFromRemuneraciones: (remuneracionesRows: any[], duracionMeses: number) => void;
    checkAndSyncRemuneraciones: () => boolean;
    applyTemplate: (templateNodes: Partial<GGVariableNode>[]) => void;
    recalculateBenefits: () => void;
    addPersonalWithBenefits: (afterIndex: number) => void;
}

function calcParcial(node: GGVariableNode): number {
    if (node.tipo_fila !== 'detalle') return 0;
    return (
        Number(node.cantidad_descripcion || 0) *
        Number(node.cantidad_tiempo || 0) *
        (Number(node.participacion || 0) / 100) *
        Number(node.precio || 0)
    );
}

// Genera un hash simple para detectar cambios en las remuneraciones
function generateRemuneracionesHash(rows: any[]): string {
    return rows.map(r => `${r.cargo}-${r.sueldo_basico}-${r.total_mensual_unitario}-${r.cantidad}-${r.meses}-${r.participacion}`).join('|');
}

export const useGGVariablesStore = create<GGVariablesState>((set, get) => ({
    nodes: [],
    loading: false,
    isDirty: false,

    setNodes: (nodes) => {
        const enriched = nodes.map(n => {
            let level = 0;
            if (n.tipo_fila === 'seccion') level = 0;
            else if (n.tipo_fila === 'grupo') level = 1;
            else level = 2;
            return { ...n, _level: level, _expanded: true, parcial: calcParcial(n) };
        });
        set({ nodes: enriched, isDirty: false });
    },
    setLoading: (loading) => set({ loading }),
    setDirty: (isDirty) => set({ isDirty }),

    updateNode: (index, field, value) => {
        set(produce((state: GGVariablesState) => {
            const node = state.nodes[index];
            if (!node) return;
            (node as any)[field] = value;
            const calcFields = ['cantidad_descripcion', 'cantidad_tiempo', 'participacion', 'precio'];
            if (calcFields.includes(field as string)) {
                node.parcial = calcParcial(node);
                
                // Si cambiamos precio o cantidad en una fila que parece un sueldo, 
                // recalculamos los beneficios sociales automáticamente
                if (node.descripcion.toLowerCase().startsWith('-')) {
                    const group = state.nodes.find(n => n.id === node.parent_id);
                    if (group?.descripcion.toLowerCase().includes('sueldo')) {
                        // Usar setTimeout para no bloquear el render actual si es necesario, 
                        // o simplemente invocar el cálculo. Como estamos en produce, podemos hacerlo aquí.
                        get().recalculateBenefits(); 
                    }
                }
            }
            state.isDirty = true;
        }));
    },

    addNode: (afterIndex, tipo_fila = 'detalle', parentId = null) => {
        set(produce((state: GGVariablesState) => {
            const newNode: GGVariableNode = {
                parent_id: parentId,
                tipo_fila,
                item_codigo: '',
                descripcion: tipo_fila === 'seccion' ? 'Nueva Sección' : tipo_fila === 'grupo' ? 'Nuevo Grupo' : 'Nuevo Ítem',
                unidad: tipo_fila === 'detalle' ? 'mes' : '',
                cantidad_descripcion: tipo_fila === 'detalle' ? 1 : 0,
                cantidad_tiempo: tipo_fila === 'detalle' ? 1 : 0,
                participacion: 100,
                precio: 0,
                parcial: 0,
                item_order: afterIndex !== null ? afterIndex + 1 : state.nodes.length,
                _level: tipo_fila === 'seccion' ? 0 : tipo_fila === 'grupo' ? 1 : 2,
                _expanded: true,
            };
            const insertAt = afterIndex !== null ? afterIndex + 1 : state.nodes.length;
            state.nodes.splice(insertAt, 0, newNode);
            state.nodes.forEach((n, i) => { n.item_order = i; });
            state.isDirty = true;
        }));
    },

    removeNode: (index) => {
        set(produce((state: GGVariablesState) => {
            const node = state.nodes[index];
            if (!node) return;
            const removedId = node.id;
            state.nodes.splice(index, 1);
            if (removedId) {
                state.nodes = state.nodes.filter(n => n.parent_id !== removedId);
            }
            state.nodes.forEach((n, i) => { n.item_order = i; });
            state.isDirty = true;
        }));
    },

    getTotal: () => {
        const { nodes } = get();
        return nodes
            .filter(n => n.tipo_fila === 'detalle')
            .reduce((acc, n) => acc + (Number(n.parcial) || 0), 0);
    },

    getSectionTotals: () => {
        const { nodes } = get();
        const totals: Record<string, number> = {};
        
        // 1. Initialize totals for all sections
        nodes.forEach(node => {
            if (node.tipo_fila === 'seccion' && node.id !== undefined) {
                totals[String(node.id)] = 0;
            }
        });

        // 2. Sum up all detalles
        nodes.forEach(node => {
            if (node.tipo_fila === 'detalle') {
                // Try parent as seccion
                let seccion = nodes.find(n => n.id === node.parent_id && n.tipo_fila === 'seccion');
                
                // If not found, try grandparent as seccion (if parent is grupo)
                if (!seccion) {
                    const grupo = nodes.find(n => n.id === node.parent_id && n.tipo_fila === 'grupo');
                    if (grupo) {
                        seccion = nodes.find(n => n.id === grupo.parent_id && n.tipo_fila === 'seccion');
                    }
                }

                if (seccion?.id !== undefined) {
                    totals[String(seccion.id)] = (totals[String(seccion.id)] || 0) + (Number(node.parcial) || 0);
                }
            }
        });
        return totals;
    },

    // Sincroniza automáticamente desde remuneraciones
    syncFromRemuneraciones: (remuneracionesRows, duracionMeses) => {
        const { nodes: existingNodes } = get();
        
        // 1. Filtramos todo lo que pertenezca a 2.01 o 2.02 (manual o vinculado)
        // para evitar duplicados "arriba la plantilla abajo los datos"
        const remainingNodes = existingNodes.filter(n => {
            const code = n.item_codigo || '';
            const isTargetSection = code.startsWith('2.01') || code.startsWith('2.02') || 
                                   code.startsWith('02.01') || code.startsWith('02.02');
            return !isTargetSection && !n._fromRemuneraciones;
        });
        
        // 2. Generar nodos de remuneraciones (2.01)
        const sectionSueldosId = 999201;
        const groupSueldosId = 9992011;
        
        const sueldoNodes: GGVariableNode[] = remuneracionesRows.map((r, idx) => ({
            tipo_fila: 'detalle',
            item_codigo: `2.01.${(idx + 1).toString().padStart(2, '0')}`,
            descripcion: `- ${r.cargo || 'Personal'}`,
            unidad: 'mes',
            cantidad_descripcion: Number(r.cantidad) || 1,
            cantidad_tiempo: Number(r.meses) || duracionMeses || 1,
            participacion: Number(r.participacion) || 100,
            precio: Number(r.sueldo_basico) || 0, // Usar solo sueldo básico, beneficios van en 2.02
            parcial: (Number(r.sueldo_basico) || 0) * (Number(r.cantidad) || 1) * (Number(r.meses) || duracionMeses || 1) * (Number(r.participacion) || 100) / 100,
            item_order: 0,
            _level: 2,
            _expanded: true,
            _fromRemuneraciones: true,
            _remuneracion_id: (r as any).id || idx,
            parent_id: groupSueldosId
        }));

        // 3. Calcular beneficios sociales (2.02)
        const remStore = useRemuneracionesStore.getState();
        const summary = remStore.getSummary().total; 
        
        const sectionBeneficiosId = 999202;
        const beneficioNodes: GGVariableNode[] = [
            {
                tipo_fila: 'detalle',
                item_codigo: '2.02.01',
                descripcion: '- Asignación Familiar (10% de RMV)',
                unidad: 'Glb',
                cantidad_descripcion: 1,
                cantidad_tiempo: 1,
                participacion: 100,
                precio: summary.af,
                parcial: summary.af,
                _fromRemuneraciones: true,
                parent_id: sectionBeneficiosId,
                _level: 2, _expanded: true, item_order: 0
            },
            {
                tipo_fila: 'detalle',
                item_codigo: '2.02.02',
                descripcion: '- ESSALUD (9% P. Unit. - Aporta el Empleador)',
                unidad: 'Glb',
                cantidad_descripcion: 1,
                cantidad_tiempo: 1,
                participacion: 100,
                precio: summary.essalud,
                parcial: summary.essalud,
                _fromRemuneraciones: true,
                parent_id: sectionBeneficiosId,
                _level: 2, _expanded: true, item_order: 1
            },
            {
                tipo_fila: 'detalle',
                item_codigo: '2.02.03',
                descripcion: '- C.T.S. (8.3333% P. Unit.)',
                unidad: 'Glb',
                cantidad_descripcion: 1,
                cantidad_tiempo: 1,
                participacion: 100,
                precio: summary.cts,
                parcial: summary.cts,
                _fromRemuneraciones: true,
                parent_id: sectionBeneficiosId,
                _level: 2, _expanded: true, item_order: 2
            },
            {
                tipo_fila: 'detalle',
                item_codigo: '2.02.04',
                descripcion: '- Vacaciones (1/12 de (P. Unit.+ Asig. Fam.))',
                unidad: 'Glb',
                cantidad_descripcion: 1,
                cantidad_tiempo: 1,
                participacion: 100,
                precio: summary.vac,
                parcial: summary.vac,
                _fromRemuneraciones: true,
                parent_id: sectionBeneficiosId,
                _level: 2, _expanded: true, item_order: 3
            },
            {
                tipo_fila: 'detalle',
                item_codigo: '2.02.05',
                descripcion: '- Gratificación (1/6 PUnit. x 2)',
                unidad: 'Glb',
                cantidad_descripcion: 1,
                cantidad_tiempo: 1,
                participacion: 100,
                precio: summary.gratif,
                parcial: summary.gratif,
                _fromRemuneraciones: true,
                parent_id: sectionBeneficiosId,
                _level: 2, _expanded: true, item_order: 4
            }
        ];

        // 4. Construir estructura dinámica 2.01 y 2.02
        const dynamicNodes: GGVariableNode[] = [
            {
                id: sectionSueldosId,
                tipo_fila: 'seccion',
                item_codigo: '2.01',
                descripcion: 'GASTOS DE ADMINISTRACIÓN EN OBRA',
                unidad: '',
                cantidad_descripcion: 0,
                cantidad_tiempo: 0,
                participacion: 0,
                precio: 0,
                parcial: 0,
                item_order: 0,
                _level: 0,
                _expanded: true,
                _fromRemuneraciones: true
            },
            {
                id: groupSueldosId,
                tipo_fila: 'grupo',
                item_codigo: '',
                descripcion: 'Sueldos y beneficios',
                parent_id: sectionSueldosId,
                unidad: '',
                cantidad_descripcion: 0,
                cantidad_tiempo: 0,
                participacion: 0,
                precio: 0,
                parcial: 0,
                item_order: 1,
                _level: 1,
                _expanded: true,
                _fromRemuneraciones: true
            },
            ...sueldoNodes,
            {
                id: sectionBeneficiosId,
                tipo_fila: 'seccion',
                item_codigo: '2.02',
                descripcion: 'Pago de Beneficios Sociales',
                unidad: '',
                cantidad_descripcion: 0,
                cantidad_tiempo: 0,
                participacion: 0,
                precio: 0,
                parcial: 0,
                item_order: 2,
                _level: 0,
                _expanded: true,
                _fromRemuneraciones: true
            },
            ...beneficioNodes
        ];

        // 5. Final: Dinámicos (2.01, 2.02) + El resto
        const finalNodes = [...dynamicNodes, ...remainingNodes].map((n, i) => ({
            ...n,
            item_order: i
        }));

        set({
            nodes: finalNodes,
            isDirty: true,
            lastRemuneracionesHash: generateRemuneracionesHash(remuneracionesRows)
        });
    },

    // Verifica si hay cambios en remuneraciones y sincroniza si es necesario
    checkAndSyncRemuneraciones: () => {
        const { lastRemuneracionesHash } = get();
        
        // Obtener las filas actuales del store de remuneraciones
        const remStore = useRemuneracionesStore.getState();
        const currentRows = remStore.rows;
        
        if (currentRows.length === 0) return false;
        
        const currentHash = generateRemuneracionesHash(currentRows);
        
        // Si el hash cambió, sincronizar
        if (currentHash !== lastRemuneracionesHash) {
            // Obtener duración del proyecto desde el store de parámetros
            const projectParamsStore = useProjectParamsStore.getState();
            const duracionMeses = projectParamsStore.getDuracionMeses();
            
            get().syncFromRemuneraciones(currentRows, duracionMeses);
            return true;
        }
        
        return false;
    },

    applyTemplate: (templateNodes) => {
        set(produce((state: GGVariablesState) => {
            const nextId = Math.max(0, ...state.nodes.map(n => n.id || 0)) + 1;
            let currentId = nextId;
            let lastSeccionId: number | null = null;
            let lastGrupoId: number | null = null;

            const newNodes: GGVariableNode[] = templateNodes.map((t, idx) => {
                const id = currentId++;
                let level = 2;
                let parentId: number | null = null;

                if (t.tipo_fila === 'seccion') {
                    level = 0;
                    lastSeccionId = id;
                    lastGrupoId = null;
                } else if (t.tipo_fila === 'grupo') {
                    level = 1;
                    lastGrupoId = id;
                    parentId = lastSeccionId;
                } else {
                    level = 2;
                    parentId = lastGrupoId || lastSeccionId;
                }

                return {
                    id,
                    parent_id: parentId,
                    tipo_fila: t.tipo_fila as TipoFilaVariable,
                    item_codigo: t.item_codigo || '',
                    descripcion: t.descripcion || '',
                    unidad: t.unidad || (t.tipo_fila === 'detalle' ? 'mes' : ''),
                    cantidad_descripcion: t.cantidad_descripcion || 0,
                    cantidad_tiempo: t.cantidad_tiempo || 0,
                    participacion: t.participacion || 100,
                    precio: t.precio || 0,
                    parcial: 0, 
                    item_order: state.nodes.length + idx,
                    _level: level,
                    _expanded: true
                } as GGVariableNode;
            });

            // Calculate partials for all new nodes
            newNodes.forEach(n => { n.parcial = calcParcial(n); });

            state.nodes = [...state.nodes, ...newNodes];
            state.isDirty = true;
        }));
        
        // After applying template, recalculate benefits just in case
        get().recalculateBenefits();
    },

    recalculateBenefits: () => {
        const projectParamsStore = useProjectParamsStore.getState();
        const duracionMeses = projectParamsStore.getDuracionMeses();
        const globalRMV = projectParamsStore.getRmv();

        set(produce((state: GGVariablesState) => {
            // 1. Identificar todos los sueldos (filas detalle en grupos de "Sueldos" o seccion 2.01)
            const sueldosNodes = state.nodes.filter(n => {
                if (n.tipo_fila !== 'detalle') return false;
                const parent = state.nodes.find(p => p.id === n.parent_id);
                // Si no tiene grupo padre, buscamos si está bajo la seccion 2.01 o su descripcion empieza con "-"
                const seccion = state.nodes.find(s => s.tipo_fila === 'seccion' && (s.id === n.parent_id || s.id === parent?.parent_id));
                return parent?.descripcion.toLowerCase().includes('sueldo') || seccion?.item_codigo === '2.01';
            });

            if (sueldosNodes.length === 0) return;

            // 2. Calcular montos base del proyecto (PU * Meses * Cant * Part%)
            // Para beneficios usualmente se usa el PU * meses de cada cargo
            const totalSueldoBasicoProyecto = sueldosNodes.reduce((acc, n) => {
                const factor = (n.participacion || 100) / 100;
                return acc + (n.precio * factor * n.cantidad_descripcion * n.cantidad_tiempo);
            }, 0);

            // Suma de count de personas para AF (ajustado por participacion si es necesario, pero usualmente es por cabeza)
            const totalPersonas = sueldosNodes.reduce((acc, n) => acc + (n.cantidad_descripcion || 1), 0);
            
            // 3. Buscar las filas de beneficios sociales y actualizar
            state.nodes.forEach(node => {
                if (node.tipo_fila !== 'detalle') return;
                
                const desc = node.descripcion.toLowerCase();
                const af_unit = globalRMV * 0.10; // 10% de RMV
                const totalAfProyecto = af_unit * totalPersonas * duracionMeses;

                if (desc.includes('asignación familiar')) {
                    node.precio = totalAfProyecto;
                    node.cantidad_descripcion = 1;
                    node.cantidad_tiempo = 1;
                    node.parcial = node.precio;
                } else if (desc.includes('essalud')) {
                    // ESSALUD 9% del (Sueldo + AF)
                    node.precio = (totalSueldoBasicoProyecto + totalAfProyecto) * 0.09;
                    node.cantidad_descripcion = 1;
                    node.cantidad_tiempo = 1;
                    node.parcial = node.precio;
                } else if (desc.includes('c.t.s')) {
                    // CTS: 8.3333% de (Sueldo + AF + 1/6 gratif)
                    // Para simplificar: (sueldo + af + gratif/6) * 1/12 (aprox 8.33%)
                    const gratifAprox = totalSueldoBasicoProyecto / 6;
                    node.precio = (totalSueldoBasicoProyecto + totalAfProyecto + (gratifAprox * 2 / 6)) * 0.083333;
                    node.cantidad_descripcion = 1;
                    node.cantidad_tiempo = 1;
                    node.parcial = node.precio;
                } else if (desc.includes('vacaciones')) {
                    // 1/12 de (Sueldo + AF)
                    node.precio = (totalSueldoBasicoProyecto + totalAfProyecto) / 12;
                    node.cantidad_descripcion = 1;
                    node.cantidad_tiempo = 1;
                    node.parcial = node.precio;
                } else if (desc.includes('gratificación')) {
                    // 1/6 de Sueldo x 2 (Julio y Diciembre)
                    node.precio = (totalSueldoBasicoProyecto / 6) * 2;
                    node.cantidad_descripcion = 1;
                    node.cantidad_tiempo = 1;
                    node.parcial = node.precio;
                }
            });
        }));
    },

    addPersonalWithBenefits: (afterIndex) => {
        set(produce((state: GGVariablesState) => {
            const nextId = Math.max(0, ...state.nodes.map(n => n.id || 0)) + 1;
            
            const newNode: GGVariableNode = {
                id: nextId,
                parent_id: state.nodes[afterIndex]?.parent_id || null,
                tipo_fila: 'detalle',
                item_codigo: '',
                descripcion: '- Nuevo Personal',
                unidad: 'mes',
                cantidad_descripcion: 1,
                cantidad_tiempo: 6,
                participacion: 100,
                precio: 0,
                parcial: 0,
                item_order: afterIndex + 1,
                _level: 2,
                _expanded: true
            };

            state.nodes.splice(afterIndex + 1, 0, newNode);
            state.nodes.forEach((n, i) => { n.item_order = i; });
            state.isDirty = true;
        }));
    }
}));
