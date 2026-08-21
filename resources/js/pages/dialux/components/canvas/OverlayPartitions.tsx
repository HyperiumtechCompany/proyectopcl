import React from 'react';
import type { Partition} from '@/pages/dialux/hooks/types';
import { Vertex } from '@/pages/dialux/hooks/types';

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
            case 'reinforced_plastic': return '#e5e7eb'; // gris muy claro (PRFV)
            default: return '#555555';
        }
    };

    const selectedPartition = partitions.find((p) => p.id === selectedId);

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
            {selectedPartition && (
                <g className="partition-polyline-handles">
                    {selectedPartition.vertices.map((vertex, index) => {
                        const point = { x: scaleX(vertex.x), y: scaleY(vertex.y) };
                        const nextVertex = selectedPartition.vertices[index + 1];
                        const next = nextVertex ? { x: scaleX(nextVertex.x), y: scaleY(nextVertex.y) } : null;
                        return (
                            <g key={`${selectedPartition.id}-vertex-${index}`}>
                                {next && (
                                    <rect
                                        data-partition-edge-id={selectedPartition.id}
                                        data-partition-edge-index={index}
                                        x={(point.x + next.x) / 2 - 6}
                                        y={(point.y + next.y) / 2 - 6}
                                        width={12}
                                        height={12}
                                        rx={2}
                                        fill="#22d3ee"
                                        stroke="#083344"
                                        strokeWidth={1.5}
                                        opacity={0.9}
                                        style={{ cursor: 'copy', pointerEvents: 'all' }}
                                    />
                                )}
                                <circle
                                    data-partition-vertex-id={selectedPartition.id}
                                    data-partition-vertex-index={index}
                                    cx={point.x}
                                    cy={point.y}
                                    r={8}
                                    fill="#22c55e"
                                    stroke="#052e16"
                                    strokeWidth={2}
                                    style={{ cursor: 'move', pointerEvents: 'all' }}
                                />
                            </g>
                        );
                    })}
                </g>
            )}
        </g>
    );
};
