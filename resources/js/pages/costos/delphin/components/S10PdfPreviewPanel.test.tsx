import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { S10PdfPreview } from '../helpers/previewS10Pdf';
import { S10PdfPreviewPanel } from './S10PdfPreviewPanel';

const empty: S10PdfPreview = {
    pages: 1,
    auxiliaryCount: 0,
    issues: [],
    entries: [],
    applicableMatches: [],
};

it('no offers applying an empty or incompatible PDF and keeps observations available', () => {
    const onInclude = vi.fn();
    const html = renderToStaticMarkup(
        <S10PdfPreviewPanel
            preview={{
                ...empty,
                issues: [
                    {
                        code: '1.1',
                        page: 1,
                        kind: 'missing_unit',
                        message: 'Unidad vacía',
                    },
                ],
            }}
            included={false}
            disabled={false}
            onInclude={onInclude}
        />,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('Unidad vacía');
    expect(onInclude).not.toHaveBeenCalled();
});

it('escapes PDF content in the inspector', () => {
    const html = renderToStaticMarkup(
        <S10PdfPreviewPanel
            preview={{
                ...empty,
                issues: [
                    {
                        code: '1.1',
                        page: 1,
                        kind: 'unrecognized_text',
                        message: '<script>alert(1)</script>',
                    },
                ],
            }}
            included={false}
            disabled={false}
            onInclude={() => {}}
        />,
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
});
