#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PUBLIC_PAGES = [
    ['login', 'https://apps.oece.gob.pe/cuaderno-obra/login'],
    ['terms', 'https://apps.oece.gob.pe/cuaderno-obra/terminos-y-condiciones'],
];

// Only public GET requests. No credentials, cookies, redirects or external writes.
export async function diagnoseCuaderno(fetchPage = globalThis.fetch) {
    const pages = [];

    for (const [name, url] of PUBLIC_PAGES) {
        try {
            const response = await fetchPage(url, {
                method: 'GET',
                redirect: 'manual',
                credentials: 'omit',
                signal: AbortSignal.timeout(10000),
                headers: { Accept: 'text/html' },
            });
            const contentType = response.headers.get('content-type') ?? '';
            const html =
                response.ok && contentType.toLowerCase().includes('text/html');
            const body = html ? await response.text() : '';
            const scriptCount = (body.match(/<script\b[^>]*\bsrc\s*=/gi) ?? [])
                .length;
            const clientRendered = /<app-root\b/i.test(body);

            pages.push({
                name,
                url,
                status: response.status,
                contentType,
                reachable: response.ok && html,
                clientRendered,
                scriptCount,
                termsReviewRequired: name === 'terms',
            });
        } catch {
            // Avoid printing error details that could expose proxy configuration.
            pages.push({
                name,
                url,
                reachable: false,
                error: 'network_or_timeout',
                termsReviewRequired: name === 'terms',
            });
        }
    }

    return {
        pages,
        publicPagesReachable: pages.every((page) => page.reachable),
        authenticatedAccessVerified: false,
        phase0Complete: false,
        pending: [
            'Select the pilot project and deployment environment.',
            'Review the complete terms and permitted integration channel.',
            'Verify login and second factor with the account holder.',
            'Identify the exact notebook, role and stable external IDs.',
            'Verify authorized listing, PDF download and location requirements.',
        ],
    };
}

const invokedDirectly =
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
    const report = await diagnoseCuaderno();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.publicPagesReachable ? 0 : 1;
}
