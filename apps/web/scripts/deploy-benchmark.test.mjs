import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { deployBenchmark, readSnapshots } from './deploy-benchmark.mjs';

const snapshots = ['overall', 'current'].map((era) => ({
  era, generatedAt: '2026-10-15T10:45:14.235Z', totalMembers: 10, count: era === 'overall' ? 8 : 6,
}));

async function serverFor(t, handler) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.setHeader('Content-Type', 'application/json');
    handler(request, response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return { base: `http://127.0.0.1:${server.address().port}`, requests };
}

function liveResponse(era) {
  const snapshot = snapshots.find((entry) => entry.era === era);
  return {
    generatedAt: snapshot.generatedAt,
    totalMembers: snapshot.totalMembers,
    total: snapshot.count,
    summary: { scopeTotal: snapshot.count },
    leaderboard: [{ id: 1 }],
  };
}

test('deploys once and waits for both public eras, bypassing stale CDN keys', async (t) => {
  let currentRequests = 0;
  const { base, requests } = await serverFor(t, (request, response) => {
    if (request.url === '/hook') return response.end(JSON.stringify({ job: { id: 'deployment', state: 'PENDING' } }));
    const url = new URL(request.url, 'http://localhost');
    assert.equal(url.pathname, '/api/leaderboard');
    assert.equal(url.searchParams.get('contentType'), 'all');
    assert.equal(url.searchParams.get('limit'), '1');
    assert.ok(url.searchParams.get('_snapshot'));
    assert.equal(request.headers['cache-control'], 'no-cache');
    const era = url.searchParams.get('era');
    const data = liveResponse(era);
    if (era === 'current' && ++currentRequests === 1) data.generatedAt = '2026-10-01T00:00:00.000Z';
    response.end(JSON.stringify(data));
  });
  await deployBenchmark({ hook: `${base}/hook`, dashboardUrl: base, snapshots, intervalMs: 1, timeoutMs: 2000, log() {} });
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
  assert.ok(currentRequests >= 2);
});

test('fails if one era has the correct date but incomplete publisher counts', async (t) => {
  const { base } = await serverFor(t, (request, response) => {
    if (request.url === '/hook') return response.end(JSON.stringify({ job: { id: 'deployment' } }));
    const era = new URL(request.url, 'http://localhost').searchParams.get('era');
    const data = liveResponse(era);
    if (era === 'current') data.total = 1;
    response.end(JSON.stringify(data));
  });
  await assert.rejects(deployBenchmark({ hook: `${base}/hook`, dashboardUrl: base, snapshots, intervalMs: 1, timeoutMs: 100, log() {} }), /did not publish/);
});

test('a rejected hook fails immediately without exposing the hook credential', async (t) => {
  const { base, requests } = await serverFor(t, (_request, response) => {
    response.statusCode = 403;
    response.end('secret hook response');
  });
  await assert.rejects(deployBenchmark({ hook: `${base}/secret-hook`, dashboardUrl: base, snapshots }), {
    message: 'Vercel deploy hook returned HTTP 403.',
  });
  assert.equal(requests.length, 1);
});

test('missing deployment configuration fails before making a request', async () => {
  await assert.rejects(deployBenchmark({ dashboardUrl: 'https://example.com', snapshots }), /VERCEL_DEPLOY_HOOK is required/);
});

test('sends CI identity only to the configured production verification origin', async (t) => {
  const { base } = await serverFor(t, (request, response) => {
    if (request.url === '/hook') {
      assert.equal(request.headers['x-vercel-trusted-oidc-idp-token'], undefined);
      return response.end(JSON.stringify({ job: { id: 'deployment' } }));
    }
    assert.equal(request.headers['x-vercel-trusted-oidc-idp-token'], 'short-lived-test-token');
    const era = new URL(request.url, 'http://localhost').searchParams.get('era');
    response.end(JSON.stringify(liveResponse(era)));
  });
  await deployBenchmark({ hook: `${base}/hook`, dashboardUrl: 'https://public.example.com', verificationUrl: base, oidcToken: 'short-lived-test-token', snapshots, timeoutMs: 2000, log() {} });
});

test('refuses to forward CI identity to a redirected origin', async (t) => {
  const { base, requests } = await serverFor(t, (request, response) => {
    if (request.url === '/hook') return response.end(JSON.stringify({ job: { id: 'deployment' } }));
    response.writeHead(302, { Location: `${base}/redirect-target` });
    response.end();
  });
  await assert.rejects(deployBenchmark({ hook: `${base}/hook`, dashboardUrl: base, oidcToken: 'short-lived-test-token', snapshots, timeoutMs: 100, intervalMs: 1, log() {} }), /did not publish/);
  assert.ok(requests.every((request) => request.url !== '/redirect-target'));
});

test('validates both saved snapshots before deployment', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'benchmark-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const data = { generatedAt: snapshots[0].generatedAt, totalMembers: 10, totalWithWorks: 2, totalActive: 2, leaderboard: [{ id: 1 }, { id: 2 }] };
  writeFileSync(join(directory, 'leaderboard.json'), JSON.stringify(data));
  writeFileSync(join(directory, 'current-leaderboard.json'), JSON.stringify(data));
  assert.equal(readSnapshots(directory).length, 2);
  writeFileSync(join(directory, 'current-leaderboard.json'), JSON.stringify({ ...data, leaderboard: [] }));
  assert.throws(() => readSnapshots(directory), /Invalid current snapshot/);
});
