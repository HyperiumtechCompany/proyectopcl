import { useMemo, useState } from 'react';
import { calculateElectricalNetwork } from '../domain/calculations';
import { canConnect, validateElectricalNetwork } from '../domain/graph';
import type {
    ElectricalEdge,
    ElectricalNode,
    ElectricalNetworkSnapshot,
    ModuleElectricalPort,
    Point,
} from '../domain/types';
import { saveElectricalNetwork } from '../lib/networkApi';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';

const id = () => crypto.randomUUID();

export function useElectricalNetwork(
    projectId: number,
    initial: ElectricalNetworkSnapshot,
    ports: ModuleElectricalPort[],
    conductors: ConductorCatalog[],
) {
    const [snapshot, setSnapshot] = useState(initial);
    const [selectedId, setSelectedId] = useState<string>();
    const [connectingFrom, setConnectingFrom] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [message, setMessage] = useState<string>();
    const issues = useMemo(
        () => validateElectricalNetwork(snapshot.data),
        [snapshot.data],
    );
    const calculations = useMemo(
        () => calculateElectricalNetwork(snapshot.data, ports, conductors),
        [snapshot.data, ports, conductors],
    );

    const change = (
        mutate: (
            data: ElectricalNetworkSnapshot['data'],
        ) => ElectricalNetworkSnapshot['data'],
    ) => {
        setSnapshot((current) => ({ ...current, data: mutate(current.data) }));
        setDirty(true);
    };
    const moveNode = (nodeId: string, position: Point) =>
        change((data) => ({
            ...data,
            nodes: data.nodes.map((node) =>
                node.id === nodeId ? { ...node, position } : node,
            ),
        }));
    const updateNode = (nodeId: string, patch: Partial<ElectricalNode>) =>
        change((data) => ({
            ...data,
            nodes: data.nodes.map((node) =>
                node.id === nodeId ? { ...node, ...patch } : node,
            ),
        }));
    const changeNodeParent = (nodeId: string, parentId: string) => {
        if (!parentId || parentId === nodeId) return;
        change((data) => {
            const withoutIncoming = {
                ...data,
                edges: data.edges.filter((edge) => edge.targetNodeId !== nodeId),
            };
            if (!canConnect(withoutIncoming, parentId, nodeId)) return data;
            const source = data.nodes.find((node) => node.id === parentId);
            const target = data.nodes.find((node) => node.id === nodeId);
            return {
                ...withoutIncoming,
                edges: [
                    ...withoutIncoming.edges,
                    {
                        id: id(),
                        sourceNodeId: parentId,
                        targetNodeId: nodeId,
                        label: `${source?.label ?? 'Origen'} → ${target?.label ?? 'Destino'}`,
                        lengthMode: 'manual',
                        horizontalLengthM: 0,
                        verticalLengthM: 0,
                        conductorType: 'N2XOH',
                        conductorMaterial: 'copper',
                        sectionMm2: 10,
                        wireConfiguration: '3F+N+T',
                        powerFactor: 0.9,
                    },
                ],
            };
        });
        setMessage('Tablero alimentador actualizado. Completa la longitud del tramo.');
    };
    const connectModuleToTg = (moduleId: number) => {
        const modulePorts = ports.filter((port) => port.moduleId === moduleId);
        if (modulePorts.length === 0) return;
        change((data) => {
            const moduleIndex = [
                ...new Set(ports.map((port) => port.moduleId)),
            ].indexOf(moduleId);
            const nodeIdByPanel = new Map<string, string>();
            let nodes = [...data.nodes];
            modulePorts.forEach((port, index) => {
                const existing = nodes.find(
                    (node) =>
                        node.moduleId === port.moduleId &&
                        node.deviceId === port.panelId,
                );
                const nodeId = existing?.id ?? id();
                nodeIdByPanel.set(port.panelId, nodeId);
                if (existing) {
                    nodes = nodes.map((node) =>
                        node.id === existing.id
                            ? {
                                  ...node,
                                  label: port.panelLabel,
                                  moduleName: port.moduleName,
                                  sceneName: port.sceneName,
                                  panelRole: port.panelRole,
                              }
                            : node,
                    );
                } else {
                    const depth = port.parentPanelId ? 1 : 0;
                    nodes.push({
                        id: nodeId,
                        type: 'module_panel_port',
                        label: port.panelLabel,
                        moduleId: port.moduleId,
                        moduleName: port.moduleName,
                        sceneId: port.sceneId,
                        sceneName: port.sceneName,
                        deviceId: port.panelId,
                        panelRole: port.panelRole,
                        position: {
                            x: 820 + depth * 240,
                            y: 100 + moduleIndex * 230 + index * 105,
                        },
                    });
                }
            });

            const tg = nodes.find((node) => node.type === 'main_panel');
            if (!tg) return { ...data, nodes };
            let edges = [...data.edges];
            const addEdge = (
                sourceNodeId: string,
                targetNodeId: string,
                label: string,
                lengthM = 0,
            ) => {
                const incoming = edges.find(
                    (edge) => edge.targetNodeId === targetNodeId,
                );
                if (incoming?.sourceNodeId === sourceNodeId) return;
                if (incoming) {
                    edges = edges.filter((edge) => edge.id !== incoming.id);
                }
                edges.push({
                    id: id(),
                    sourceNodeId,
                    targetNodeId,
                    label,
                    lengthMode: lengthM > 0 ? 'plan' : 'manual',
                    horizontalLengthM: lengthM,
                    verticalLengthM: 0,
                    conductorType: 'N2XOH',
                    conductorMaterial: 'copper',
                    sectionMm2: 10,
                    wireConfiguration: '3F+N+T',
                    powerFactor: 0.9,
                });
            };

            for (const port of modulePorts) {
                const targetId = nodeIdByPanel.get(port.panelId)!;
                const parentId = port.parentPanelId
                    ? nodeIdByPanel.get(port.parentPanelId)
                    : undefined;
                addEdge(
                    parentId ?? tg.id,
                    targetId,
                    parentId
                        ? `${port.moduleName}: ${port.parentPanelId} → ${port.panelLabel}`
                        : `TG → ${port.moduleName}: ${port.panelLabel}`,
                    parentId ? (port.feederLengthM ?? 0) : 0,
                );
            }

            return {
                ...data,
                nodes,
                edges,
            };
        });
        setMessage(
            `${modulePorts[0].moduleName} importado con ${modulePorts.length} tablero(s). Completa la longitud desde el TG.`,
        );
    };
    const startConnection = (sourceId: string) => {
        setConnectingFrom(sourceId);
        setMessage('Selecciona el puerto de entrada del tablero destino.');
    };
    const finishConnection = (targetId: string) => {
        if (!connectingFrom) {
            setMessage(
                'Primero selecciona el puerto de salida celeste del tablero origen.',
            );
            return;
        }
        const dataWithoutIncoming = {
            ...snapshot.data,
            edges: snapshot.data.edges.filter(
                (edge) => edge.targetNodeId !== targetId,
            ),
        };
        if (canConnect(dataWithoutIncoming, connectingFrom, targetId)) {
            const source = snapshot.data.nodes.find(
                (node) => node.id === connectingFrom,
            );
            const target = snapshot.data.nodes.find(
                (node) => node.id === targetId,
            );
            const edge: ElectricalEdge = {
                id: id(),
                sourceNodeId: connectingFrom,
                targetNodeId: targetId,
                label: `${source?.label ?? 'Origen'} → ${target?.label ?? 'Destino'}`,
                lengthMode: 'manual',
                horizontalLengthM: 0,
                verticalLengthM: 0,
                conductorType: 'N2XOH',
                conductorMaterial: 'copper',
                sectionMm2: 10,
                wireConfiguration: '3F+N+T',
                powerFactor: 0.9,
            };
            change((data) => ({
                ...data,
                edges: [
                    ...data.edges.filter(
                        (candidate) => candidate.targetNodeId !== targetId,
                    ),
                    edge,
                ],
            }));
            setMessage(
                'Conexión actualizada. Define la longitud del alimentador.',
            );
        } else {
            setMessage(
                'Conexión inválida: produciría un ciclo o una referencia incorrecta.',
            );
        }
        setConnectingFrom(undefined);
    };
    const updateEdge = (edgeId: string, patch: Partial<ElectricalEdge>) =>
        change((data) => ({
            ...data,
            edges: data.edges.map((edge) =>
                edge.id === edgeId ? { ...edge, ...patch } : edge,
            ),
        }));
    const removeById = (targetId: string) => {
        change((data) => ({
            ...data,
            nodes: data.nodes.filter(
                (node) =>
                    node.id !== targetId ||
                    ['service', 'meter', 'main_panel'].includes(node.type),
            ),
            edges: data.edges.filter(
                (edge) =>
                    edge.id !== targetId &&
                    edge.sourceNodeId !== targetId &&
                    edge.targetNodeId !== targetId,
            ),
        }));
        setSelectedId(undefined);
    };
    const removeSelected = () => {
        if (selectedId) removeById(selectedId);
    };
    const save = async () => {
        setSaving(true);
        setMessage(undefined);
        try {
            const saved = await saveElectricalNetwork(projectId, snapshot);
            setSnapshot(saved);
            setDirty(false);
            setMessage('Red guardada correctamente.');
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'No se pudo guardar.',
            );
        } finally {
            setSaving(false);
        }
    };

    return {
        snapshot,
        ports,
        issues,
        calculations,
        selectedId,
        setSelectedId,
        connectingFrom,
        message,
        saving,
        dirty,
        moveNode,
        updateNode,
        changeNodeParent,
        connectModuleToTg,
        startConnection,
        finishConnection,
        updateEdge,
        removeSelected,
        removeById,
        save,
    };
}
