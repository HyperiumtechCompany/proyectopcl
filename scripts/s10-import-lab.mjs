// Laboratorio local: solo lee archivos y genera un informe. No usa rutas HTTP ni BD.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import Decimal from 'decimal.js';
import ts from 'typescript';
import * as XLSX from 'xlsx';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runFile = promisify(execFile);
const componentSections = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'];
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const canonical = (code) => code.split('.').map((part) => String(Number(part))).join('.');
const rounded = (value) => new Decimal(value).toDecimalPlaces(2).toNumber();
const sum = (values) => values.reduce((total, value) => total.plus(value), new Decimal(0)).toNumber();

// Ejecuta únicamente exports conocidos del código fuente del proyecto. Los imports de tipos
// desaparecen en la transpilación; los hooks React no se montan ni disparan efectos/peticiones.
function projectExports(relativePath) {
    const filename = join(root, relativePath);
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports = {};
    new Function('require', 'exports', outputText)(createRequire(filename), exports);
    return exports;
}

export function loadProjectFunctions() {
    return {
        ...projectExports('resources/js/pages/costos/delphin/helpers/parseS10Excel.ts'),
        ...projectExports('resources/js/pages/costos/delphin/helpers/matchAcuToPartida.ts'),
        ...projectExports('resources/js/pages/costos/presupuesto/hooks/usePresupuestoAcu.ts'),
    };
}

function codeOf(cell) {
    if (!cell) return '';
    const text = cell.t === 'n' && /^[\d.]+$/.test(cell.w ?? '') ? cell.w : String(cell.v ?? '');
    return /^\d+(\.\d+)*$/.test(text) ? text : '';
}

function budgetEntries(workbook) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) return [];
    const entries = [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    let columns;
    for (let row = range.s.r; row <= range.e.r; row++) {
        const values = Array.from({ length: range.e.c + 1 }, (_, col) => sheet[XLSX.utils.encode_cell({ r: row, c: col })]);
        const item = values.findIndex((cell) => normalize(cell?.v) === 'item');
        const description = values.findIndex((cell) => normalize(cell?.v).startsWith('descrip'));
        const unit = values.findIndex((cell) => /^(unid|und)/.test(normalize(cell?.v)));
        if (item >= 0 && description >= 0 && unit >= 0) {
            columns = { item, description, unit };
            continue;
        }
        if (!columns) continue;
        const cell = values[columns.item];
        const code = codeOf(cell);
        if (!code) continue;
        entries.push({
            sheet: sheetName, cell: XLSX.utils.encode_cell({ r: row, c: columns.item }),
            row: row + 1, code, type: cell.t, value: cell.v,
            description: String(values[columns.description]?.v ?? ''),
            unit: String(values[columns.unit]?.v ?? '').trim(),
        });
    }
    return entries;
}

export function proposeHierarchyCorrections(workbook) {
    const entries = budgetEntries(workbook);
    const counts = new Map();
    for (const entry of entries) counts.set(entry.code, (counts.get(entry.code) ?? 0) + 1);
    const proposals = [];
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        // Nunca reinterpretar códigos de texto, partidas con unidad ni un código único.
        if (entry.type !== 'n' || entry.unit || counts.get(entry.code) < 2) continue;
        const next = entries[index + 1];
        if (!next) continue;
        const parts = next.code.split('.');
        const candidate = parts.slice(0, -1).join('.');
        const originalParts = entry.code.split('.');
        if (parts.length !== originalParts.length + 1 || candidate === entry.code || counts.has(candidate)) continue;
        // El único caso inferible aquí es un cero final perdido por conversión numérica,
        // dentro del mismo padre. No fusionar 1.1 y 1.10 ni renumerar otros grupos.
        if (!candidate.endsWith('0') || Number(candidate) !== entry.value ||
            parts.slice(0, -2).join('.') !== originalParts.slice(0, -1).join('.')) continue;
        const evidence = [];
        for (let child = index + 1; child < entries.length; child++) {
            const descendant = entries[child];
            if (!descendant.code.startsWith(candidate + '.')) break;
            if (descendant.code.split('.').length === parts.length) evidence.push({ row: descendant.row, code: descendant.code });
        }
        // Dos hijos directos distintos constituyen evidencia; nunca es una reparación silenciosa.
        if (new Set(evidence.map((child) => child.code)).size < 2) continue;
        proposals.push({
            sheet: entry.sheet, cell: entry.cell, row: entry.row,
            originalCode: entry.code, suggestedCode: candidate,
            description: entry.description, evidence, status: 'proposed_only',
        });
    }
    // Dos propuestas al mismo destino son ambiguas: no elegir arbitrariamente una de ellas.
    return proposals.filter((proposal) => proposals.filter((other) => other.suggestedCode === proposal.suggestedCode).length === 1);
}

