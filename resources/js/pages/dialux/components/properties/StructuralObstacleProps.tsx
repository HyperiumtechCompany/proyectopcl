import { Box } from 'lucide-react';
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

    return (
        <SectionWrapper
            icon={<Box size={12} className="text-red-400" />}
            label="Obstaculo estructural"
        >
            <TextField label="Nombre" value={obstacle.name} onChange={(value) => onUpdate({ name: value })} />
            <SelectField
                label="Tipo"
                value={obstacle.obstacleType}
                options={OBSTACLE_TYPE_OPTIONS}
                onChange={(value) => onUpdate({ obstacleType: value as StructuralObstacle['obstacleType'] })}
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
            <p className="mt-1 text-[9.5px] leading-snug text-gray-600 dark:text-gray-600">
                {obstacle.obstacleType === 'restricted_area' && obstacle.height <= 0
                    ? 'Sin altura definida: bloquea la instalacion de luminarias a cualquier altura de montaje.'
                    : `Bloquea el plano de montaje entre ${obstacle.elevation.toFixed(2)}m y ${(obstacle.elevation + obstacle.height).toFixed(2)}m desde el piso.`}
            </p>
        </SectionWrapper>
    );
}
