import { Minus } from 'lucide-react';
import React from 'react';
import { calculatePolygonPerimeter } from '@/pages/dialux/hooks/lightingCalculations';
import type { Partition } from '@/pages/dialux/hooks/types';
import { EditField, PropField, SectionWrapper, SelectField } from './PropertyFields';

export const PartitionProps: React.FC<{
    partition: Partition;
    onUpdate: (patch: Partial<Omit<Partition, 'id' | 'vertices'>>) => void;
}> = ({ partition, onUpdate }) => {
    const length = calculatePolygonPerimeter(partition.vertices, false);
    return (
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
            <SectionWrapper
                icon={<Minus size={12} className="text-orange-400" />}
                label="Partición / Separador"
            >
                <PropField label="Longitud" value={`${length.toFixed(4)} m`} />
                <SelectField
                    label="Tipo"
                    value={partition.partitionType}
                    options={[
                        { value: 'melamine', label: 'Melamina (SS.HH)' },
                        { value: 'drywall', label: 'Drywall' },
                        { value: 'glass', label: 'Vidrio' },
                        { value: 'masonry', label: 'Ladrillo' },
                    ]}
                    onChange={(val) => onUpdate({ partitionType: val as any })}
                />
                <EditField
                    label="Grosor (m)"
                    value={partition.thickness}
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    onChange={(val) => onUpdate({ thickness: val })}
                />
                <EditField
                    label="Altura (m)"
                    value={partition.height}
                    min={0.1}
                    max={10}
                    step={0.1}
                    onChange={(val) => onUpdate({ height: val })}
                />
                <EditField
                    label="Elevación base (m)"
                    value={partition.bottomGap}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(val) => onUpdate({ bottomGap: val })}
                />
                <PropField label="ID" value={partition.id.slice(0, 12)} />
            </SectionWrapper>
        </div>
    );
};
