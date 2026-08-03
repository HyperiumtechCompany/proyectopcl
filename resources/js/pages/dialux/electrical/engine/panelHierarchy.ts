import type { ElectricalDocument, Feeder, Panel } from './types';

export function ensureFloorPanelHierarchy(
    doc: ElectricalDocument,
    createId: () => string,
): ElectricalDocument {
    const panels = doc.panels.map((panel) => ({ ...panel }));
    const feeders = doc.feeders.map((feeder) => ({ ...feeder }));

    let general = panels.find((panel) => panel.parentPanelId === null);
    if (!general) {
        general = {
            id: createId(),
            floorId: doc.floors[0]?.id ?? null,
            parentPanelId: null,
            code: 'TG-01',
            name: 'Tablero General',
            reservePct: 25,
        };
        panels.unshift(general);
    }

    // La generación automática deja un solo tablero raíz.
    for (const panel of panels) {
        if (panel.id !== general.id && panel.parentPanelId === null) {
            panel.parentPanelId = general.id;
        }
    }

    doc.floors.forEach((floor, index) => {
        let floorPanel = panels.find(
            (panel) => panel.id !== general.id && panel.floorId === floor.id,
        );
        if (!floorPanel) {
            floorPanel = {
                id: createId(),
                floorId: floor.id,
                parentPanelId: general.id,
                code: `TP-${String(index + 1).padStart(2, '0')}`,
                name: `Tablero ${floor.name}`,
                reservePct: 25,
            } satisfies Panel;
            panels.push(floorPanel);
        } else {
            floorPanel.parentPanelId = general.id;
        }

        const hasFeeder = feeders.some(
            (feeder) => feeder.fromPanelId === general.id && feeder.toPanelId === floorPanel.id,
        );
        if (!hasFeeder) {
            feeders.push({
                id: createId(),
                fromPanelId: general.id,
                toPanelId: floorPanel.id,
                lengthM: 15,
            } satisfies Feeder);
        }
    });

    return { ...doc, panels, feeders };
}
