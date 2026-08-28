import { useEffect, useMemo, useState } from 'react';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import { syncFeederLengths } from '../../site/domain/feederSync';
import type { FeederPath } from '../../site/domain/types';
import { calculateElectricalNetwork } from '../domain/calculations';
import { canConnect, validateElectricalNetwork } from '../domain/graph';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
    ElectricalNetworkSnapshot,
    ModuleElectricalPort,
    Point,
} from '../domain/types';
import { saveElectricalNetwork } from '../lib/networkApi';

const id = () => crypto.randomUUID();

export type PanelFeederGeometry = Record<
    string,
    {
        horizontalLengthM: number;
        verticalLengthM: number;
        mountingHeightM: number;
        ceilingRiseM: number;
        x: number;
        y: number;
        sceneId: string;
        floorElevationM: number;
    }
>;

/**
 * Deriva la longitud horizontal/vertical de UN alimentador a partir de la
 * geometría real del módulo (altura de montaje del tablero, elevación de su
 * piso, posición en planta) — misma fórmula para la conexión inicial
 * (`connectModuleToTg`) y para la resincronización reactiva de abajo, para
 * que ambos caminos calculen exactamente lo mismo.
 *
 * `null` = no hay suficiente información todavía (tablero destino sin
 * geometría publicada) — el llamador debe dejar el valor existente tal cual.
 */
export function deriveAutoEdgeLength(
    edge: Pick<ElectricalEdge, 'horizontalLengthM'>,
    source: Pick<ElectricalNode, 'type' | 'deviceId'> | undefined,
    target: Pick<ElectricalNode, 'deviceId'> | undefined,
    panelFeederGeometry: PanelFeederGeometry,
): Pick<ElectricalEdge, 'lengthMode' | 'horizontalLengthM' | 'verticalLengthM'> | null {
    if (!target?.deviceId) return null;
    const geometry = panelFeederGeometry[target.deviceId];
    if (source?.type === 'main_panel') {
        // El cableado del TG a un TD va por tierra (horizontal) y sube por
        // el tablero (vertical = elevación del piso + altura de montaje):
        // el usuario define la distancia horizontal total (200 m por
        // defecto) y el resto es la subida real al tablero.
        const verticalLengthM =
            (geometry?.floorElevationM ?? 0) + (geometry?.mountingHeightM ?? 1.9);
        return {
            lengthMode: 'combined',
            horizontalLengthM: Math.max(0, 200 - verticalLengthM),
            verticalLengthM,
        };
    }
    if (!geometry) return null;
    const sourceGeometry = source?.deviceId
        ? panelFeederGeometry[source.deviceId]
        : undefined;
    const crossesLevels =
        sourceGeometry !== undefined && sourceGeometry.sceneId !== geometry.sceneId;
    const verticalLengthM = crossesLevels
        ? // Sube desde la altura de montaje del padre hasta la del hijo,
          // usando la elevación real de cada piso — así un Sub-TD dos pisos
          // más arriba suma la altura completa entre ambos, no un valor fijo.
          Math.abs(
              geometry.floorElevationM +
                  geometry.mountingHeightM -
                  (sourceGeometry.floorElevationM + sourceGeometry.mountingHeightM),
          )
        : (sourceGeometry?.ceilingRiseM ?? 1.6) + geometry.mountingHeightM;
    const horizontalLengthM = crossesLevels
        ? Math.hypot(geometry.x - sourceGeometry.x, geometry.y - sourceGeometry.y)
        : geometry.horizontalLengthM > 0
          ? geometry.horizontalLengthM
          : edge.horizontalLengthM;
    return { lengthMode: 'plan', horizontalLengthM, verticalLengthM };
}

