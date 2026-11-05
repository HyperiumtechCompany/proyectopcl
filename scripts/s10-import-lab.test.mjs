import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { proposeHierarchyCorrections, previewWorkbook, buildLabReport, renderLabReport, loadProjectFunctions, runLab } from './s10-import-lab.mjs';

function workbook(groupCode = 1.1) {
    const rows = [
        ['Item', 'Descripción', 'Unid.', 'Cant.', 'Precio', 'Parcial'],
        [1, 'PROYECTO'],
        [1.1, 'OBRAS PROVISIONALES'],
        ['1.1.1', 'OFICINA', 'm²', 1, 10, 10],
        [groupCode, 'MITIGACION DE IMPACTO AMBIENTAL'],
        ['1.10.1', 'PREVENCION'],
        ['1.10.1.1', 'SEÑALIZACION', 'und', 1, 20, 20],
        ['1.10.2', 'CONTINGENCIAS'],
        ['1.10.2.1', 'CAPACITACION', 'und', 1, 30, 30],
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Sheet');
    return book;
}

test('recovers only the numeric group supported by its children; original workbook remains intact', () => {
    const book = workbook();
    const before = JSON.stringify(book);
    const proposals = proposeHierarchyCorrections(book);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].cell, 'A5');
    assert.equal(proposals[0].suggestedCode, '1.10');
    assert.deepEqual(proposals[0].evidence.map((child) => child.code), ['1.10.1', '1.10.2']);
    const copy = previewWorkbook(book, proposals);
    const { parseS10PresupuestoWorkbook } = loadProjectFunctions();
    const parsed = parseS10PresupuestoWorkbook(copy);
    const first = parsed.rows.find((row) => row.partida === '1.1');
    const tenth = parsed.rows.find((row) => row.partida === '1.10');
    assert.equal(first.descripcion, 'OBRAS PROVISIONALES');
    assert.equal(tenth.descripcion, 'MITIGACION DE IMPACTO AMBIENTAL');
    assert.equal(parsed.rows.find((row) => row.partida === '1.1.1').parent_id, first.id);
    assert.equal(parsed.rows.find((row) => row.partida === '1.10.1').parent_id, tenth.id);
    assert.equal(parsed.rows.find((row) => row.partida === '1.10.2').parent_id, tenth.id);
    assert.deepEqual(parsed.warnings, []);
    assert.equal(JSON.stringify(book), before);
});

test('valid textual 1.10 and a numeric cell already formatted as 1.10 are preserved', () => {
    assert.deepEqual(proposeHierarchyCorrections(workbook('1.10')), []);
    const book = workbook();
    book.Sheets.Sheet.A5.w = '1.10';
    assert.deepEqual(proposeHierarchyCorrections(book), []);
});

test('does not reinterpret textual duplicates or guess with only one child', () => {
    assert.deepEqual(proposeHierarchyCorrections(workbook('1.1')), []);
    const book = workbook();
    book.Sheets.Sheet.A8.v = '1.11.2';
    assert.deepEqual(proposeHierarchyCorrections(book), []);
});

function analysis(code, price, extra = {}) {
    return {
        kind: 'main', partida_code: code, partida_desc: 'OFICINA', unidad: 'm²',
        page: 1, rendimiento: null, declared_cost: price,
        mano_de_obra: [], materiales: [], equipos: [], subcontratos: [], subpartidas: [],
        ...extra,
    };
}

test('unsupported percentages, unknown rendimiento and rounding remain visible without mutating source values', () => {
    const main = analysis('1.1.1', 10, {
        mano_de_obra: [{ codigo: '390010001', descripcion: 'INSTALACION', unidad: '%mt', cantidad: 3, precio_unitario: 100, page: 1 }],
    });
    const pdf = { pages: 1, empty_pages: [], issues: [], analyses: [main, analysis('CU0010012', 10, { kind: 'auxiliary' })] };
    const before = JSON.stringify(pdf);
    const report = buildLabReport(workbook('1.10'), pdf);
    assert.equal(report.canPersist, false);
    assert.equal(report.summary.mainAnalyses, 1);
    assert.equal(report.summary.auxiliaryAnalyses, 1);
    assert.equal(report.summary.unsupportedPercentages, 1);
    assert.equal(report.summary.missingRendimiento, 1);
    assert.equal(report.summary.unmatchedBudget, 2);
    assert.equal(report.comparisons[0].calculatedCost, 300);
    assert.equal(report.unsupportedPercentages[0].component.cantidad, 3);
    assert.equal(JSON.stringify(pdf), before);
});

