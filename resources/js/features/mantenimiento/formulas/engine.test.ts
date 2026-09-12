import { describe, expect, it } from 'vitest';
import cases from '../../../../../tests/Fixtures/Mantenimiento/formula_conformance.json';
import { evaluateFormula, FormulaError } from './engine';

describe('maintenance formula contract', () => {
    it.each(cases)('$name', (testCase) => {
        const run = () => evaluateFormula(testCase.formula, {
            rowValue: (key) => testCase.row[key as keyof typeof testCase.row] ?? '0',
            cellValue: (id) => testCase.cells[id as keyof typeof testCase.cells] ?? '0',
            childrenSum: (key) => testCase.children[key as keyof typeof testCase.children] ?? '0',
            columnSum: (sheet, key) => testCase.columns[`${sheet}:${key}` as keyof typeof testCase.columns] ?? '0',
        });

        if ('error' in testCase) {
            try { run(); throw new Error('La fórmula debía fallar.'); }
            catch (error) { expect(error).toBeInstanceOf(FormulaError); expect((error as FormulaError).code).toBe(testCase.error); }
        } else {
            expect(run().value).toBe(testCase.expected);
        }
    });
});
