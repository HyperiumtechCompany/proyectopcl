import { classifyDxfLevelEntities } from './resources/js/pages/dialux/export/dxf/builders/classifyDxfLevelEntities.ts';
import { buildLightingEntities } from './resources/js/pages/dialux/export/dxf/builders/buildDisciplineEntities.ts';
import { buildLightingLegendRows } from './resources/js/pages/dialux/export/dxf/builders/buildLightingLegendRows.ts';

const mockLevel = {
    sceneId: 'test', floorIndex: 0, floorElevation: 0, floorHeight: 0, name: 'test',
    visible: true, basePlan: { entities: [] }, architecture: { rooms: [], walls: [], windows: [], doors: [], canopies: [] },
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    electrical: {
        fixtures: [], lightSwitches: [], conductors: [], junctionBoxes: [],
        electricalDevices: [
            { id: '1', type: 'main_panel', properties: {}, mountingHeight: 1.8 }
        ]
    }
};

const classification = classifyDxfLevelEntities(mockLevel as any);
const lightingEntities = buildLightingEntities(mockLevel as any, classification);
const legendRows = buildLightingLegendRows(lightingEntities);
console.log(JSON.stringify(legendRows, null, 2));
