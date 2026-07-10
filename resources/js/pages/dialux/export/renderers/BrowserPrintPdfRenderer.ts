import type {
    DialuxExportAsset,
    DialuxExportDocument,
    DialuxPdfRenderOptions,
    DialuxPdfRenderResult,
    DialuxPdfRenderer,
    DialuxStructuredAsset,
    DialuxStructuredJsonData,
    DialuxStructuredSummaryData,
    DialuxStructuredTableData,
} from '../domain/types';

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderSummaryAsset(asset: DialuxStructuredAsset): string {
    const data = asset.data as DialuxStructuredSummaryData;

    return `<div class="summary-grid">
        ${data.items
            .map(
                (item) => `<article class="metric-card">
                    <div class="metric-label">${escapeHtml(item.label)}</div>
                    <div class="metric-value">${escapeHtml(item.value)}</div>
                </article>`,
            )
            .join('')}
    </div>`;
}

function renderTableAsset(asset: DialuxStructuredAsset): string {
    const data = asset.data as DialuxStructuredTableData;

    return `<div class="table-wrap">
        <table>
            <thead>
                <tr>
                    ${data.columns
                        .map((column) => `<th>${escapeHtml(column.label)}</th>`)
                        .join('')}
                </tr>
            </thead>
            <tbody>
                ${data.rows
                    .map(
                        (row) => `<tr>
                            ${data.columns
                                .map((column) => {
                                    const rawValue = row[column.key];
                                    const value =
                                        rawValue === null ||
                                        rawValue === undefined
                                            ? '-'
                                            : String(rawValue);
                                    return `<td>${escapeHtml(value)}</td>`;
                                })
                                .join('')}
                        </tr>`,
                    )
                    .join('')}
            </tbody>
        </table>
    </div>`;
}

function renderJsonAsset(asset: DialuxStructuredAsset): string {
    const data = asset.data as DialuxStructuredJsonData;

    return `<pre class="json-block">${escapeHtml(
        JSON.stringify(data.data, null, 2),
    )}</pre>`;
}

function renderStructuredAsset(asset: DialuxStructuredAsset): string {
    switch (asset.data.type) {
        case 'summary':
            return renderSummaryAsset(asset);
        case 'table':
            return renderTableAsset(asset);
        case 'json':
            return renderJsonAsset(asset);
        default:
            return '';
    }
}

function renderVisualAsset(asset: DialuxExportAsset): string {
    if (asset.kind === 'bitmap') {
        return `<figure class="visual-card">
            <img src="${asset.dataUrl}" alt="${escapeHtml(asset.title)}" />
            <figcaption>${escapeHtml(asset.title)}</figcaption>
        </figure>`;
    }

    if (asset.kind === 'vector') {
        return `<figure class="visual-card">
            <div class="svg-wrap">${asset.svg}</div>
            <figcaption>${escapeHtml(asset.title)}</figcaption>
        </figure>`;
    }

    return '';
}

function isStructuredAsset(
    asset: DialuxExportAsset | undefined,
): asset is DialuxStructuredAsset {
    return asset !== undefined && asset.kind === 'structured';
}