test('duplicate destinations do not count as successful matches', () => {
    const pdf = { pages: 1, empty_pages: [], issues: [], analyses: [analysis('1.1.1', 10), analysis('01.01.01', 10)] };
    const report = buildLabReport(workbook('1.10'), pdf);
    assert.equal(report.summary.ambiguousMatches, 2);
    assert.equal(report.summary.matched, 0);
});

test('rounding differences are reported without replacing the Excel or PDF price', () => {
    const book = workbook('1.10');
    book.Sheets.Sheet.E4.v = 101.08;
    const pdf = { pages: 1, empty_pages: [], issues: [], analyses: [analysis('1.1.1', 101.08, {
        materiales: [{ descripcion: 'MATERIAL', unidad: 'und', cantidad: 1, precio_unitario: 101.071403, factor_desperdicio: 1 }],
    })] };
    const report = buildLabReport(book, pdf);
    assert.equal(report.summary.declaredPriceDifferences, 0);
    assert.equal(report.summary.calculationDifferences, 1);
    assert.equal(report.comparisons[0].calculatedCostRounded, 101.07);
    assert.equal(report.comparisons[0].excelPrice, 101.08);
    assert.equal(report.comparisons[0].declaredCost, 101.08);
});

test('report escapes source descriptions instead of treating them as HTML', () => {
    const pdf = { pages: 1, empty_pages: [], issues: [], analyses: [analysis('1.1.1', 10, { partida_desc: '<script>alert(1)</script>' })] };
    const html = renderLabReport(buildLabReport(workbook('1.10'), pdf));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('Python PDF parser unit tests', () => {
    execFileSync('python', [resolve('scripts/s10_import_pdf_test.py')], {
        encoding: 'utf8', windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
});

const pdf = resolve('planes/costos/ACU VETERINARIA OK.pdf');
const budget = resolve('planes/costos/1. PRESUPUESTO TOTAL VETERINARIA OK.xls');
test('original Veterinaria files: complete matching, isolated hierarchy repair and six percentages identified', {
    skip: !existsSync(pdf) || !existsSync(budget), timeout: 120_000,
}, async () => {
    const originals = await Promise.all([readFile(pdf), readFile(budget)]);
    const output = await mkdtemp(join(tmpdir(), 's10-import-lab-test-'));
    try {
        const report = await runLab({ pdf, budget, output });
        assert.equal(report.summary.pages, 616);
        assert.equal(report.summary.mainAnalyses, 3100);
        assert.equal(report.summary.auxiliaryAnalyses, 25);
        assert.equal(report.summary.components, 16711);
        assert.equal(report.summary.matched, 3100);
        assert.equal(report.summary.unmatchedPdf, 0);
        assert.equal(report.summary.unmatchedBudget, 0);
        assert.equal(report.summary.declaredPriceDifferences, 0);
        assert.equal(report.summary.unsupportedPercentages, 6);
        assert.equal(report.summary.calculationDifferences, 882);
        assert.equal(report.summary.extractionIssues, 51);
        assert.equal(report.extractionIssues.filter((issue) => issue.kind === 'missing_unit').length, 50);
        assert.equal(report.extractionIssues.filter((issue) => issue.kind === 'component_partial_difference').length, 1);
        assert.equal(report.summary.budgetTotal, 31708502.4);
        assert.equal(report.hierarchy.proposals.length, 1);
        assert.equal(report.hierarchy.proposals[0].cell, 'A4511');
        assert.equal(report.hierarchy.previewRows, 4533);
        assert.deepEqual(report.hierarchy.previewWarnings, []);
        assert.equal(report.canPersist, false);
        assert.equal(report.hierarchy.groups.find((group) => group.code === '1.10.2').parent, '1.10');
        assert.match(await readFile(join(output, 'informe.html'), 'utf8'), /Solo lectura/);
        const after = await Promise.all([readFile(pdf), readFile(budget)]);
        assert.ok(originals.every((bytes, index) => bytes.equals(after[index])));
    } finally {
        // Solo archivos conocidos de este directorio temporal; no hay borrado recursivo.
        for (const name of ['informe.json', 'informe.html']) await unlink(join(output, name)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
        await rmdir(output);
    }
});
