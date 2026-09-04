import { Box, Gauge, Plus, Ruler, Trash2 } from 'lucide-react';
import {
    calculatePolygonArea,
    calculatePolygonPerimeter,
} from '@/pages/dialux/hooks/lightingCalculations';
import type { RampFlight, StructuralObstacle } from '@/pages/dialux/hooks/types';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
    TextField,
} from './PropertyFields';

const OBSTACLE_TYPE_OPTIONS: Array<{ value: StructuralObstacle['obstacleType']; label: string }> = [
    { value: 'column', label: 'Columna' },
    { value: 'beam', label: 'Viga' },
    { value: 'restricted_area', label: 'Zona restringida' },
    { value: 'roof', label: 'Cubierta / tejado' },
    { value: 'ceiling', label: 'Cielorraso' },
    { value: 'ramp', label: 'Rampa' },
];

const ROOF_TYPE_OPTIONS = [
    { value: 'flat', label: 'Plano' }, { value: 'shed', label: 'A un agua' },
    { value: 'gable', label: 'A dos aguas' }, { value: 'mansard', label: 'Mansarda' },
    { value: 'hip', label: 'Cuatro aguas / pabellón' }, { value: 'butterfly', label: 'Mariposa' },
    { value: 'full', label: 'Cielorraso pleno' }, { value: 'custom', label: 'Personalizado' },
    { value: 'cove', label: 'Perimetral / casetón' }, { value: 'stepped', label: 'Desniveles' },
];

const RAMP_TYPE_OPTIONS = [
    { value: 'pedestrian', label: 'Peatonal / accesibilidad' },
    { value: 'vehicular', label: 'Vehicular' },
    { value: 'transition', label: 'Superficie de transición' },
];
const RAMP_USE_OPTIONS = [
    { value: 'education', label: 'Colegio / accesibilidad' },
    { value: 'housing', label: 'Vivienda' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'vehicular', label: 'Vehicular' },
];
const RAMP_SHAPE_OPTIONS = [
    { value: 'straight', label: 'Recta' },
    { value: 'spiral', label: 'Curva / helicoidal' },
];
const RAMP_MATERIAL_OPTIONS = [
    { value: 'concrete', label: 'Concreto / cemento' },
    { value: 'metal', label: 'Metal' },
    { value: 'plastic', label: 'Plástico reforzado' },
    { value: 'wood', label: 'Madera' },
    { value: 'composite', label: 'Compuesto' },
];
const RAMP_DIRECTION_OPTIONS = [
    { value: 'north', label: 'Norte' }, { value: 'south', label: 'Sur' },
    { value: 'east', label: 'Este' }, { value: 'west', label: 'Oeste' },
];

/**
 * Panel de propiedades de un StructuralObstacle (columna/viga/zona
 * restringida). `onUpdate` llama a `store.updateStructuralObstacle`, que
 * ademas recalcula (solo x,y) las grillas de luminarias afectadas -- ver
 * `recomputeFixtureGridsNearObstacle` en sceneObjectsSlice.ts.
 */
