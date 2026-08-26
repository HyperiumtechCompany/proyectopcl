import { describe, expect, it } from 'vitest';
import { deriveAutoEdgeLength, type PanelFeederGeometry } from './useElectricalNetwork';

describe('deriveAutoEdgeLength', () => {
    it('TG → TD raíz: horizontal = 200 m menos la subida al tablero, vertical = elevación de piso + altura de montaje', () => {
        const geometry: PanelFeederGeometry = {
            'td-piso-1': {
                horizontalLengthM: 0,
                verticalLengthM: 0,
                mountingHeightM: 1.8,
                ceilingRiseM: 1.7,
                x: 0,
                y: 0,
                sceneId: 'piso-1',
                floorElevationM: 0,
            },
        };
        const derived = deriveAutoEdgeLength(
            { horizontalLengthM: 0 },
            { type: 'main_panel', deviceId: undefined },
            { deviceId: 'td-piso-1' },
            geometry,
        );
        expect(derived).not.toBeNull();
        expect(derived!.verticalLengthM).toBeCloseTo(1.8);
        expect(derived!.horizontalLengthM).toBeCloseTo(198.2);
        expect(derived!.lengthMode).toBe('combined');
    });

    it('TD (piso 1) → Sub-TD-01 (piso 2): la vertical es la elevación real entre pisos, no un valor fijo — reproduce el ejemplo del usuario (1.8 + 1.7 = 3.5 m)', () => {
        const geometry: PanelFeederGeometry = {
            'td-piso-1': {
                horizontalLengthM: 0,
                verticalLengthM: 0,
                mountingHeightM: 1.8,
                ceilingRiseM: 1.7,
                x: 0,
                y: 0,
                sceneId: 'piso-1',
                floorElevationM: 0,
            },
            'sub-td-01': {
                horizontalLengthM: 0,
                verticalLengthM: 0,
                mountingHeightM: 1.8,
                ceilingRiseM: 1.7,
                x: 5,
                y: 0,
                sceneId: 'piso-2',
                // Piso 2 está 3.5 m por encima del nivel de piso 1 (techo de
                // piso 1 a 1.7 m sobre el TD + 1.8 m de subida al Sub-TD-01).
                floorElevationM: 3.5,
            },
        };
        const derived = deriveAutoEdgeLength(
            { horizontalLengthM: 0 },
            { type: 'module_panel_port', deviceId: 'td-piso-1' },
            { deviceId: 'sub-td-01' },
            geometry,
        );
        expect(derived).not.toBeNull();
        expect(derived!.verticalLengthM).toBeCloseTo(3.5);
        expect(derived!.horizontalLengthM).toBeCloseTo(5);
        expect(derived!.lengthMode).toBe('plan');
    });

    it('sin geometría publicada para el destino, no hay suficiente información: devuelve null y el llamador no debe tocar el valor existente', () => {
        const derived = deriveAutoEdgeLength(
            { horizontalLengthM: 50 },
            { type: 'module_panel_port', deviceId: 'td-piso-1' },
            { deviceId: 'panel-sin-datos' },
            {},
        );
        expect(derived).toBeNull();
    });
});
