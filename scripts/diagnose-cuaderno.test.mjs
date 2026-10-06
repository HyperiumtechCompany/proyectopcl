import assert from 'node:assert/strict';
import test from 'node:test';

import { diagnoseCuaderno } from './diagnose-cuaderno.mjs';

test('public HTML is not proof of authenticated access or accepted terms', async () => {
    const requests = [];
    const report = await diagnoseCuaderno(async (url, options) => {
        requests.push({ url, options });
        return new Response(
            '<app-root></app-root><script src="main.js"></script>',
            {
                headers: { 'content-type': 'text/html; charset=utf-8' },
            },
        );
    });

    assert.equal(requests.length, 2);
    for (const { url, options } of requests) {
        assert.equal(new URL(url).origin, 'https://apps.oece.gob.pe');
        assert.equal(options.method, 'GET');
        assert.equal(options.redirect, 'manual');
        assert.equal(options.credentials, 'omit');
        assert.deepEqual(options.headers, { Accept: 'text/html' });
        assert.equal(options.body, undefined);
    }
    assert.equal(report.publicPagesReachable, true);
    assert.equal(report.authenticatedAccessVerified, false);
    assert.equal(report.phase0Complete, false);
    assert.equal(report.pages[0].clientRendered, true);
    assert.equal(report.pages[0].scriptCount, 1);
    assert.equal(report.pages[1].termsReviewRequired, true);
});

test('redirects are not followed or treated as successful access', async () => {
    const report = await diagnoseCuaderno(
        async () =>
            new Response(null, {
                status: 302,
                headers: { location: 'https://example.com/login' },
            }),
    );

    assert.equal(report.publicPagesReachable, false);
    assert.equal(report.pages[0].status, 302);
    assert.equal(report.phase0Complete, false);
});

test('an HTTP error or non-HTML response does not validate the portal', async () => {
    let calls = 0;
    const report = await diagnoseCuaderno(async () => {
        calls += 1;
        return calls === 1
            ? new Response('Unavailable', { status: 503 })
            : new Response('{}', {
                  headers: { 'content-type': 'application/json' },
              });
    });

    assert.equal(report.publicPagesReachable, false);
    assert.equal(report.pages[0].status, 503);
    assert.equal(report.pages[1].reachable, false);
});

test('a network failure does not expose details or skip the next public page', async () => {
    let calls = 0;
    const report = await diagnoseCuaderno(async () => {
        calls += 1;
        if (calls === 1) {
            throw new Error('Proxy credentials must stay private');
        }
        return new Response('<html>Terms</html>', {
            headers: { 'content-type': 'text/html' },
        });
    });

    assert.equal(calls, 2);
    assert.equal(report.pages[0].error, 'network_or_timeout');
    assert.equal(report.pages[1].reachable, true);
    assert.equal(report.publicPagesReachable, false);
    assert.equal(JSON.stringify(report).includes('Proxy credentials'), false);
});
