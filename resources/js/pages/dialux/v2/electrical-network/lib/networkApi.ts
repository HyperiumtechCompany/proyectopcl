import { update } from '@/actions/App/Http/Controllers/Dialux/V2/ElectricalNetworkController';
import type { ElectricalNetworkSnapshot } from '../domain/types';

function xsrf(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

export async function saveElectricalNetwork(
    projectId: number,
    snapshot: ElectricalNetworkSnapshot,
): Promise<ElectricalNetworkSnapshot> {
    const response = await fetch(update.url(projectId), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrf(),
        },
        body: JSON.stringify(snapshot),
    });
    const payload = (await response.json().catch(() => null)) as {
        network?: ElectricalNetworkSnapshot;
        message?: string;
        errors?: Record<string, string[]>;
    } | null;
    if (!response.ok || !payload?.network)
        throw new Error(
            payload?.errors
                ? Object.values(payload.errors).flat()[0]
                : (payload?.message ?? 'No se pudo guardar la red.'),
        );
    return payload.network;
}
