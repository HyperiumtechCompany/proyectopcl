import { Box, Gauge, Ruler } from 'lucide-react';
import {
    calculatePolygonArea,
    calculatePolygonPerimeter,
} from '@/pages/dialux/hooks/lightingCalculations';
import type { StructuralObstacle } from '@/pages/dialux/hooks/types';
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
    const normativeSlopeLimit = obstacle.rampType === 'vehicular' ? 15 : obstacle.rampType === 'transition' ? 10 : 8.33;

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
            {isRamp && <SectionWrapper icon={<Gauge size={12} className="text-cyan-500" />} label="Rampa y normativa" defaultOpen={false}>
                <SelectField label="Uso de rampa" value={obstacle.rampType ?? 'pedestrian'} options={RAMP_TYPE_OPTIONS} onChange={(value) => onUpdate({ rampType: value as StructuralObstacle['rampType'] })} />
                <EditField label="Nivel inicial (m)" value={obstacle.startLevel ?? 0} min={-20} max={30} step={0.05} onChange={(value) => onUpdate({ startLevel: value, elevation: value })} />
                <EditField label="Nivel final (m)" value={obstacle.endLevel ?? 0.5} min={-20} max={30} step={0.05} onChange={(value) => onUpdate({ endLevel: value })} />
                <EditField label="Longitud (m)" value={obstacle.length ?? 6} min={0.1} max={200} step={0.1} onChange={(value) => onUpdate({ length: value })} />
                <EditField label="Ancho (m)" value={obstacle.width ?? 1.2} min={0.5} max={30} step={0.1} onChange={(value) => onUpdate({ width: value })} />
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
