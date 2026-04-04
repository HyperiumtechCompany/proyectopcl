// stores/ggFijosStore.ts
import { produce } from 'immer';
import { create } from 'zustand';

export type TipoFilaFijo = 'seccion' | 'grupo' | 'detalle';

export interface GGFijoNode {
    id?: number;
    presupuesto_id?: number;
    parent_id?: number | null;
    tipo_fila: TipoFilaFijo;
    tipo_calculo: 'manual' | 'fianza_fiel_cumplimiento' | 'fianza_adelanto_efectivo' | 'fianza_adelanto_materiales' | 'poliza_car' | 'poliza_sctr' | 'poliza_essalud_vida' | 'sencico' | 'itf';
    item_codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    costo_unitario: number;
    parcial: number; // cantidad * costo_unitario (calculated)
    item_order: number;
    // UI helpers
    _level?: number;
    _expanded?: boolean;
    _children_count?: number;
}

interface GGFijosState {
    nodes: GGFijoNode[];
    loading: boolean;
    isDirty: boolean;

    setNodes: (nodes: GGFijoNode[]) => void;
    setLoading: (loading: boolean) => void;
    setDirty: (dirty: boolean) => void;
    updateNode: (index: number, field: keyof GGFijoNode, value: any) => void;
    addNode: (afterIndex: number | null, tipo_fila?: TipoFilaFijo, parentId?: number | null) => void;
    removeNode: (index: number) => void;
    applyTemplate: (templateKey: string) => void;
    syncFromGlobals: (projectId: number) => Promise<void>;
    getTotal: () => number;
    getSectionTotals: () => Record<string, number>;
}

import axios from 'axios';
import { GGVARIABLES_TEMPLATES } from '../utils/ggTemplates';

function calcParcial(node: GGFijoNode): number {
    if (node.tipo_fila !== 'detalle') return 0;
    return Number(node.cantidad || 0) * Number(node.costo_unitario || 0);
}

export const useGGFijosStore = create<GGFijosState>((set, get) => ({
    nodes: [],
    loading: false,
    isDirty: false,

    setNodes: (nodes) => {
        // Enrich with _level based on parent_id relationships
        const nodeMap = new Map<number, GGFijoNode>();
        nodes.forEach(n => { if (n.id) nodeMap.set(n.id, n); });

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
        set(produce((state: GGFijosState) => {
            const node = state.nodes[index];
            if (!node) return;
            (node as any)[field] = value;
            if (field === 'cantidad' || field === 'costo_unitario') {
                node.parcial = calcParcial(node);
            }
            state.isDirty = true;
        }));
    },

    addNode: (afterIndex, tipo_fila = 'detalle', parentId = null) => {
        set(produce((state: GGFijosState) => {
            const newNode: GGFijoNode = {
                parent_id: parentId,
                tipo_fila,
                tipo_calculo: 'manual',
                item_codigo: '',
                descripcion: tipo_fila === 'seccion' ? 'Nueva Sección' : tipo_fila === 'grupo' ? 'Nuevo Grupo' : 'Nuevo Ítem',
                unidad: tipo_fila === 'detalle' ? 'glb' : '',
                cantidad: tipo_fila === 'detalle' ? 1 : 0,
                costo_unitario: 0,
                parcial: 0,
                item_order: afterIndex !== null ? afterIndex + 1 : state.nodes.length,
                _level: tipo_fila === 'seccion' ? 0 : tipo_fila === 'grupo' ? 1 : 2,
                _expanded: true,
            };
            const insertAt = afterIndex !== null ? afterIndex + 1 : state.nodes.length;
            state.nodes.splice(insertAt, 0, newNode);
            // Re-order
            state.nodes.forEach((n, i) => { n.item_order = i; });
            state.isDirty = true;
        }));
    },

    removeNode: (index) => {
        set(produce((state: GGFijosState) => {
            const node = state.nodes[index];
            if (!node) return;
            // Remove node and any nodes that reference it as parent
            const removedId = node.id;
            state.nodes.splice(index, 1);
            if (removedId) {
                // Remove children of removed node
                state.nodes = state.nodes.filter(n => n.parent_id !== removedId);
            }
            state.nodes.forEach((n, i) => { n.item_order = i; });
            state.isDirty = true;
        }));
    },

    applyTemplate: (templateKey) => {
        const template = GGVARIABLES_TEMPLATES[templateKey];
        if (!template) return;

        set(produce((state: GGFijosState) => {
            let lastSeccionId: number | null = null;
            let lastGrupoId: number | null = null;
            
            const newNodes = template.nodes.map((t, idx) => {
                const id = 888000 + idx; // Temporary High IDs
                let level = 0;
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
                    tipo_fila: t.tipo_fila,
                    tipo_calculo: t.tipo_calculo || 'manual',
                    item_codigo: t.item_codigo || '',
                    descripcion: t.descripcion || '',
                    unidad: t.unidad || (t.tipo_fila === 'detalle' ? 'glb' : ''),
                    cantidad: t.cantidad || (t.tipo_fila === 'detalle' ? 1 : 0),
                    costo_unitario: t.costo_unitario || 0,
                    parcial: 0, 
                    item_order: state.nodes.length + idx,
                    _level: level,
                    _expanded: true
                } as GGFijoNode;
            });

            newNodes.forEach(n => { n.parcial = calcParcial(n); });
            state.nodes = [...state.nodes, ...newNodes];
            state.isDirty = true;
        }));
    },

    syncFromGlobals: async (projectId) => {
        try {
            const response = await axios.get(`/costos/proyectos/${projectId}/presupuesto/gastos-fijos-global/totals`);
            if (response.data?.success && response.data.totals) {
                const totals = response.data.totals;
                set(produce((state: GGFijosState) => {
                    let changed = false;
                    state.nodes.forEach(node => {
                        if (node.tipo_fila === 'detalle' && node.tipo_calculo !== 'manual') {
                            const newTotal = totals[node.tipo_calculo];
                            if (newTotal !== undefined && node.costo_unitario !== newTotal) {
                                node.costo_unitario = newTotal;
                                node.parcial = calcParcial(node);
                                changed = true;
                            }
                        }
                    });
                    if (changed) state.isDirty = true;
                }));
            }
        } catch (error) {
            console.error('Error syncing GG Fijos from globals:', error);
        }
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
        nodes.forEach(node => {
            if (node.tipo_fila === 'seccion') {
                const sectionId = node.id;
                if (sectionId !== undefined) {
                    totals[String(sectionId)] = 0;
                }
            }
        });
        // Sum parciales of detalles per seccion (via grupo)
        // Simple approach: sum all detalles under each seccion by traversing
        nodes.forEach(node => {
            if (node.tipo_fila === 'detalle') {
                // Find parent grupo, then parent seccion
                const grupo = nodes.find(n => n.id === node.parent_id);
                const seccion = grupo ? nodes.find(n => n.id === grupo.parent_id) : null;
                if (seccion?.id !== undefined) {
                    totals[String(seccion.id)] = (totals[String(seccion.id)] || 0) + (Number(node.parcial) || 0);
                }
            }
        });
        return totals;
    },
}));
