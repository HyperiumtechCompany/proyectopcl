import { Square } from 'lucide-react';
import type { Room } from '@/pages/dialux/hooks/types';
import { getPeruWallPreset } from '@/pages/dialux/hooks/wallNorms';
import { PropField, SectionWrapper, SelectField } from '../PropertyFields';

/**
 * Sección "Construcción" de `RoomProps.tsx` (Fase 2, extracción sin cambiar
 * comportamiento) — solo se renderiza para el recinto exterior, nunca para
 * un ambiente/pasadizo.
 */
export function RoomConstructionSection({
    room,
    onUpdate,
}: {
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
}) {
    const roomMaterial = (room.material ?? 'brick') as 'brick' | 'adobe';
    const roomUse = (room.normativeUse ?? 'housing') as 'housing' | 'education' | 'generic';
    const constructionPreset = getPeruWallPreset(roomMaterial, roomUse);

    return (
        <SectionWrapper icon={<Square size={12} className="text-orange-400" />} label="Construcción">
            <SelectField
                label="Material estruct."
                value={roomMaterial}
                options={[
                    { value: 'brick', label: 'Ladrillo' },
                    { value: 'adobe', label: 'Adobe' },
                ]}
                onChange={(val) => onUpdate({ material: val as 'brick' | 'adobe' })}
            />
            <SelectField
                label="Tipo edificación"
                value={roomUse}
                options={[
                    { value: 'housing', label: 'Vivienda (A.010)' },
                    { value: 'education', label: 'Educación (A.040)' },
                    { value: 'generic', label: 'Genérico' },
                ]}
                onChange={(val) => onUpdate({ normativeUse: val as 'housing' | 'education' | 'generic' })}
            />
            <PropField label="Espesor pared rec." value={`${constructionPreset.recommendedThickness.toFixed(2)} m`} />
            <PropField label="Altura mín. permit." value={`${constructionPreset.minHeight.toFixed(2)} m`} />
        </SectionWrapper>
    );
}
