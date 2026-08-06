import { Grid, Layers, Minus, PlugZap, Trash2, Zap } from 'lucide-react';
import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    deriveAmbientSpaces,
    pointInPolygon,
} from '@/pages/dialux/hooks/ambientSpaces';
import type { DerivedAmbientSpace } from '@/pages/dialux/hooks/ambientSpaces';
import {
    polygonBBox,
    suggestFixtureGridSize,
} from '@/pages/dialux/hooks/fixtureGrid';
import {
    calculateExactQuantity,
    calculateLumensRequired,
    calculatePolygonPerimeter,
    calculateRoundedQuantity,
} from '@/pages/dialux/hooks/lightingCalculations';
import { ensureStandardDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
import {
    distributeOutletsOnPerimeter,
    OUTLET_RULES,
    requiredOutletCount,
    type OutletUse,
} from '@/pages/dialux/hooks/outletPlacement';
import {
    NORMATIVE_LABELS,
    buildRoomLightingInputs,
    calculateRoomIndexForRoom,
    getActivityOptions,
    getCategoryOptions,
    getRoomUsefulPlaneHeight,
    getSectionOptions,
} from '@/pages/dialux/hooks/roomLighting';
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    ELECTRICAL_DEVICE_DEFAULTS,
    type ElectricalDeviceType,
} from '@/pages/dialux/hooks/types';
import type { Room, Scene, Wall } from '@/pages/dialux/hooks/useEditorStore';
import { getWallPresetFromWall } from '@/pages/dialux/hooks/wallNorms';
import { CatalogPanel } from '../CatalogPanel';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
    TextField,
} from './PropertyFields';

// Temporalmente solo se ofrece la grilla de luminarias de techo.
const SHOW_WALL_FIXTURE_GRID = false;

