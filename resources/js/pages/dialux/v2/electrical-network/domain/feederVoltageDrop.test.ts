import { describe, expect, it } from 'vitest';
import { voltageDropPct } from '@/pages/dialux/electrical/engine/formulas';
import { calculateElectricalNetwork } from './calculations';
import { conductorResistivity, feederVoltageDrop } from './feederVoltageDrop';
import type { ElectricalNetworkData } from './types';

describe('feederVoltageDrop (IEC 60364-5-52 Anexo G)', () => {
    it('caso resuelto a mano: 100 A, 100 m, 50 mm² Cu a 20 °C, fp 0.9, 3Φ 380 V', () => {
        // ρ = 1/58; R·cosφ = 0.017241·0.9/50 = 3.10345e-4 Ω/m
        // X·sinφ = 0.08e-3·0.43589 = 3.48712e-5 Ω/m → 3.45216e-4 Ω/m
        // ΔV = √3·100·100·3.45216e-4 = 5.97932 V → 1.5735 %
        const { dropV, dropPercent } = feederVoltageDrop({
            currentA: 100,
            lengthM: 100,
            sectionMm2: 50,
            voltageV: 380,
            phases: 3,
            material: 'cobre',
            powerFactor: 0.9,
            temperatureC: 20,
        });
        expect(dropV).toBeCloseTo(5.97932, 4);
        expect(dropPercent).toBeCloseTo(1.57351, 4);
    });

    it('con fp = 1 se reduce al término resistivo puro √3·ρ·L·I/S', () => {
        const { dropV } = feederVoltageDrop({
            currentA: 40,
            lengthM: 80,
            sectionMm2: 16,
            voltageV: 380,
            phases: 3,
            material: 'cobre',
            powerFactor: 1,
            temperatureC: 20,
        });
        expect(dropV).toBeCloseTo((Math.sqrt(3) * (1 / 58) * 80 * 40) / 16, 9);
    });

    it('monofásico usa b = 2 y la reactancia pesa más en secciones grandes', () => {
        const at = (sectionMm2: number) =>
            feederVoltageDrop({
                currentA: 50,
                lengthM: 100,
                sectionMm2,
                voltageV: 220,
                phases: 1,
                material: 'cobre',
                powerFactor: 0.9,
                temperatureC: 40,
            }).dropV;
        const reactiveShare = (sectionMm2: number) =>
            (2 * 50 * 100 * 0.08e-3 * Math.sqrt(1 - 0.81)) / at(sectionMm2);
        expect(reactiveShare(95)).toBeGreaterThan(reactiveShare(4) * 10);
    });

    it('la resistividad del cobre coincide con la del motor CT de la V1 a la misma temperatura', () => {
        expect(conductorResistivity('cobre', 40)).toBeCloseTo(
            (1 / 58) * (1 + 0.00393 * 20),
            12,
        );
        expect(conductorResistivity('aluminio', 20)).toBeCloseTo(0.02826, 12);
    });

    it('frente al método anterior (sin cos φ ni reactancia) ya no sobrestima en secciones chicas', () => {
        const previous = voltageDropPct(20, 50, 4, 220, 1, 'cobre');
        const iec = feederVoltageDrop({
            currentA: 20,
            lengthM: 50,
            sectionMm2: 4,
            voltageV: 220,
            phases: 1,
            material: 'cobre',
            powerFactor: 0.9,
            temperatureC: 20,
        }).dropPercent;
        expect(iec).toBeLessThan(previous);
    });
});

describe('cascada 3Φ → 1Φ en la red (acumulación en %)', () => {
    it('el % acumulado es la suma exacta de % y no suma voltios de bases distintas', () => {
        // Suministro → TG (3Φ 380 V, 100 m, 50 mm²) → sub tablero 1Φ 220 V (50 m, 4 mm²)
        // con 3960 W de carga (= 20 A en 1Φ a 220 V y fp 0.9).
        const network: ElectricalNetworkData = {
            schemaVersion: 1,
            rootNodeId: 'svc',
            settings: {
                nominalVoltageV: 380,
                phases: 3,
                connectionType: 'star',
                frequencyHz: 60,
                conductorMaterial: 'copper',
                workingTemperatureC: 20,
                defaultPowerFactor: 0.9,
                feederDropLimitPercent: 2.5,
                totalDropLimitPercent: 4,
            },
            nodes: [
                { id: 'svc', type: 'service', label: 'S', position: { x: 0, y: 0 } },
                { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 } },
                { id: 'td', type: 'site_panel', label: 'TD', phases: 1, nominalVoltageV: 220, position: { x: 0, y: 0 } },
            ],
            edges: [
                { id: 'a', sourceNodeId: 'svc', targetNodeId: 'tg', lengthMode: 'manual', horizontalLengthM: 100, verticalLengthM: 0, conductorType: 'N2XOH', conductorMaterial: 'copper', sectionMm2: 50, wireConfiguration: '3F+N+T', powerFactor: 0.9 },
                { id: 'b', sourceNodeId: 'tg', targetNodeId: 'td', lengthMode: 'manual', horizontalLengthM: 50, verticalLengthM: 0, conductorType: 'N2XOH', conductorMaterial: 'copper', sectionMm2: 4, wireConfiguration: 'F+N+T', powerFactor: 0.9 },
            ],
        };
        const calcs = calculateElectricalNetwork(
            network,
            [],
            [],
            new Map([['td', { installed: 3960, demand: 3960 }]]),
        );
        const tramo3 = feederVoltageDrop({
            currentA: 3960 / (Math.sqrt(3) * 380 * 0.9),
            lengthM: 100,
            sectionMm2: 50,
            voltageV: 380,
            phases: 3,
            material: 'cobre',
            powerFactor: 0.9,
            temperatureC: 20,
        });
        const tramo1 = feederVoltageDrop({
            currentA: 20,
            lengthM: 50,
            sectionMm2: 4,
            voltageV: 220,
            phases: 1,
            material: 'cobre',
            powerFactor: 0.9,
            temperatureC: 20,
        });
        const td = calcs.find((item) => item.edgeId === 'b')!;
        expect(td.currentA).toBeCloseTo(20, 9);
        expect(td.accumulatedVoltageDropPercent).toBeCloseTo(
            tramo3.dropPercent + tramo1.dropPercent,
            9,
        );
        // El método anterior (sumar voltios 3Φ + 1Φ y dividir entre 220) sobrestimaba.
        const mixedVolts = ((tramo3.dropV + tramo1.dropV) / 220) * 100;
        expect(td.accumulatedVoltageDropPercent).toBeLessThan(mixedVolts);
        // Voltios acumulados expresados en la base del tablero receptor (220 V).
        expect(td.accumulatedVoltageDropV).toBeCloseTo(
            (td.accumulatedVoltageDropPercent / 100) * 220,
            9,
        );
    });
});