export function previewWorkbook(workbook, proposals) {
    const copy = { ...workbook, Sheets: { ...workbook.Sheets } };
    for (const proposal of proposals) {
        copy.Sheets[proposal.sheet] = { ...copy.Sheets[proposal.sheet] };
        const sheet = copy.Sheets[proposal.sheet];
        sheet[proposal.cell] = { ...sheet[proposal.cell], t: 's', v: proposal.suggestedCode, w: proposal.suggestedCode };
    }
    return copy;
}

export function buildLabReport(workbook, pdf, project = loadProjectFunctions()) {
    const proposals = proposeHierarchyCorrections(workbook);
    const original = project.parseS10PresupuestoWorkbook(workbook);
    const budget = project.parseS10PresupuestoWorkbook(previewWorkbook(workbook, proposals));
    const main = pdf.analyses.filter((analysis) => analysis.kind === 'main');
    const auxiliary = pdf.analyses.filter((analysis) => analysis.kind === 'auxiliary');
    const parents = new Set(budget.rows.map((row) => row.parent_id).filter((id) => id != null));
    const leaves = budget.rows.filter((row) => !parents.has(row.id) && row.unidad.trim());
    // Una clave duplicada es un conflicto aunque el vinculador existente elija un destino.
    const destinations = new Map();
    for (const row of leaves) {
        const key = canonical(row.partida);
        destinations.set(key, [...(destinations.get(key) ?? []), row]);
    }
    const matches = project.matchAcuToPartida(main, leaves);
    const matchedIds = new Set();
    const destinationUses = new Map();
    for (const match of matches) {
        if (match.row) destinationUses.set(match.row.id, (destinationUses.get(match.row.id) ?? 0) + 1);
    }
    const unsupportedPercentages = [];
    const comparisons = matches.map(({ acu, row, method }) => {
        const ambiguous = row && ((destinations.get(canonical(row.partida))?.length ?? 0) > 1 || destinationUses.get(row.id) > 1);
        if (row && !ambiguous) matchedIds.add(row.id);
        const percentageRows = componentSections.flatMap((section) => acu[section]
            .filter((component) => component.unidad.startsWith('%') &&
                !(section === 'equipos' && component.unidad.toLowerCase() === '%mo' && normalize(component.descripcion).includes('herramienta')))
            .map((component) => ({ code: acu.partida_code, page: component.page, section, component })));
        unsupportedPercentages.push(...percentageRows);
        const calculatedCost = project.calculateAcuLocally(acu).costo_unitario_total;
        const declaredCost = acu.declared_cost;
        return {
            code: acu.partida_code, description: acu.partida_desc, page: acu.page,
            target: row?.partida ?? null, method, ambiguous: Boolean(ambiguous),
            excelPrice: row?.precio_unitario ?? null, declaredCost, calculatedCost,
            calculatedCostRounded: rounded(calculatedCost),
            declaredPriceDifference: row && declaredCost != null ? rounded(new Decimal(declaredCost).minus(row.precio_unitario)) : null,
            currentCalculationDifference: declaredCost == null ? null : rounded(new Decimal(rounded(calculatedCost)).minus(declaredCost)),
            unsupportedPercentage: percentageRows.length > 0,
            missingRendimiento: acu.rendimiento == null,
            issues: pdf.issues.filter((issue) => issue.code === acu.partida_code),
        };
    });
    const unmatchedBudget = leaves.filter((row) => !matchedIds.has(row.id)).map((row) => ({ code: row.partida, description: row.descripcion }));
    return {
        mode: 'local_preview_only', canPersist: false,
        summary: {
            pages: pdf.pages, mainAnalyses: main.length, auxiliaryAnalyses: auxiliary.length,
            components: pdf.analyses.reduce((total, analysis) => total + componentSections.reduce((n, section) => n + analysis[section].length, 0), 0),
            budgetItems: leaves.length, matched: comparisons.filter((comparison) => comparison.target && !comparison.ambiguous).length,
            unmatchedPdf: comparisons.filter((comparison) => !comparison.target).length,
            unmatchedBudget: unmatchedBudget.length,
            ambiguousMatches: comparisons.filter((comparison) => comparison.ambiguous).length,
            declaredPriceDifferences: comparisons.filter((comparison) => comparison.declaredPriceDifference !== 0 && comparison.declaredPriceDifference != null).length,
            calculationDifferences: comparisons.filter((comparison) => comparison.currentCalculationDifference !== 0 && comparison.currentCalculationDifference != null).length,
            unsupportedPercentages: unsupportedPercentages.length,
            missingRendimiento: main.filter((analysis) => analysis.rendimiento == null).length,
            extractionIssues: pdf.issues.length, emptyPages: pdf.empty_pages,
            budgetTotal: rounded(sum(leaves.map((row) => row.parcial))),
        },
        hierarchy: {
            proposals, originalWarnings: original.warnings, previewWarnings: budget.warnings,
            originalRows: original.rows.length, previewRows: budget.rows.length,
            groups: budget.rows.filter((row) => ['1.1', '1.10', '1.10.1', '1.10.2'].includes(row.partida))
                .map((row) => ({ code: row.partida, description: row.descripcion, parent: budget.rows.find((parent) => parent.id === row.parent_id)?.partida ?? null })),
        },
        comparisons, unmatchedBudget, unsupportedPercentages,
        extractionIssues: pdf.issues, analyses: pdf.analyses,
    };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currency = (value) => value == null ? '—' : new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function renderLabReport(report) {
    const s = report.summary;
    const issueLabels = {
        missing_unit: 'Unidad vacía en el documento',
        component_partial_difference: 'Cantidad × precio difiere del parcial',
        unread_resource: 'Recurso no leído completamente',
        section_total_difference: 'Componentes no concilian con subtotal',
        analysis_total_difference: 'Subtotales no concilian con costo',
    };
    const issues = report.extractionIssues.map((issue) => `<tr><td>${escapeHtml(issue.code)}</td><td>${issue.page}</td><td>${escapeHtml(issueLabels[issue.kind] ?? issue.kind)}</td><td>${escapeHtml(issue.message)}</td></tr>`).join('');
    const proposals = report.hierarchy.proposals.map((p) => `<li>Fila ${p.row}, ${escapeHtml(p.cell)}: <b>${escapeHtml(p.originalCode)} → ${escapeHtml(p.suggestedCode)}</b> (${escapeHtml(p.description)}). Hijos: ${escapeHtml(p.evidence.map((e) => e.code).join(', '))}. Propuesta sobre copia en memoria.</li>`).join('');
    const groups = report.hierarchy.groups.map((g) => `<li>${escapeHtml(g.code)} · ${escapeHtml(g.description)} · padre ${escapeHtml(g.parent)}</li>`).join('');
    const rows = report.comparisons.map((c) => {
        const observations = [!c.target && 'Sin vínculo', c.ambiguous && 'Vínculo ambiguo', c.unsupportedPercentage && 'Porcentaje incompatible', c.missingRendimiento && 'Sin rendimiento numérico', c.issues.length > 0 && 'Revisar extracción', c.currentCalculationDifference !== 0 && 'Diferencia de cálculo'].filter(Boolean).join('; ') || 'Sin diferencias detectadas';
        return `<tr><td>${escapeHtml(c.code)}</td><td>${escapeHtml(c.description)}</td><td>${c.page}</td><td>${currency(c.excelPrice)}</td><td>${currency(c.declaredCost)}</td><td>${currency(c.calculatedCostRounded)}</td><td>${escapeHtml(observations)}</td></tr>`;
    }).join('');
    return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Laboratorio local S10</title>
<style>body{font:15px system-ui;margin:30px;color:#172033;background:#f6f8fb}main{max-width:1500px;margin:auto}section{background:white;padding:20px;margin:16px 0;border:1px solid #dbe1eb;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:9px;text-align:left;border-bottom:1px solid #dde3ec}th{position:sticky;top:0;background:#e8eef7}td:nth-child(n+4):nth-child(-n+6){text-align:right;white-space:nowrap}input{padding:10px;width:min(650px,90%)}.scroll{overflow:auto;max-height:650px}li{margin:8px 0}strong{color:#804700}</style>
<main><h1>Prueba local: presupuesto Excel + ACU PDF</h1><p><strong>Solo lectura y vista previa. Este reporte no guarda ni modifica proyectos.</strong></p>
<section><h2>Resultados</h2><p>${s.pages} páginas · ${s.mainAnalyses} ACU principales · ${s.auxiliaryAnalyses} auxiliares · ${s.components} componentes</p><p>${s.matched}/${s.budgetItems} partidas vinculadas · ${s.declaredPriceDifferences} diferencias PDF/Excel · ${s.calculationDifferences} diferencias al recalcular a dos decimales</p><p>${s.unsupportedPercentages} porcentajes incompatibles · ${s.missingRendimiento} rendimientos numéricos ausentes · ${s.extractionIssues} observaciones de extracción</p><p>Suma de parciales Excel: S/ ${currency(s.budgetTotal)}. Cálculo actual = simulación con las funciones existentes; no se aplica al presupuesto.</p></section>
<section><h2>Numeración y jerarquía propuestas</h2><ul>${proposals || '<li>No se propusieron correcciones.</li>'}</ul><ul>${groups}</ul><p>Advertencias originales: ${escapeHtml(report.hierarchy.originalWarnings.join(' | ') || 'Ninguna')}. Advertencias tras propuesta: ${escapeHtml(report.hierarchy.previewWarnings.join(' | ') || 'Ninguna')}.</p></section>
<section><details><summary>Observaciones del PDF (${s.extractionIssues})</summary><p>Los valores ausentes o inconsistentes permanecen pendientes; no se completan automáticamente.</p><div class="scroll"><table><thead><tr><th>Partida</th><th>Página</th><th>Observación</th><th>Detalle de origen</th></tr></thead><tbody>${issues}</tbody></table></div></details></section>
<section><h2>Comparar partidas</h2><p>Los importes de origen se conservan; las diferencias y porcentajes quedan pendientes de resolver antes de habilitar un guardado.</p><label>Buscar código, descripción u observación <input id="filter" type="search" placeholder="Ejemplo: 1.6.2.1.1.1 o porcentaje"></label><p id="count">${s.mainAnalyses} filas</p><div class="scroll"><table><thead><tr><th>Partida</th><th>Descripción</th><th>Página</th><th>Precio Excel</th><th>Costo PDF</th><th>Cálculo actual</th><th>Observaciones</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section><h2>Evidencia</h2><p>El archivo informe.json contiene componentes, observaciones y huellas SHA-256 de los originales. Los ${s.auxiliaryAnalyses} análisis auxiliares permanecen separados de las partidas. No hay conexión a la base de datos ni al guardado de la aplicación.</p></section></main>
<script>document.getElementById('filter').addEventListener('input',function(){const query=this.value.toLocaleLowerCase('es');let count=0;for(const row of document.querySelectorAll('tbody tr')){row.hidden=!row.textContent.toLocaleLowerCase('es').includes(query);if(!row.hidden)count++;}document.getElementById('count').textContent=count+' filas';});</script></html>`;
}

export async function runLab({ pdf, budget, output, python = 'python' }) {
    const pdfPath = resolve(pdf), budgetPath = resolve(budget);
    const sources = await Promise.all([readFile(pdfPath), readFile(budgetPath)]);
    const { stdout } = await runFile(python, [join(root, 'scripts/s10_import_pdf.py'), pdfPath], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000, windowsHide: true,
    });
    const workbook = XLSX.read(sources[1]);
    const report = buildLabReport(workbook, JSON.parse(stdout));
    report.sources = [pdfPath, budgetPath].map((filename, index) => ({
        filename, bytes: sources[index].length,
        sha256: createHash('sha256').update(sources[index]).digest('hex'),
    }));
    // Detecta cambios de los originales durante la ejecución antes de publicar resultados.
    for (const source of report.sources) {
        const hash = createHash('sha256').update(await readFile(source.filename)).digest('hex');
        if (hash !== source.sha256) throw new Error('Un archivo de origen cambió durante la lectura. Repite la prueba.');
    }
    const directory = resolve(output);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'informe.json'), JSON.stringify(report, null, 2), 'utf8');
    await writeFile(join(directory, 'informe.html'), renderLabReport(report), 'utf8');
    return report;
}

async function main() {
    const options = {
        pdf: join(root, 'planes/costos/ACU VETERINARIA OK.pdf'),
        budget: join(root, 'planes/costos/1. PRESUPUESTO TOTAL VETERINARIA OK.xls'),
        output: join(root, 'planes/costos/s10-lab-local'),
    };
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
        console.log('npm run s10:lab -- [--pdf archivo.pdf] [--budget archivo.xls] [--output carpeta] [--python ejecutable]');
        return;
    }
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index].replace(/^--/, '');
        if (!['pdf', 'budget', 'output', 'python'].includes(key) || !args[index + 1]) throw new Error('Argumentos inválidos. Usa --help.');
        options[key] = args[index + 1];
    }
    const report = await runLab(options);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`Vista previa: ${join(resolve(options.output), 'informe.html')}`);
    console.log('Solo lectura: no se guardaron datos en la aplicación.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(`Laboratorio S10: ${error.message}`);
        process.exitCode = 1;
    });
}
