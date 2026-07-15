import { Grid, Minus, Zap } from 'lucide-react';
import React from 'react';
import {
    deriveAmbientSpaces,
    pointInPolygon,
} from '@/pages/dialux/hooks/ambientSpaces';
import {
    calculateExactQuantity,
    calculateLumensRequired,
    calculateRoundedQuantity,
} from '@/pages/dialux/hooks/lightingCalculations';
import {
    NORMATIVE_LABELS,
    getActivityOptions,
    getCategoryOptions,
    getSectionOptions,
} from '@/pages/dialux/hooks/roomLighting';
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { Room, Scene, Wall } from '@/pages/dialux/hooks/useEditorStore';
import { getWallPresetFromWall } from '@/pages/dialux/hooks/wallNorms';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
    TextField,
} from './PropertyFields';

const WallInteriorLightingSection: React.FC<{
    wall: Wall;
    scene: Scene | null;
    onUpdate: (patch: Partial<Omit<Wall, 'id'>>) => void;
}> = ({ wall, scene, onUpdate }) => {
    const store = useEditorStore();
    const standard = store.defaultRoomNormativeStandard as NormativeStandard;

    const verts = wall.vertices;
    let wallLen = 0;
    for (let i = 1; i < verts.length; i++) {
        wallLen += Math.hypot(verts[i].x - verts[i - 1].x, verts[i].y - verts[i - 1].y);
    }
    const wallArea = wallLen * wall.height;

    const cats = getCategoryOptions(standard);
    const sects = getSectionOptions(standard, wall.normativeCategory);
    const activities = getActivityOptions(standard, wall.normativeCategory, wall.normativeSection);

    const lux = wall.illuminanceLux ?? 300;
    const fixLumens = wall.fixtureLumens ?? 4000;
    const lumensReq = calculateLumensRequired(wallArea, lux);
    const exactQty = calculateExactQuantity(lumensReq, fixLumens);
    const roundedQty = calculateRoundedQuantity(exactQty);

    const mid = React.useMemo(() =>
        verts.length >= 2
            ? { x: (verts[0].x + verts[verts.length - 1].x) / 2, y: (verts[0].y + verts[verts.length - 1].y) / 2 }
            : verts[0],
        [verts]);

    const parentAmbient = React.useMemo(() =>
        scene?.rooms.find(r =>
            (r.roomType === 'ambient' || r.roomType === 'corridor') &&
            pointInPolygon(mid, r.vertices),
        ) ?? null,
        [scene, mid]);

    const fixturesInArea = React.useMemo(() => {
        if (!scene || !parentAmbient) return [];
        return scene.fixtures.filter(f => pointInPolygon({ x: f.x, y: f.y }, parentAmbient.vertices));
    }, [scene, parentAmbient]);

    const wallPolygon = React.useMemo(() => {
        if (verts.length < 2) return null;
        const ax = verts[0].x, ay = verts[0].y;
        const bx = verts[verts.length - 1].x, by = verts[verts.length - 1].y;
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.01) return null;
        const dx = (bx - ax) / len, dy = (by - ay) / len;
        const px = dy, py = -dx;
        const depth = Math.max(wall.thickness * 2, 1.5);
        return [
            { x: ax, y: ay },
            { x: bx, y: by },
            { x: bx + px * depth, y: by + py * depth },
            { x: ax + px * depth, y: ay + py * depth },
        ];
    }, [verts, wall.thickness]);

    const handleGenerate = () => {
        const fixtureTemplate = {
            ...store.ui.fixtureTemplate,
            ...(wall.fixtureType ? { fixtureType: wall.fixtureType } : {}),
            ...(wall.fixtureShape ? { fixtureShape: wall.fixtureShape } : {}),
            ...(wall.fixtureLumens ? { lumens: wall.fixtureLumens } : {}),
        };
        // Generate the grid over the wall's area, and assign it to the parent room if possible.
        // If the wall is within an ambient, we assign it to that ambient's source room.
        const parentRoomId = parentAmbient?.id ?? scene?.rooms.find(r => pointInPolygon(mid, r.vertices))?.id ?? null;

        const newIds = wallPolygon
            ? store.addFixtureGrid({ roomId: parentRoomId, rows: store.ui.fixtureGridRows, columns: store.ui.fixtureGridCols, fixtureTemplate, ambientVertices: wallPolygon })
            : [];
        if (newIds.length > 0) {
            store.setSelectedId(null);
            store.setSelectedFixtureIds(newIds);
        }
    };

    return (
        <div className="mt-3 space-y-2.5 border-t border-gray-700/50 pt-3">
            <div className="flex items-center gap-2">
                <Zap size={12} className="text-yellow-400" />
                <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Iluminación</p>
            </div>

            <PropField label="Estándar" value={NORMATIVE_LABELS[standard]} mono={false} />
            <PropField label="Área pared" value={`${wallArea.toFixed(2)} m²`} />

            <SelectField
                label="Sección / Área"
                value={wall.normativeCategory ?? ''}
                options={cats.map(c => ({ value: c, label: c }))}
                onChange={(val) => onUpdate({ normativeCategory: val, normativeSection: undefined, normativeActivity: undefined })}
            />
            {wall.normativeCategory && (
                <SelectField
                    label="Subsección"
                    value={wall.normativeSection ?? ''}
                    options={sects.map(s => ({ value: s, label: s }))}
                    onChange={(val) => onUpdate({ normativeSection: val, normativeActivity: undefined })}
                />
            )}
            {wall.normativeSection && (
                <SelectField
                    label="Aplicación"
                    value={wall.normativeActivity ?? ''}
                    options={activities.map(a => ({ value: a.activity, label: a.activity }))}
                    onChange={(val) => {
                        const act = activities.find(a => a.activity === val);
                        onUpdate({ normativeActivity: val, illuminanceLux: act?.illuminanceLux ?? lux });
                    }}
                />
            )}

            <EditField label="Iluminancia (lux)" value={lux} min={10} max={2000} step={10}
                onChange={(val) => onUpdate({ illuminanceLux: val })} />

            <div className="flex items-center justify-between">
                <PropField label="Luminarias" value={`${fixturesInArea.length}`} />
                {fixturesInArea.length > 0 && (
                    <button type="button"
                        onClick={() => { store.setSelectedId(null); store.setSelectedFixtureIds(fixturesInArea.map(f => f.id)); }}
                        className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40">
                        Seleccionar
                    </button>
                )}
            </div>
            <PropField label="Lm requeridos" value={`${lumensReq.toFixed(0)} lm`} />
            <PropField label="Cant. óptima" value={exactQty.toFixed(2)} />
            <PropField label="Cant. simetría" value={`${roundedQty}`} />

            <EditField label="Lm/foco" value={fixLumens} min={100} max={50000} step={100}
                onChange={(val) => onUpdate({ fixtureLumens: val })} />
            <SelectField label="Tipo foco"
                value={wall.fixtureType ?? 'recessed'}
                options={[
                    { value: 'recessed', label: 'Empotrada' },
                    { value: 'surface', label: 'Superficie' },
                    { value: 'pendant', label: 'Colgante' },
                    { value: 'spot', label: 'Spot' },
                    { value: 'strip', label: 'Tira LED' },
                    { value: 'panel', label: 'Panel LED' },
                    { value: 'tube', label: 'Tubo' },
                ]}
                onChange={(val) => onUpdate({ fixtureType: val as Wall['fixtureType'] })} />
            <SelectField label="Forma foco"
                value={wall.fixtureShape ?? 'round'}
                options={[
                    { value: 'round', label: 'Redonda' },
                    { value: 'square', label: 'Cuadrada' },
                    { value: 'rectangular', label: 'Rectangular' },
                    { value: 'cylindrical', label: 'Cilíndrica' },
                ]}
                onChange={(val) => onUpdate({ fixtureShape: val as Wall['fixtureShape'] })} />

            <div className="mt-3 border-t border-gray-700/50 pt-2">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                    <Grid size={12} />
                    <p className="text-[10px] font-semibold uppercase">Grilla sobre Pared</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <EditField label="Filas" value={store.ui.fixtureGridRows} min={1} max={20} step={1}
                        onChange={(val) => store.setFixtureGridRows(val)} />
                    <EditField label="Columnas" value={store.ui.fixtureGridCols} min={1} max={20} step={1}
                        onChange={(val) => store.setFixtureGridCols(val)} />
                </div>
                <button type="button" onClick={handleGenerate}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                    <Grid size={11} />
                    Generar en Pared {store.ui.fixtureGridRows}×{store.ui.fixtureGridCols}
                </button>
                <p className="text-[9px] text-gray-500 mt-1 leading-snug">
                    Genera una grilla de focos pegada a la superficie de esta pared (ej. apliques).
                </p>
            </div>
        </div>
    );
};