function buildHtml(documentModel: DialuxExportDocument): string {
    const assetsById = new Map(
        documentModel.assets.map((asset) => [asset.id, asset]),
    );

    const sectionsMarkup = documentModel.sections
        .map((section) => {
            const visualMarkup = section.visualAssetIds
                .map((assetId) => assetsById.get(assetId))
                .filter((asset): asset is DialuxExportAsset => Boolean(asset))
                .map((asset) => renderVisualAsset(asset))
                .join('');
            const structuredMarkup = section.structuredAssetIds
                .map((assetId) => assetsById.get(assetId))
                .filter(isStructuredAsset)
                .map((asset) => renderStructuredAsset(asset))
                .join('');

            return `<section class="page-section" data-section="${section.kind}">
                <header class="section-head">
                    <h2>${escapeHtml(section.title)}</h2>
                    ${
                        section.description
                            ? `<p>${escapeHtml(section.description)}</p>`
                            : ''
                    }
                </header>
                ${visualMarkup ? `<div class="visual-grid">${visualMarkup}</div>` : ''}
                ${structuredMarkup}
            </section>`;
        })
        .join('');

    const metadataMarkup = documentModel.metadata
        .map(
            (item) => `<div class="metadata-item">
                <span class="metadata-label">${escapeHtml(item.label)}</span>
                <strong class="metadata-value">${escapeHtml(item.value)}</strong>
            </div>`,
        )
        .join('');

    return `<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(documentModel.title)}</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #eef2ff;
            --page: #ffffff;
            --ink: #0f172a;
            --muted: #475569;
            --line: #cbd5e1;
            --accent: #0f766e;
            --accent-soft: #ccfbf1;
            --shadow: rgba(15, 23, 42, 0.08);
        }

        @page {
            size: A4;
            margin: 18mm 14mm 16mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: var(--bg);
            color: var(--ink);
            font-family: "Segoe UI", system-ui, sans-serif;
            line-height: 1.45;
        }

        .document {
            max-width: 1120px;
            margin: 0 auto;
            padding: 24px;
        }

        .cover {
            background: linear-gradient(160deg, #082f49 0%, #0f172a 44%, #134e4a 100%);
            color: #f8fafc;
            border-radius: 24px;
            padding: 42px;
            min-height: 300px;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
        }

        .cover-kicker {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.24em;
            opacity: 0.8;
        }

        .cover h1 {
            margin: 18px 0 8px;
            font-size: 40px;
            line-height: 1.02;
        }

        .cover p {
            margin: 0;
            max-width: 760px;
            color: rgba(248, 250, 252, 0.85);
        }

        .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin: 24px 0 18px;
        }

        .metadata-item {
            background: var(--page);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 14px 16px;
            box-shadow: 0 10px 28px var(--shadow);
        }

        .metadata-label {
            display: block;
            margin-bottom: 6px;
            color: var(--muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
        }

        .metadata-value {
            font-size: 16px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 12px;
            margin: 18px 0;
        }

        .metric-card {
            background: linear-gradient(180deg, #ecfeff 0%, #ffffff 100%);
            border: 1px solid #bfdbfe;
            border-radius: 16px;
            padding: 16px;
        }

        .metric-label {
            color: var(--muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
        }

        .metric-value {
            margin-top: 10px;
            font-size: 24px;
            font-weight: 700;
            color: #0f766e;
        }

        .page-section {
            margin-top: 22px;
            padding: 22px;
            background: var(--page);
            border: 1px solid var(--line);
            border-radius: 22px;
            box-shadow: 0 10px 32px var(--shadow);
            break-inside: avoid;
        }

        .section-head {
            margin-bottom: 18px;
        }

        .section-head h2 {
            margin: 0 0 8px;
            font-size: 24px;
        }

        .section-head p {
            margin: 0;
            color: var(--muted);
            font-size: 14px;
        }

        .visual-grid {
            display: grid;
            gap: 16px;
            margin: 18px 0;
        }

        .visual-card {
            margin: 0;
            border: 1px solid var(--line);
            border-radius: 18px;
            overflow: hidden;
            background: #0f172a;
        }

        .visual-card img,
        .visual-card .svg-wrap svg {
            display: block;
            width: 100%;
            height: auto;
        }

        .visual-card figcaption {
            padding: 10px 14px 12px;
            background: #ffffff;
            color: var(--muted);
            font-size: 13px;
        }

        .table-wrap {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        th,
        td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            vertical-align: top;
        }

        th {
            background: #f8fafc;
            color: var(--muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .json-block {
            overflow: auto;
            padding: 18px;
            border-radius: 18px;
            background: #020617;
            color: #cbd5e1;
            font-size: 11px;
            line-height: 1.5;
        }

        @media print {
            body {
                background: #ffffff;
            }

            .document {
                max-width: none;
                padding: 0;
            }

            .cover,
            .metadata-item,
            .page-section {
                box-shadow: none;
            }

            .page-section {
                break-inside: avoid-page;
            }
        }
    </style>
</head>
<body>
    <main class="document">
        <section class="cover">
            <div class="cover-kicker">DIAlux Web · Exportado PDF</div>
            <h1>${escapeHtml(documentModel.title)}</h1>
            <p>${escapeHtml(documentModel.subtitle)}</p>
        </section>

        <section class="metadata">
            ${metadataMarkup}
        </section>

        ${sectionsMarkup}
    </main>
</body>
</html>`;
}

function renderIntoWindow(
    targetWindow: Window,
    html: string,
    title: string,
    autoPrint: boolean,
) {
    targetWindow.document.open();
    targetWindow.document.write(html);
    targetWindow.document.close();
    targetWindow.document.title = title;

    if (autoPrint) {
        targetWindow.addEventListener(
            'load',
            () => {
                targetWindow.focus();
                targetWindow.print();
            },
            { once: true },
        );
    }
}

function renderIntoHiddenIframe(
    html: string,
    title: string,
    autoPrint: boolean,
): Window {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
        iframe.remove();
        throw new Error(
            'No se pudo crear el contenedor interno de impresion del navegador.',
        );
    }

    renderIntoWindow(frameWindow, html, title, false);

    if (autoPrint) {
        frameWindow.addEventListener(
            'load',
            () => {
                frameWindow.focus();
                frameWindow.print();
                window.setTimeout(() => {
                    iframe.remove();
                }, 1000);
            },
            { once: true },
        );
    }

    return frameWindow;
}

export class BrowserPrintPdfRenderer implements DialuxPdfRenderer {
    async render(
        _documentModel: DialuxExportDocument,
        _options: DialuxPdfRenderOptions = {},
    ): Promise<DialuxPdfRenderResult> {
        throw new Error(
            'BrowserPrintPdfRenderer esta deshabilitado. El export formal de DIAlux ahora se genera como PDF binario desde Laravel.',
        );
    }
}
