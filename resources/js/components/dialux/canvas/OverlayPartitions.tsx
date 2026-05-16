import React from 'react';
import { Partition, Vertex } from '@/hooks/dialux/types';

interface OverlayPartitionsProps {
    partitions: Partition[];
    scaleX: (x: number) => number;
    scaleY: (y: number) => number;
    selectedId: string | null;
    onSelect: (id: string) => void;
    opacity?: number;
    showDoors?: boolean; // We could render doors here if we want, but doors are rendered by OverlayDoors usually.
}

export const OverlayPartitions: React.FC<OverlayPartitionsProps> = ({
    partitions,
    scaleX,
    scaleY,
    selectedId,
    onSelect,
    opacity = 1,
}) => {
    // Para simplificar, una partición es una línea (Stroke) con un color según el tipo.
    // También mostramos un grosor aproximado o simple línea si el grosor es < 0.10.

    const getColorForType = (type: Partition['partitionType']) => {
        switch (type) {
            case 'melamine': return '#a0522d'; // sienna
            case 'drywall': return '#808080';  // grey
            case 'glass': return '#add8e6';    // lightblue
            case 'masonry': return '#d2691e';  // chocolate
            default: return '#555555';
        }
    };

    return (
        <g id="overlay-partitions" opacity={opacity}>
            {partitions.map((partition) => {
                const color = getColorForType(partition.partitionType);
                const strokeWidth = partition.thickness > 0 ? partition.thickness * 100 : 2; // aproximado

                // Construimos el path SVG
                const pathData = partition.vertices.map((v, i) => {
                    const sx = scaleX(v.x);
                    const sy = scaleY(v.y);
                    return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
                }).join(' ');

                const isSelected = selectedId === partition.id;

                return (
                    <g 
                        key={partition.id} 
                        className="partition-group"
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={() => onSelect(partition.id)}
                    >
                        <path
                            d={pathData}
                            fill="none"
                            stroke={isSelected ? '#fde047' : color} // yellow if selected
                            strokeWidth={Math.max(isSelected ? 4 : 2, strokeWidth * (scaleX(1) - scaleX(0)) / 100)} // escalar grosor
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.8}
                        />
                        {/* Línea central fina para precisión */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke="#000"
                            strokeWidth={1}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </g>
                );
            })}
        </g>
    );
};