const WallInteriorLightingSection: React.FC<{
    wall: Wall;
    scene: Scene | null;
    ambientMatch: DerivedAmbientSpace | null;
    onUpdate: (patch: Partial<Omit<Wall, 'id'>>) => void;
    onUpdateAmbient: (
        patch: Partial<NonNullable<Room['ambientConfigs']>[string]>,
    ) => void;
}> = ({ wall, scene, ambientMatch, onUpdate, onUpdateAmbient }) => {
    const store = useEditorStore();
    const ambientConfig =
        ambientMatch?.sourceRoom.ambientConfigs?.[ambientMatch.configKey];
    const standard = (ambientConfig?.normativeStandard ??
        ambientMatch?.sourceRoom.normativeStandard ??
        wall.normativeStandard ??
        store.defaultRoomNormativeStandard) as NormativeStandard;

    // Estado local: independiente del ajuste global de la herramienta
    // "fixture-grid" del canvas y de la grilla de techo del ambiente (que
    // vive en el mismo panel) — antes las tres compartían store.ui.fixture-
    // GridRows/Cols, así que cambiar la grilla de techo también cambiaba,
    // sin avisar, los valores mostrados acá para la grilla de la pared.
    const [wallGridRows, setWallGridRows] = React.useState(
        store.ui.fixtureGridRows,
    );
    const [wallGridCols, setWallGridCols] = React.useState(
        store.ui.fixtureGridCols,
    );

    // Sin esto, este panel podía quedarse mostrando la transcripción estática
    // de normativeData.ts en vez del catálogo sembrado en BD (fuente única
    // de verdad) — el usuario veía categorías/aplicaciones que no coinciden
    // con la BD, y el lux aplicado a la pared salía del dato desactualizado.
    const [, setNormDataVersion] = React.useState(0);
    React.useEffect(() => {
        void ensureStandardDataLoaded(standard).then(() =>
            setNormDataVersion((v) => v + 1),
        );
    }, [standard]);

    const verts = wall.vertices;
    let wallLen = 0;
    for (let i = 1; i < verts.length; i++) {
        wallLen += Math.hypot(
            verts[i].x - verts[i - 1].x,
            verts[i].y - verts[i - 1].y,
        );
    }
    const wallArea = wallLen * wall.height;

    const normativeCategory =
        ambientConfig?.normativeCategory ?? wall.normativeCategory;
    const normativeSection =
        ambientConfig?.normativeSection ?? wall.normativeSection;
    const normativeActivity = ambientConfig?.activity ?? wall.normativeActivity;
    const cats = getCategoryOptions(standard);
    const sects = getSectionOptions(standard, normativeCategory);
    const activities = getActivityOptions(
        standard,
        normativeCategory,
        normativeSection,
    );

    const ambientRoom = ambientMatch?.room ?? null;

    const lux =
        ambientConfig?.illuminanceLux ??
        wall.illuminanceLux ??
        ambientMatch?.room.illuminanceLux ??
        300;
    const fixLumens = wall.fixtureLumens ?? 4000;
    // Mismo factor de utilización que el cálculo de techo del ambiente (índice
    // del local + reflectancias), en vez de asumir ~99% de aprovechamiento:
    // sin esto, "Lm requeridos (pared)" salía muy por debajo del cálculo real
    // del ambiente para la misma normativa, dando una falsa sensación de que
    // bastan menos luminarias de las que realmente exige la iluminancia objetivo.
    const roomIndex = ambientRoom
        ? calculateRoomIndexForRoom(
              ambientRoom,
              getRoomUsefulPlaneHeight(ambientRoom),
          )
        : undefined;
    const lumensReq = calculateLumensRequired(
        wallArea,
        lux,
        roomIndex
            ? {
                  roomIndex,
                  reflectances: {
                      ceiling: ambientRoom!.ceilingReflectance ?? 0.7,
                      wall: ambientRoom!.wallReflectance ?? 0.5,
                      floor: ambientRoom!.floorReflectance ?? 0.2,
                  },
              }
            : undefined,
    );
    const exactQty = calculateExactQuantity(lumensReq, fixLumens);
    const roundedQty = calculateRoundedQuantity(exactQty);

    const wallPolygon = React.useMemo(() => {
        if (verts.length < 2) return null;
        const ax = verts[0].x,
            ay = verts[0].y;
        const bx = verts[verts.length - 1].x,
            by = verts[verts.length - 1].y;
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.01) return null;
        const dx = (bx - ax) / len,
            dy = (by - ay) / len;
        const px = dy,
            py = -dx;
        const depth = Math.max(wall.thickness * 2, 1.5);
        return [
            { x: ax, y: ay },
            { x: bx, y: by },
            { x: bx + px * depth, y: by + py * depth },
            { x: ax + px * depth, y: ay + py * depth },
        ];
    }, [verts, wall.thickness]);

    // Luminarias adosadas específicamente a esta pared (apliques), no todas
    // las del ambiente: antes se filtraba contra el polígono completo del
    // ambiente (lo mismo que "Luminarias en el ambiente"), así que cualquier
    // luminaria de techo terminaba contando también como "en pared".
    const fixturesInArea = React.useMemo(() => {
        if (!scene || !wallPolygon) return [];
        return scene.fixtures.filter((f) =>
            pointInPolygon({ x: f.x, y: f.y }, wallPolygon),
        );
    }, [scene, wallPolygon]);

    const wallGridBBox = wallPolygon ? polygonBBox(wallPolygon) : null;
    const wallGridAspectRatio =
        wallGridBBox && wallGridBBox.height > 0
            ? wallGridBBox.width / wallGridBBox.height
            : 1;
    const suggestedWallGrid = suggestFixtureGridSize(
        wallGridRows,
        wallGridCols,
        roundedQty,
        wallGridAspectRatio,
    );
    const wallGridBelowNorm = wallGridRows * wallGridCols < roundedQty;

    const handleGenerate = () => {
        const fixtureTemplate = {
            ...store.ui.fixtureTemplate,
            ...(wall.fixtureType ? { fixtureType: wall.fixtureType } : {}),
            ...(wall.fixtureShape ? { fixtureShape: wall.fixtureShape } : {}),
            ...(wall.fixtureLumens ? { lumens: wall.fixtureLumens } : {}),
        };
        // Generate the grid over the wall's area, and assign it to the parent room if possible.
        const parentRoomId = ambientMatch?.sourceRoom.id ?? null;

        // Reemplaza TODAS las luminarias que ya están físicamente adosadas a
        // esta pared (no solo las que el usuario haya seleccionado a mano)
        // para que regenerar la grilla nunca deje duplicados superpuestos.
        store.beginHistoryGesture();
        fixturesInArea.forEach((f) => store.removeObject(f.id));

        const newIds = wallPolygon
            ? store.addFixtureGrid({
                  roomId: parentRoomId,
                  rows: wallGridRows,
                  columns: wallGridCols,
                  fixtureTemplate,
                  ambientVertices: wallPolygon,
              })
            : [];
        store.endHistoryGesture();
        if (newIds.length > 0) {
            store.setSelectedId(null);
            store.setSelectedFixtureIds(newIds);
        }
    };

    return (
        <div className="mt-3 space-y-2.5 border-t border-gray-700/50 pt-3">
            <div className="flex items-center gap-2">
                <Zap size={12} className="text-yellow-400" />
                <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                    Normativa del ambiente
                </p>
            </div>
            <p className="text-[9px] leading-snug text-gray-600">
                Parámetros y verificación normativa del ambiente seleccionado.
            </p>

            <PropField
                label="Estándar"
                value={NORMATIVE_LABELS[standard]}
                mono={false}
            />
            <PropField
                label="Superficie de la pared"
                value={`${wallArea.toFixed(2)} m²`}
            />

            <SelectField
                label="Sección / Área"
                value={normativeCategory ?? ''}
                options={[
                    ...(normativeCategory && !cats.includes(normativeCategory)
                        ? [
                              {
                                  value: normativeCategory,
                                  label: normativeCategory,
                              },
                          ]
                        : []),
                    ...cats.map((c) => ({ value: c, label: c })),
                ]}
                onChange={(val) => {
                    onUpdate({
                        normativeCategory: val,
                        normativeSection: undefined,
                        normativeActivity: undefined,
                    });
                    onUpdateAmbient({
                        normativeStandard: standard,
                        normativeCategory: val,
                        normativeSection: undefined,
                        activity: undefined,
                    });
                }}
            />
            {normativeCategory && (
                <SelectField
                    label="Subsección"
                    value={normativeSection ?? ''}
                    options={[
                        ...(normativeSection &&
                        !sects.includes(normativeSection)
                            ? [
                                  {
                                      value: normativeSection,
                                      label: normativeSection,
                                  },
                              ]
                            : []),
                        ...sects.map((s) => ({ value: s, label: s })),
                    ]}
                    onChange={(val) => {
                        onUpdate({
                            normativeSection: val,
                            normativeActivity: undefined,
                        });
                        onUpdateAmbient({
                            normativeSection: val,
                            activity: undefined,
                        });
                    }}
                />
            )}
            {normativeSection && (
                <SelectField
                    label="Aplicación"
                    value={normativeActivity ?? ''}
                    options={[
                        ...(normativeActivity &&
                        !activities.some(
                            (a) => a.activity === normativeActivity,
                        )
                            ? [
                                  {
                                      value: normativeActivity,
                                      label: normativeActivity,
                                  },
                              ]
                            : []),
                        ...activities.map((a) => ({
                            value: a.activity,
                            label: a.activity,
                        })),
                    ]}
                    onChange={(val) => {
                        const act = activities.find((a) => a.activity === val);
                        const illuminanceLux = act?.illuminanceLux ?? lux;
                        onUpdate({ normativeActivity: val, illuminanceLux });
                        onUpdateAmbient({ activity: val, illuminanceLux });
                    }}
                />
            )}

            <EditField
                label="Iluminancia (lux)"
                value={lux}
                min={10}
                max={2000}
                step={10}
                onChange={(val) => {
                    onUpdate({ illuminanceLux: val });
                    onUpdateAmbient({ illuminanceLux: val });
                }}
            />

            <div className="flex items-center justify-between">
                <PropField
                    label="Luminarias en pared"
                    value={`${fixturesInArea.length}`}
                />
                {fixturesInArea.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            store.setSelectedId(null);
                            store.setSelectedFixtureIds(
                                fixturesInArea.map((f) => f.id),
                            );
                        }}
                        className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40"
                    >
                        Seleccionar
                    </button>
                )}
            </div>
            <PropField
                label="Lm requeridos (pared)"
                value={`${lumensReq.toFixed(0)} lm`}
            />
            <PropField
                label="Cant. óptima (pared)"
                value={exactQty.toFixed(2)}
            />
            <PropField label="Cant. simetría (pared)" value={`${roundedQty}`} />

            <EditField
                label="Lm/foco"
                value={fixLumens}
                min={100}
                max={50000}
                step={100}
                onChange={(val) => onUpdate({ fixtureLumens: val })}
            />
            <SelectField
                label="Tipo foco"
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
                onChange={(val) =>
                    onUpdate({ fixtureType: val as Wall['fixtureType'] })
                }
            />
            <SelectField
                label="Forma foco"
                value={wall.fixtureShape ?? 'round'}
                options={[
                    { value: 'round', label: 'Redonda' },
                    { value: 'square', label: 'Cuadrada' },
                    { value: 'rectangular', label: 'Rectangular' },
                    { value: 'cylindrical', label: 'Cilíndrica' },
                ]}
                onChange={(val) =>
                    onUpdate({ fixtureShape: val as Wall['fixtureShape'] })
                }
            />

            {SHOW_WALL_FIXTURE_GRID && (
                <div className="mt-3 border-t border-gray-700/50 pt-2">
                    <div className="mb-2 flex items-center gap-2 text-emerald-500">
                        <Grid size={12} />
                        <p className="text-[10px] font-semibold uppercase">
                            Grilla sobre Pared
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <EditField
                            label="Filas"
                            value={wallGridRows}
                            min={1}
                            max={20}
                            step={1}
                            onChange={setWallGridRows}
                        />
                        <EditField
                            label="Columnas"
                            value={wallGridCols}
                            min={1}
                            max={20}
                            step={1}
                            onChange={setWallGridCols}
                        />
                    </div>
                    {wallGridBelowNorm && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded bg-amber-950/40 px-2 py-1.5">
                            <span className="text-[9px] leading-snug text-amber-400">
                                {wallGridRows}×{wallGridCols} ={' '}
                                {wallGridRows * wallGridCols}, faltan para
                                llegar a {roundedQty} (normativa)
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setWallGridRows(suggestedWallGrid.rows);
                                    setWallGridCols(suggestedWallGrid.columns);
                                }}
                                className="shrink-0 rounded bg-amber-600/30 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-600/50"
                            >
                                Usar {suggestedWallGrid.rows}×
                                {suggestedWallGrid.columns}
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                    >
                        <Grid size={11} />
                        Generar en Pared {wallGridRows}×{wallGridCols}
                    </button>
                    <p className="mt-1 text-[9px] leading-snug text-gray-500">
                        Genera una grilla de focos pegada a la superficie de
                        esta pared (ej. apliques).
                    </p>
                </div>
            )}
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
    // Regla de tomacorrientes de ESTE sub-ambiente (ver `AmbientConfig.outletUse`)
    // — no confundir con `outletRoom.outletUse` (recinto físico, compartido
    // por todos sus sub-ambientes).
    const ambientOutletConfig =
        ambientMatch?.sourceRoom.ambientConfigs?.[ambientMatch.configKey];
    const updateAmbientOutletConfig = (
        patch: Partial<
            Pick<
                NonNullable<Room['ambientConfigs']>[string],
                'outletUse' | 'outletDeviceType' | 'outletStartOffset'
            >
        >,
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

    // Estado local para la grilla de techo — independiente de la grilla de
    // pared (más abajo en el mismo panel) y de la herramienta "fixture-grid"
    // del canvas, que antes compartían store.ui.fixtureGridRows/Cols.
    const [ceilingGridRows, setCeilingGridRows] = React.useState(
        store.ui.fixtureGridRows,
    );
    const [ceilingGridCols, setCeilingGridCols] = React.useState(
        store.ui.fixtureGridCols,
    );
    const [showCeilingFixturePicker, setShowCeilingFixturePicker] =
        React.useState(false);
    // Ver comentario equivalente en RoomProps.tsx: elegir un modelo aquí solo
    // debe leer sus lúmenes para el cálculo de la grilla, no dejar la
    // herramienta activa en "fixture" (efecto secundario de
    // CatalogPanel.setFixture pensado para el panel Luz de la barra).
    const toolBeforeCeilingPickerRef = React.useRef(store.ui.activeTool);

    // Sugerencia de grilla de techo: cuántas filas/columnas hacen falta para
    // llegar a la cantidad mínima que exige la normativa del ambiente. Se
    // recalcula con los lúmenes del tipo de foco elegido más abajo (no con
    // los de las luminarias ya colocadas, ni con un valor fijo) para que la
    // sugerencia refleje la luminaria que realmente se va a instalar.
    const ceilingInputs = ambientMatch
        ? buildRoomLightingInputs(ambientMatch.room, ambientMatch.fixtures)
        : null;
    const ceilingFixture = store.ui.fixtureTemplate;
    const ceilingFixtureLumens =
        ceilingFixture.lumens ?? ceilingInputs?.fixtureLumens ?? 4000;
    const ceilingRoundedQuantity = ceilingInputs
        ? calculateRoundedQuantity(
              calculateExactQuantity(
                  ceilingInputs.lumensRequired,
                  ceilingFixtureLumens,
              ),
          )
        : 0;
    const ceilingBBox = ambientMatch
        ? polygonBBox(ambientMatch.room.vertices)
        : null;
    const ceilingAspectRatio =
        ceilingBBox && ceilingBBox.height > 0
            ? ceilingBBox.width / ceilingBBox.height
            : 1;
    const suggestedCeilingGrid = ceilingInputs
        ? suggestFixtureGridSize(
              ceilingGridRows,
              ceilingGridCols,
              ceilingRoundedQuantity,
              ceilingAspectRatio,
          )
        : null;
    const ceilingGridBelowNorm =
        !!ceilingInputs &&
        ceilingGridRows * ceilingGridCols < ceilingRoundedQuantity;
    const outletRoom = ambientMatch?.sourceRoom ?? null;
    const outletUse = ambientOutletConfig?.outletUse ?? 'aula';
    const outletRule = OUTLET_RULES[outletUse];
    const outletDeviceType =
        ambientOutletConfig?.outletDeviceType ??
        (outletUse === 'exterior' ? 'outlet_waterproof' : 'outlet_floor');
    const requiredOutlets = ambientMatch
        ? requiredOutletCount(ambientMatch.room.vertices, outletUse)
        : 0;
    const generatedOutlets = (scene?.electricalDevices ?? []).filter(
        (device) =>
            device.generatedBy === 'outlet-rule' &&
            device.roomId === outletRoom?.id &&
            device.ambientId === wall.id,
    );
    const regenerateOutlets = () => {
        if (!ambientMatch || !outletRoom) return;
        const defaults = ELECTRICAL_DEVICE_DEFAULTS[outletDeviceType];
        const devices = distributeOutletsOnPerimeter(
            ambientMatch.room.vertices,
            requiredOutlets,
            ambientOutletConfig?.outletStartOffset,
        ).map((point, index) => ({
            type: outletDeviceType,
            x: point.x,
            y: point.y,
            label: `${defaults.label}-${String(index + 1).padStart(2, '0')}`,
            mountingHeight:
                outletDeviceType === 'outlet_ceiling'
                    ? ambientMatch.room.height
                    : defaults.mountingHeight,
            roomId: outletRoom.id,
            // NO se fija `wallId` aquí a propósito: cada punto se reparte
            // por TODO el perímetro del ambiente (puede quedar pegado a
            // cualquier pared, no solo a `wall`), así que `buildElectricalDevice`
            // (House3DBuilder) debe seguir buscando la pared más cercana por
            // sí mismo en 2D/3D. `ambientId` es solo para agrupar el
            // conjunto generado, no para orientación.
            ambientId: wall.id,
            generatedBy: 'outlet-rule' as const,
            connectedDeviceIds: [],
            properties: { ...defaults.properties },
        }));
        store.replaceGeneratedOutletsForRoom(outletRoom.id, devices, wall.id);
    };

    // Una pared interior y el recinto que delimita son, físicamente, la
    // misma altura — dejar el alto editable por separado permitía que se
    // desincronizaran (afectando el cálculo de lúmenes, que usa la altura
    // del recinto para el índice del local). Los muros 'cerco'/'exterior'
    // sin recinto asociado sí pueden tener su propia altura (cercos, muros
    // libres), así que no se tocan.
    const inheritedHeight =
        wall.wallType === 'interior' && ambientMatch
            ? ambientMatch.sourceRoom.height
            : null;
    React.useEffect(() => {
        if (inheritedHeight !== null && wall.height !== inheritedHeight) {
            onUpdate({ height: inheritedHeight });
        }
    }, [inheritedHeight, wall.height, onUpdate]);

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
            {/* Orden solicitado: área (del ambiente que delimita esta pared,
                si aplica) → longitud → alto, para que lo primero que se vea
                sea el dato que más importa al revisar el ambiente. */}
            {ambientMatch && (
                <PropField
                    label="Área del ambiente (piso)"
                    value={`${ambientMatch.area.toFixed(4)} m²`}
                />
            )}
            <PropField label="Longitud" value={`${len.toFixed(4)} m`} />
            {inheritedHeight !== null ? (
                <PropField
                    label="Alto (m) — heredado del recinto"
                    value={`${inheritedHeight.toFixed(2)} m`}
                    mono={false}
                />
            ) : (
                <EditField
                    label="Alto (m)"
                    value={wall.height}
                    min={1}
                    max={20}
                    step={0.1}
                    onChange={(value) => onUpdate({ height: value })}
                />
            )}
            <EditField
                label="Espesor (m)"
                value={wall.thickness}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(value) => onUpdate({ thickness: value })}
            />
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
                    <div className="flex items-center justify-between">
                        <PropField
                            label="Luminarias en el ambiente"
                            value={`${ambientMatch.fixtures.length}`}
                        />
                        {ambientMatch.fixtures.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(
                                        ambientMatch.fixtures.map((f) => f.id),
                                    );
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
                                Grilla de focos (techo)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                toolBeforeCeilingPickerRef.current =
                                    store.ui.activeTool;
                                setShowCeilingFixturePicker(true);
                            }}
                            className="mt-2 flex w-full items-center gap-2 rounded border border-purple-700/30 bg-purple-950/30 px-2 py-1.5 text-left transition-colors hover:bg-purple-900/30"
                            title="Elegir el tipo de foco a instalar en esta grilla"
                        >
                            <Layers
                                size={12}
                                className="shrink-0 text-purple-300"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[10px] text-purple-200">
                                    {ceilingFixture.name ?? 'Foco genérico'}
                                </span>
                                <span className="block text-[9px] leading-none text-gray-500">
                                    {ceilingFixtureLumens.toLocaleString()} lm
                                </span>
                            </span>
                            <span className="shrink-0 text-[9px] text-purple-400">
                                Cambiar
                            </span>
                        </button>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <EditField
                                label="Filas"
                                value={ceilingGridRows}
                                min={1}
                                max={10}
                                step={1}
                                onChange={setCeilingGridRows}
                            />
                            <EditField
                                label="Columnas"
                                value={ceilingGridCols}
                                min={1}
                                max={10}
                                step={1}
                                onChange={setCeilingGridCols}
                            />
                        </div>
                        {ceilingGridBelowNorm && suggestedCeilingGrid && (
                            <div className="mt-2 flex items-center justify-between gap-2 rounded bg-amber-950/40 px-2 py-1.5">
                                <span className="text-[9px] leading-snug text-amber-400">
                                    {ceilingGridRows}×{ceilingGridCols} ={' '}
                                    {ceilingGridRows * ceilingGridCols}, faltan
                                    para llegar a {ceilingRoundedQuantity} con "
                                    {ceilingFixture.name ?? 'este foco'}" (
                                    {ceilingFixtureLumens.toLocaleString()} lm)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCeilingGridRows(
                                            suggestedCeilingGrid.rows,
                                        );
                                        setCeilingGridCols(
                                            suggestedCeilingGrid.columns,
                                        );
                                    }}
                                    className="shrink-0 rounded bg-amber-600/30 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-600/50"
                                >
                                    Usar {suggestedCeilingGrid.rows}×
                                    {suggestedCeilingGrid.columns}
                                </button>
                            </div>
                        )}
                        {showCeilingFixturePicker && (
                            <Dialog
                                open={showCeilingFixturePicker}
                                onOpenChange={setShowCeilingFixturePicker}
                            >
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>
                                            Elegir tipo de foco para la grilla
                                        </DialogTitle>
                                        <DialogDescription>
                                            Se usará para calcular cuántas
                                            luminarias exige la normativa y para
                                            generar la grilla.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <CatalogPanel
                                        filterCategory="luminaires"
                                        variant="compact-grid"
                                        fixtureItemsPerPage={15}
                                        onSelect={() => {
                                            store.setTool(
                                                toolBeforeCeilingPickerRef.current,
                                            );
                                            setShowCeilingFixturePicker(false);
                                        }}
                                    />
                                </DialogContent>
                            </Dialog>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                // Reemplaza TODAS las luminarias que ya están físicamente
                                // en este ambiente (no solo las seleccionadas a mano) para
                                // que regenerar la grilla nunca deje duplicados superpuestos.
                                store.beginHistoryGesture();
                                ambientMatch.fixtures.forEach((f) =>
                                    store.removeObject(f.id),
                                );

                                const newIds = store.addFixtureGrid({
                                    roomId: ambientMatch.sourceRoom.id,
                                    rows: ceilingGridRows,
                                    columns: ceilingGridCols,
                                    fixtureTemplate: store.ui.fixtureTemplate,
                                    ambientVertices: ambientMatch.room.vertices,
                                });
                                store.endHistoryGesture();
                                if (newIds.length > 0) {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(newIds);
                                } else {
                                    alert(
                                        'No se pudo generar la grilla. Asegúrese de que el ambiente esté cerrado y tenga un área válida.',
                                    );
                                }
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                        >
                            Generar en Techo de Ambiente {ceilingGridRows}x
                            {ceilingGridCols}
                        </button>
                        <p className="mt-1 text-[9px] leading-snug text-gray-500">
                            Genera luminarias en el área de techo delimitada por
                            esta pared.
                        </p>
                    </div>

                    <div className="my-2 space-y-2 border-t border-gray-800/80 pt-3">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <PlugZap size={12} />
                            <p className="text-[10px] font-semibold uppercase">
                                Tomacorrientes del ambiente
                            </p>
                        </div>
                        <SelectField
                            label="Uso"
                            value={outletUse}
                            options={Object.entries(OUTLET_RULES).map(
                                ([value, rule]) => ({
                                    value,
                                    label: rule.label,
                                }),
                            )}
                            onChange={(value) => {
                                const nextUse = value as OutletUse;
                                updateAmbientOutletConfig({
                                    outletUse: nextUse,
                                    outletDeviceType:
                                        nextUse === 'exterior'
                                            ? 'outlet_waterproof'
                                            : (ambientOutletConfig?.outletDeviceType ??
                                              'outlet_floor'),
                                });
                            }}
                        />
                        <SelectField
                            label="Tipo / altura"
                            value={outletDeviceType}
                            options={[
                                {
                                    value: 'outlet_floor',
                                    label: 'Bajo · 0.40 m',
                                },
                                {
                                    value: 'outlet_initial',
                                    label: 'Inicial · 1.50 m',
                                },
                                {
                                    value: 'outlet_waterproof',
                                    label: 'Exterior · 1.20 m',
                                },
                                {
                                    value: 'outlet_high_180',
                                    label: 'Alto · 1.80 m',
                                },
                                {
                                    value: 'outlet_rack',
                                    label: 'Comunicaciones · 2.00 m',
                                },
                                {
                                    value: 'outlet_floor_box',
                                    label: 'Piso · NPT',
                                },
                                { value: 'outlet_ceiling', label: 'Techo' },
                            ]}
                            onChange={(value) => {
                                const type = value as ElectricalDeviceType;
                                const defaults =
                                    ELECTRICAL_DEVICE_DEFAULTS[type];
                                updateAmbientOutletConfig({
                                    outletDeviceType: type,
                                });
                                store.updateGeneratedOutletsForRoom(
                                    outletRoom!.id,
                                    {
                                        type,
                                        mountingHeight:
                                            type === 'outlet_ceiling'
                                                ? ambientMatch!.room.height
                                                : defaults.mountingHeight,
                                        properties: { ...defaults.properties },
                                    },
                                    wall.id,
                                );
                            }}
                        />
                        <EditField
                            label="Inicio en perímetro (m)"
                            value={ambientOutletConfig?.outletStartOffset ?? 0}
                            min={0}
                            max={Math.max(
                                calculatePolygonPerimeter(
                                    ambientMatch.room.vertices,
                                ),
                                0,
                            )}
                            step={0.1}
                            onChange={(value) =>
                                updateAmbientOutletConfig({
                                    outletStartOffset: value,
                                })
                            }
                        />
                        <PropField
                            label="Medición"
                            value={
                                outletRule.method === 'area'
                                    ? `${ambientMatch.area.toFixed(2)} m²`
                                    : `${calculatePolygonPerimeter(ambientMatch.room.vertices).toFixed(2)} m`
                            }
                        />
                        <PropField
                            label="Regla"
                            value={outletRule.description}
                            mono={false}
                        />
                        <PropField
                            label="Cantidad requerida"
                            value={`${requiredOutlets}`}
                        />
                        <PropField
                            label="Generados"
                            value={`${generatedOutlets.length}`}
                        />
                        <PropField
                            label="Cable"
                            value="4 mm² · AWG 12"
                            mono={false}
                        />
                        <button
                            type="button"
                            onClick={regenerateOutlets}
                            disabled={requiredOutlets === 0}
                            className="w-full rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {generatedOutlets.length > 0
                                ? 'Regenerar tomacorrientes'
                                : 'Generar tomacorrientes'}
                        </button>
                        {generatedOutlets.length > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    store.removeGeneratedOutletsForRoom(
                                        outletRoom!.id,
                                        wall.id,
                                    )
                                }
                                className="flex w-full items-center justify-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
                            >
                                <Trash2 size={11} /> Eliminar tomacorrientes del
                                ambiente
                            </button>
                        )}
                        <p className="text-[9px] leading-snug text-gray-500">
                            Los puntos generados aparecerán sobre el perímetro
                            del ambiente en la vista 2D.
                        </p>
                    </div>
                </>
            )}
            {wall.wallType === 'interior' && (
                <WallInteriorLightingSection
                    wall={wall}
                    scene={scene}
                    ambientMatch={ambientMatch}
                    onUpdate={onUpdate}
                    onUpdateAmbient={updateAmbientConfig}
                />
            )}
        </SectionWrapper>
    );
};