export function StructuralObstacleProps({
    obstacle,
    onUpdate,
}: {
    obstacle: StructuralObstacle;
    onUpdate: (patch: Partial<Omit<StructuralObstacle, 'id'>>) => void;
}) {
    const area = calculatePolygonArea(obstacle.vertices);
    const perimeter = calculatePolygonPerimeter(obstacle.vertices);
    const isRoof = obstacle.obstacleType === 'roof' || obstacle.obstacleType === 'ceiling';
    const isRamp = obstacle.obstacleType === 'ramp';
    const rampLength = Math.max(0.01, obstacle.length ?? 1);
    const rampSlope = ((obstacle.endLevel ?? 0) - (obstacle.startLevel ?? 0)) / rampLength * 100;
    const normativeSlopeLimit = obstacle.rampUse === 'vehicular' || obstacle.rampType === 'vehicular'
        ? 15 : obstacle.rampUse === 'industrial' || obstacle.rampType === 'transition' ? 10 : 8.33;
    const rampFlights = obstacle.rampFlights ?? [];
    const commitRampFlights = (flights: RampFlight[]) => onUpdate({
        rampFlights: flights,
        endLevel: (obstacle.startLevel ?? 0) + flights.reduce((sum, flight) => sum + flight.rise, 0),
        length: flights.reduce((sum, flight) => sum + flight.length + flight.landingLength, 0),
        hasLandings: flights.some((flight) => flight.landingLength > 0),
    });
    const updateRampFlight = (index: number, patch: Partial<RampFlight>) =>
        commitRampFlights(rampFlights.map((flight, current) =>
            current === index ? { ...flight, ...patch } : flight));
    const addRampFlight = () => {
        if (rampFlights.length === 0) {
            commitRampFlights([{
                id: `ramp-flight-${Date.now()}`, direction: obstacle.rampDirection ?? 'north',
                length: obstacle.length ?? 6,
                rise: (obstacle.endLevel ?? 0.5) - (obstacle.startLevel ?? 0),
                landingLength: obstacle.rampLandingLength ?? 1.5, turnAfterDeg: 0,
            }]);
            return;
        }
        const previous = rampFlights[rampFlights.length - 1];
        commitRampFlights([
            ...rampFlights.slice(0, -1),
            { ...previous, landingLength: Math.max(1.2, previous.landingLength), turnAfterDeg: previous.turnAfterDeg || 180 },
            { id: `ramp-flight-${Date.now()}`, direction: previous.direction,
                length: previous.length, rise: previous.rise,
                landingLength: 0, turnAfterDeg: 0 },
        ]);
    };
    const removeRampFlight = (index: number) =>
        commitRampFlights(rampFlights.filter((_, current) => current !== index));

    return (
        <div className="space-y-2.5">
        <SectionWrapper
            icon={<Box size={12} className="text-red-400" />}
            label="Identificación y geometría"
        >
            <TextField label="Nombre" value={obstacle.name} onChange={(value) => onUpdate({ name: value })} />
            <SelectField
                label="Tipo"
                value={obstacle.obstacleType}
                options={OBSTACLE_TYPE_OPTIONS}
                onChange={(value) => {
                    const obstacleType = value as StructuralObstacle['obstacleType'];
                    if (obstacleType === 'roof') {
                        onUpdate({ obstacleType, name: obstacle.name.startsWith('Columna') ? 'Cubierta' : obstacle.name, eaveHeight: obstacle.eaveHeight ?? 2.7, ridgeHeight: obstacle.ridgeHeight && obstacle.ridgeHeight > (obstacle.eaveHeight ?? 2.7) ? obstacle.ridgeHeight : (obstacle.eaveHeight ?? 2.7) + 1, elevation: obstacle.eaveHeight ?? 2.7 });
                    } else if (obstacleType === 'ceiling') {
                        onUpdate({ obstacleType, name: obstacle.name.startsWith('Columna') ? 'Cielorraso' : obstacle.name, roofType: 'full', eaveHeight: obstacle.eaveHeight ?? 2.7, ridgeHeight: obstacle.eaveHeight ?? 2.7, elevation: obstacle.eaveHeight ?? 2.7 });
                    } else if (obstacleType === 'ramp') {
                        onUpdate({ obstacleType, name: obstacle.name.startsWith('Columna') ? 'Rampa' : obstacle.name, startLevel: obstacle.startLevel ?? 0, endLevel: obstacle.endLevel ?? 0.5, elevation: obstacle.startLevel ?? 0 });
                    } else onUpdate({ obstacleType });
                }}
            />
            <PropField label="Area" value={`${area.toFixed(4)} m²`} />
            <PropField label="Perimetro" value={`${perimeter.toFixed(4)} m`} />
            <PropField label="Vertices" value={`${obstacle.vertices.length}`} />
            <EditField
                label="Elevacion desde el piso (m)"
                value={obstacle.elevation}
                min={0}
                max={20}
                step={0.1}
                onChange={(value) => onUpdate({ elevation: value })}
            />
            <EditField
                label="Altura del obstaculo (m)"
                value={obstacle.height}
                min={0}
                max={20}
                step={0.1}
                onChange={(value) => onUpdate({ height: value })}
            />
        </SectionWrapper>
            {isRoof && <SectionWrapper icon={<Ruler size={12} className="text-amber-500" />} label="Cubierta y materiales" defaultOpen={false}>
                <SelectField label="Tipo de techo" value={obstacle.roofType ?? (obstacle.obstacleType === 'ceiling' ? 'full' : 'flat')} options={ROOF_TYPE_OPTIONS} onChange={(value) => {
                    const roofType = value as StructuralObstacle['roofType'];
                    const pitched = roofType && ['shed', 'gable', 'mansard', 'hip', 'butterfly'].includes(roofType);
                    const eaveHeight = obstacle.eaveHeight ?? obstacle.elevation ?? 2.7;
                    onUpdate({ roofType, eaveHeight, elevation: eaveHeight, ridgeHeight: pitched && (obstacle.ridgeHeight ?? eaveHeight) <= eaveHeight ? eaveHeight + 1 : obstacle.ridgeHeight, slopePercent: pitched && (obstacle.slopePercent ?? 0) === 0 ? 20 : obstacle.slopePercent });
                }} />
                <EditField label="Altura de alero / cielorraso (m)" value={obstacle.eaveHeight ?? obstacle.elevation} min={0} max={30} step={0.05} onChange={(value) => onUpdate({ eaveHeight: value, elevation: value })} />
                <EditField label="Altura de cumbrera (m)" value={obstacle.ridgeHeight ?? obstacle.elevation} min={0} max={40} step={0.05} onChange={(value) => onUpdate({ ridgeHeight: value })} />
                <EditField label="Pendiente (%)" value={obstacle.slopePercent ?? 0} min={-100} max={100} step={0.5} onChange={(value) => onUpdate({ slopePercent: value })} />
                <EditField label="Orientación (°)" value={obstacle.orientationDeg ?? 0} min={0} max={359} step={1} onChange={(value) => onUpdate({ orientationDeg: value })} />
                <EditField label="Espesor (m)" value={obstacle.thickness ?? 0.15} min={0.01} max={2} step={0.01} onChange={(value) => onUpdate({ thickness: value })} />
                <EditField label="Reflectancia interior" value={obstacle.interiorReflectance ?? 0.7} min={0} max={1} step={0.05} onChange={(value) => onUpdate({ interiorReflectance: value })} />
                <EditField label="Reflectancia exterior" value={obstacle.exteriorReflectance ?? 0.3} min={0} max={1} step={0.05} onChange={(value) => onUpdate({ exteriorReflectance: value })} />
                <EditField label="Voladizo (m)" value={obstacle.overhang ?? 0} min={0} max={5} step={0.05} onChange={(value) => onUpdate({ overhang: value })} />
            </SectionWrapper>}
            {isRamp && <SectionWrapper icon={<Gauge size={12} className="text-cyan-500" />} label="Rampa y normativa" defaultOpen>
                <SelectField label="Situación / uso" value={obstacle.rampUse ?? 'education'} options={RAMP_USE_OPTIONS} onChange={(value) => {
                    const rampUse = value as StructuralObstacle['rampUse'];
                    const presets = {
                        education: { width: 1.2, targetLux: 100, rampShape: 'straight' as const },
                        housing: { width: 0.9, targetLux: 100, rampShape: 'straight' as const },
                        industrial: { width: 1.5, targetLux: 150, rampShape: 'straight' as const },
                        vehicular: { width: 3.5, targetLux: 75, rampShape: 'spiral' as const },
                    };
                    onUpdate({ rampUse, rampType: rampUse === 'vehicular' ? 'vehicular' : 'pedestrian', ...presets[rampUse ?? 'education'] });
                }} />
                <SelectField label="Forma" value={obstacle.rampShape ?? 'straight'} options={RAMP_SHAPE_OPTIONS} onChange={(value) => onUpdate({ rampShape: value as StructuralObstacle['rampShape'] })} />
                <SelectField label="Material" value={obstacle.rampMaterial ?? 'concrete'} options={RAMP_MATERIAL_OPTIONS} onChange={(value) => onUpdate({ rampMaterial: value as StructuralObstacle['rampMaterial'], material: value })} />
                <SelectField label="Uso de rampa" value={obstacle.rampType ?? 'pedestrian'} options={RAMP_TYPE_OPTIONS} onChange={(value) => onUpdate({ rampType: value as StructuralObstacle['rampType'] })} />
                <SelectField label="Dirección de subida" value={obstacle.rampDirection ?? 'north'} options={RAMP_DIRECTION_OPTIONS} onChange={(value) => onUpdate({ rampDirection: value as StructuralObstacle['rampDirection'] })} />
                <EditField label="Nivel inicial (m)" value={obstacle.startLevel ?? 0} min={-20} max={30} step={0.05} onChange={(value) => onUpdate({ startLevel: value, elevation: value })} />
                <EditField label="Nivel final (m)" value={obstacle.endLevel ?? 0.5} min={-20} max={30} step={0.05} onChange={(value) => onUpdate({ endLevel: value })} />
                <EditField label="Pisos conectados" value={obstacle.rampFloorCount ?? 1} min={1} max={20} step={1} onChange={(value) => onUpdate({ rampFloorCount: Math.round(value) })} />
                <EditField label="Longitud (m)" value={obstacle.length ?? 6} min={0.1} max={200} step={0.1} onChange={(value) => onUpdate({ length: value })} />
                <EditField label="Ancho (m)" value={obstacle.width ?? 1.2} min={0.5} max={30} step={0.1} onChange={(value) => onUpdate({ width: value })} />
                {(obstacle.rampShape ?? 'straight') === 'spiral' && <>
                    <EditField label="Número de vueltas" value={obstacle.rampTurns ?? 1} min={0.25} max={10} step={0.25} onChange={(value) => onUpdate({ rampTurns: value })} />
                    <EditField label="Ángulo inicial (°)" value={obstacle.rampStartAngleDeg ?? 0} min={0} max={359} step={5} onChange={(value) => onUpdate({ rampStartAngleDeg: value })} />
                    <SelectField label="Sentido de giro" value={obstacle.rampClockwise === false ? 'counterclockwise' : 'clockwise'} options={[{ value: 'clockwise', label: 'Horario' }, { value: 'counterclockwise', label: 'Antihorario' }]} onChange={(value) => onUpdate({ rampClockwise: value === 'clockwise' })} />
                </>}
                <EditField label="Longitud de descanso (m)" value={obstacle.rampLandingLength ?? 1.5} min={0} max={20} step={0.1} onChange={(value) => onUpdate({ rampLandingLength: value, hasLandings: value > 0 })} />
                <SelectField label="Barandas" value={obstacle.rampHasRailings === false ? 'no' : 'yes'} options={[{ value: 'yes', label: 'Sí' }, { value: 'no', label: 'No' }]} onChange={(value) => onUpdate({ rampHasRailings: value === 'yes' })} />
                {(obstacle.rampShape ?? 'straight') === 'straight' && <div className="mt-2 space-y-2 border-t border-cyan-900/40 pt-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-cyan-300">Tramos y descansos ({rampFlights.length || 1})</span>
                        <button type="button" onClick={addRampFlight} className="flex items-center gap-1 rounded bg-cyan-700/60 px-1.5 py-0.5 text-[9px] text-cyan-100 hover:bg-cyan-600/70">
                            <Plus size={9} /> {rampFlights.length ? 'Agregar tramo' : 'Dividir'}
                        </button>
                    </div>
                    {rampFlights.map((flight, index) => <div key={flight.id} className="space-y-1 rounded border border-cyan-900/50 bg-cyan-950/20 p-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-semibold text-cyan-300">Tramo {index + 1}</span>
                            <button type="button" onClick={() => removeRampFlight(index)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
                        </div>
                        {index === 0 && <SelectField label="Dirección inicial" value={flight.direction} options={RAMP_DIRECTION_OPTIONS} onChange={(value) => updateRampFlight(index, { direction: value as RampFlight['direction'] })} />}
                        <EditField label="Desarrollo (m)" value={flight.length} min={0.5} max={200} step={0.1} onChange={(value) => updateRampFlight(index, { length: value })} />
                        <EditField label="Desnivel (m)" value={flight.rise} min={-20} max={20} step={0.05} onChange={(value) => updateRampFlight(index, { rise: value })} />
                        <EditField label="Descanso posterior (m)" value={flight.landingLength} min={0} max={20} step={0.1} onChange={(value) => updateRampFlight(index, { landingLength: value })} />
                        {index < rampFlights.length - 1 && <EditField label="Giro siguiente (°)" value={flight.turnAfterDeg} min={-180} max={180} step={15} onChange={(value) => updateRampFlight(index, { turnAfterDeg: value })} />}
                        <PropField label="Pendiente del tramo" value={`${(flight.rise / Math.max(0.01, flight.length) * 100).toFixed(2)} %`} />
                    </div>)}
                </div>}
                <EditField label="Lux objetivo" value={obstacle.targetLux ?? (obstacle.rampType === 'vehicular' ? 75 : 100)} min={0} max={2000} step={5} onChange={(value) => onUpdate({ targetLux: value })} />
                <EditField label="Uniformidad mínima" value={obstacle.uniformityTarget ?? 0.4} min={0} max={1} step={0.05} onChange={(value) => onUpdate({ uniformityTarget: value })} />
                <PropField label="Pendiente calculada" value={`${rampSlope.toFixed(2)} %`} />
                <PropField label="Control normativo" value={Math.abs(rampSlope) <= normativeSlopeLimit ? `Conforme (≤ ${normativeSlopeLimit}%)` : `No conforme (> ${normativeSlopeLimit}%)`} />
            </SectionWrapper>}
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                {obstacle.obstacleType === 'restricted_area' && obstacle.height <= 0
                    ? 'Sin altura definida: bloquea la instalacion de luminarias a cualquier altura de montaje.'
                    : `Bloquea el plano de montaje entre ${obstacle.elevation.toFixed(2)}m y ${(obstacle.elevation + obstacle.height).toFixed(2)}m desde el piso.`}
            </p>
        </div>
    );
}