export function useElectricalNetwork(
    projectId: number,
    initial: ElectricalNetworkSnapshot,
    ports: ModuleElectricalPort[],
    conductors: ConductorCatalog[],
    panelFeederGeometry: PanelFeederGeometry = {},
    feederPaths: FeederPath[] = [],
) {
    const [snapshot, setSnapshot] = useState(initial);
    const [selectedId, setSelectedId] = useState<string>();
    const [connectingFrom, setConnectingFrom] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [message, setMessage] = useState<string>();
    // Resincroniza las longitudes AUTOMÁTICAS (`lengthMode !== 'manual'`)
    // cada vez que cambia la geometría real de los módulos — altura de
    // montaje, elevación de piso, posición del tablero — no solo al montar
    // el editor. Antes este cálculo vivía dentro del inicializador de
    // `useState` (solo corría UNA vez, al primer render): si el usuario
    // corregía la altura de un tablero en su propio módulo y volvía al
    // módulo general, el alimentador se quedaba con la longitud vieja hasta
    // desconectar y reconectar el módulo a mano. Una longitud manual positiva
    // nunca se toca; los enlaces antiguos guardados como manuales en 0 m sí se
    // reparan automáticamente cuando ya existe geometría suficiente.
    useEffect(() => {
        const nodesById = new Map(
            snapshot.data.nodes.map((node) => [node.id, node]),
        );
        let changed = false;
        let edges = snapshot.data.edges.map((edge) => {
            // Un edge con trazado en el emplazamiento (`site/domain/feederSync`)
            // se sincroniza más abajo, con la longitud real de la polilínea —
            // no con la geometría del módulo.
            if (edge.lengthMode === 'site') return edge;
            if (
                edge.lengthMode === 'manual' &&
                edge.horizontalLengthM + edge.verticalLengthM > 0
            ) {
                return edge;
            }
            const derived = deriveAutoEdgeLength(
                edge,
                nodesById.get(edge.sourceNodeId),
                nodesById.get(edge.targetNodeId),
                panelFeederGeometry,
            );
            if (!derived) return edge;
            const sameLength =
                edge.lengthMode === derived.lengthMode &&
                Math.abs(edge.horizontalLengthM - derived.horizontalLengthM) <
                    1e-6 &&
                Math.abs(edge.verticalLengthM - derived.verticalLengthM) < 1e-6;
            if (sameLength) return edge;
            changed = true;
            return { ...edge, ...derived };
        });
        // Si un alimentador tiene un trazado vinculado en el emplazamiento,
        // ese trazado manda sobre cualquier otro modo (incluso si acaba de
        // vincularse recién: pasa a 'site' aquí mismo).
        const synced = syncFeederLengths(edges, feederPaths);
        if (synced.some((edge, index) => edge !== edges[index])) {
            edges = synced;
            changed = true;
        }
        if (!changed) return;
        setSnapshot((current) => ({ ...current, data: { ...current.data, edges } }));
        setDirty(true);
        // Deps: `panelFeederGeometry` cambia cuando la geometría real de un
        // módulo cambia (altura de montaje, elevación de piso); `feederPaths`
        // cambia cuando el usuario dibuja/edita un trazado en el emplazamiento;
        // el largo de `edges` cambia cuando se conecta/desconecta un tablero
        // (p.ej. `connectModuleToTg`, cuyo cálculo inicial de longitud puede
        // quedar corto — este efecto lo corrige de inmediato con la MISMA
        // fórmula canónica). No se agrega `snapshot` completo para no
        // reejecutar esto en cada edición manual del usuario.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panelFeederGeometry, feederPaths, snapshot.data.edges.length]);
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
        if (parentId === nodeId) return;
        if (!parentId) {
            change((data) => ({
                ...data,
                edges: data.edges.filter(
                    (edge) => edge.targetNodeId !== nodeId,
                ),
            }));
            setMessage(
                'Tablero desconectado. Puedes conectarlo desde el TG u otro tablero del mismo módulo.',
            );
            return;
        }
        change((data) => {
            const withoutIncoming = {
                ...data,
                edges: data.edges.filter(
                    (edge) => edge.targetNodeId !== nodeId,
                ),
            };
            if (!canConnect(withoutIncoming, parentId, nodeId)) return data;
            const source = data.nodes.find((node) => node.id === parentId);
            const target = data.nodes.find((node) => node.id === nodeId);
            const derived = deriveAutoEdgeLength(
                { horizontalLengthM: 0 },
                source,
                target,
                panelFeederGeometry,
            );
            return {
                ...withoutIncoming,
                edges: [
                    ...withoutIncoming.edges,
                    {
                        id: id(),
                        sourceNodeId: parentId,
                        targetNodeId: nodeId,
                        label: `${source?.label ?? 'Origen'} → ${target?.label ?? 'Destino'}`,
                        lengthMode: derived?.lengthMode ?? 'manual',
                        horizontalLengthM: derived?.horizontalLengthM ?? 0,
                        verticalLengthM: derived?.verticalLengthM ?? 0,
                        conductorType: 'N2XOH',
                        conductorMaterial: 'copper',
                        sectionMm2: 10,
                        wireConfiguration: '3F+N+T',
                        powerFactor: 0.9,
                    },
                ],
            };
        });
        setMessage('Tablero alimentador actualizado. Longitud recalculada.');
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
                geometry = { horizontalLengthM: 0, verticalLengthM: 0 },
            ) => {
                const incoming = edges.find(
                    (edge) => edge.targetNodeId === targetNodeId,
                );
                if (incoming?.sourceNodeId === sourceNodeId) {
                    if (
                        geometry.horizontalLengthM + geometry.verticalLengthM >
                            0 &&
                        incoming.horizontalLengthM + incoming.verticalLengthM <=
                            0
                    ) {
                        edges = edges.map((edge) =>
                            edge.id === incoming.id
                                ? {
                                      ...edge,
                                      horizontalLengthM:
                                          geometry.horizontalLengthM,
                                      verticalLengthM: geometry.verticalLengthM,
                                      lengthMode: 'plan',
                                  }
                                : edge,
                        );
                    }
                    return;
                }
                if (incoming) {
                    edges = edges.filter((edge) => edge.id !== incoming.id);
                }
                edges.push({
                    id: id(),
                    sourceNodeId,
                    targetNodeId,
                    label,
                    lengthMode:
                        geometry.horizontalLengthM + geometry.verticalLengthM >
                        0
                            ? 'plan'
                            : 'manual',
                    horizontalLengthM: geometry.horizontalLengthM,
                    verticalLengthM: geometry.verticalLengthM,
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
                const parentPort = port.parentPanelId
                    ? modulePorts.find(
                          (candidate) =>
                              candidate.panelId === port.parentPanelId,
                      )
                    : undefined;
                addEdge(
                    parentId ?? tg.id,
                    targetId,
                    parentId
                        ? `${parentPort?.panelLabel ?? 'Tablero'} → ${port.panelLabel}`
                        : `TG → ${port.moduleName}: ${port.panelLabel}`,
                    deriveAutoEdgeLength(
                        { horizontalLengthM: port.feederLengthM ?? 0 },
                        parentId
                            ? nodes.find((node) => node.id === parentId)
                            : tg,
                        nodes.find((node) => node.id === targetId),
                        panelFeederGeometry,
                    ) ?? { horizontalLengthM: 0, verticalLengthM: 0 },
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
    const cancelConnection = () => {
        setConnectingFrom(undefined);
        setMessage('Conexión cancelada.');
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
            const derived = deriveAutoEdgeLength(
                { horizontalLengthM: 0 },
                source,
                target,
                panelFeederGeometry,
            );
            const edge: ElectricalEdge = {
                id: id(),
                sourceNodeId: connectingFrom,
                targetNodeId: targetId,
                label: `${source?.label ?? 'Origen'} → ${target?.label ?? 'Destino'}`,
                lengthMode: derived?.lengthMode ?? 'manual',
                horizontalLengthM: derived?.horizontalLengthM ?? 0,
                verticalLengthM: derived?.verticalLengthM ?? 0,
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
            setMessage('Conexión actualizada. Longitud recalculada.');
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
    const updateSettings = (
        patch: Partial<ElectricalNetworkData['settings']>,
    ) =>
        change((data) => ({
            ...data,
            settings: { ...data.settings, ...patch },
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
        cancelConnection,
        finishConnection,
        updateEdge,
        updateSettings,
        removeSelected,
        removeById,
        save,
    };
}