export const WallProps: React.FC<{
    wall: Wall;
    scene: Scene | null;
    onUpdate: (patch: Partial<Omit<Wall, 'id'>>) => void;
    onUpdateRoom: (roomId: string, patch: Partial<Omit<Room, 'id'>>) => void;
}> = ({ wall, scene, onUpdate, onUpdateRoom }) => {
    const store = useEditorStore();
    const verts = wall.vertices;
    const preset = getWallPresetFromWall(wall);
    const ambientMatch =
        scene?.rooms
            .flatMap((room) =>
                deriveAmbientSpaces(room, scene.walls, scene.fixtures),
            )
            .find((ambient) => ambient.wallId === wall.id) ?? null;
    let len = 0;

    if (verts.length > 1) {
        for (let i = 1; i < verts.length; i++) {
            len += Math.hypot(
                verts[i].x - verts[i - 1].x,
                verts[i].y - verts[i - 1].y,
            );
        }
    }

    const start = verts[0];
    const end = verts[verts.length - 1];

    const handleVertexChange = (
        index: number,
        axis: 'x' | 'y',
        value: number,
    ) => {
        const newVertices = wall.vertices.map((vertex, vertexIndex) =>
            vertexIndex === index ? { ...vertex, [axis]: value } : vertex,
        );
        onUpdate({ vertices: newVertices });
    };

    const updateAmbientConfig = (
        patch: Partial<NonNullable<Room['ambientConfigs']>[string]>,
    ) => {
        if (!ambientMatch) return;

        onUpdateRoom(ambientMatch.sourceRoom.id, {
            ambientConfigs: {
                ...(ambientMatch.sourceRoom.ambientConfigs ?? {}),
                [ambientMatch.configKey]: {
                    ...(ambientMatch.sourceRoom.ambientConfigs?.[
                        ambientMatch.configKey
                    ] ?? {}),
                    ...patch,
                },
            },
        });
    };

    return (
        <SectionWrapper
            icon={<Minus size={12} className="text-slate-400" />}
            label={ambientMatch ? 'Ambiente • Pared' : 'Pared'}
        >
            {/* Tipo de muro: solo lectura (se elige en el Toolbar) */}
            <PropField
                label="Tipo"
                value={
                    wall.wallType === 'cerco'
                        ? 'Cerco perimétrico'
                        : wall.wallType === 'exterior'
                          ? 'Exterior'
                          : 'Interior'
                }
                mono={false}
            />
            <PropField label="Longitud" value={`${len.toFixed(4)} m`} />
            <PropField
                label="Superficie"
                value={`${(len * wall.height).toFixed(4)} m²`}
            />
            <EditField
                label="Espesor (m)"
                value={wall.thickness}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(value) => onUpdate({ thickness: value })}
            />
            <EditField
                label="Alto (m)"
                value={wall.height}
                min={1}
                max={20}
                step={0.1}
                onChange={(value) => onUpdate({ height: value })}
            />
            {wall.wallType === 'cerco' && (
                <EditField
                    label="Esp. postes (m)"
                    value={wall.postSpacing ?? 3.0}
                    min={0.5}
                    max={10}
                    step={0.25}
                    onChange={(value) => onUpdate({ postSpacing: value })}
                />
            )}
            <PropField
                label="Estado"
                value={
                    wall.thickness >= preset.minThickness &&
                    wall.height >= preset.minHeight
                        ? '✅ Cumple'
                        : '⚠️ Revisar mínimos'
                }
                mono={false}
            />

            {/* Sección de ambiente (grilla de focos) */}
            {ambientMatch && (
                <>
                    <div className="my-1 border-t border-gray-700/50 pt-1">
                        <p className="mb-1 text-[10px] font-semibold text-cyan-500">
                            Ambiente: {ambientMatch.name}
                        </p>
                    </div>
                    <TextField
                        label="Nombre"
                        value={
                            ambientMatch.sourceRoom.ambientConfigs?.[
                                ambientMatch.configKey
                            ]?.name ?? ambientMatch.name
                        }
                        onChange={(value) =>
                            updateAmbientConfig({ name: value })
                        }
                    />
                    <PropField
                        label="Área ambiente"
                        value={`${ambientMatch.area.toFixed(4)} m²`}
                    />
                    <div className="flex items-center justify-between">
                        <PropField
                            label="Luminarias"
                            value={`${ambientMatch.fixtures.length}`}
                        />
                        {ambientMatch.fixtures.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(ambientMatch.fixtures.map((f) => f.id));
                                }}
                                className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40"
                            >
                                Seleccionar Todas
                            </button>
                        )}
                    </div>
                    <div className="my-2 space-y-1 border-t border-gray-800/80 pt-2">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <Grid size={12} />
                            <p className="text-[10px] font-semibold uppercase">
                                Grilla de focos
                            </p>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <EditField
                                label="Filas"
                                value={store.ui.fixtureGridRows}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(val) =>
                                    store.setFixtureGridRows(val)
                                }
                            />
                            <EditField
                                label="Columnas"
                                value={store.ui.fixtureGridCols}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(val) =>
                                    store.setFixtureGridCols(val)
                                }
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const newIds = store.addFixtureGrid({
                                    roomId: ambientMatch.sourceRoom.id,
                                    rows: store.ui.fixtureGridRows,
                                    columns: store.ui.fixtureGridCols,
                                    fixtureTemplate: store.ui.fixtureTemplate,
                                    ambientVertices: ambientMatch.room.vertices,
                                });
                                if (newIds.length > 0) {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(newIds);
                                } else {
                                    alert("No se pudo generar la grilla. Asegúrese de que el ambiente esté cerrado y tenga un área válida.");
                                }
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                        >
                            Generar en Techo de Ambiente {store.ui.fixtureGridRows}x{store.ui.fixtureGridCols}
                        </button>
                        <p className="text-[9px] text-gray-500 mt-1 leading-snug">
                            Genera luminarias en el área de techo delimitada por esta pared.
                        </p>
                    </div>
                </>
            )}
            {wall.wallType === 'interior' && (
                <WallInteriorLightingSection
                    wall={wall}
                    scene={scene}
                    onUpdate={onUpdate}
                />
            )}
        </SectionWrapper>
    );
};
