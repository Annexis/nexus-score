import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const scriptPath = fileURLToPath(import.meta.url);

export function readSnapshots(directory) {
  return ['overall', 'current'].map((era) => {
    const filename = era === 'overall' ? 'leaderboard.json' : 'current-leaderboard.json';
    const data = JSON.parse(readFileSync(join(directory, filename), 'utf8'));
    const count = era === 'overall' ? data.totalWithWorks : data.totalActive;
    if (!Number.isFinite(Date.parse(data.generatedAt)) ||
        !Number.isInteger(data.totalMembers) || data.totalMembers < 1 ||
        !Number.isInteger(count) || count < 1 || count > data.totalMembers ||
        !Array.isArray(data.leaderboard) || data.leaderboard.length !== count) {
      throw new Error(`Invalid ${era} snapshot; refusing to deploy.`);
    }
    return { era, generatedAt: data.generatedAt, totalMembers: data.totalMembers, count };
  });
}

export async function deployBenchmark({
  hook,
  dashboardUrl,
  verificationUrl = dashboardUrl,
  oidcToken,
  snapshots,
  timeoutMs = 10 * 60 * 1000,
  intervalMs = 10 * 1000,
  log = console.log,
}) {
  if (!hook) throw new Error('VERCEL_DEPLOY_HOOK is required. See docs/benchmark-automation.md.');
  const dashboard = new URL(dashboardUrl);
  const verification = new URL(verificationUrl);
  if (![dashboard, verification].every((url) => ['https:', 'http:'].includes(url.protocol))) throw new Error('Invalid dashboard URL.');

  // Do not log the hook URL or response body: the URL is a deployment credential.
  let deployment;
  try {
    deployment = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error('Could not reach the Vercel deploy hook. Retry the workflow.');
  }
  if (!deployment.ok) throw new Error(`Vercel deploy hook returned HTTP ${deployment.status}.`);
  let result;
  try {
    result = await deployment.json();
  } catch {
    throw new Error('Vercel returned an invalid deploy-hook response.');
  }
  if (!result.job?.id || ['ERROR', 'CANCELED'].includes(result.job.state)) {
    throw new Error('Vercel did not accept the deployment job.');
  }
  log(`Deployment requested (${result.job.id}). Waiting for both benchmark eras on ${verification.origin}.`);

  const deadline = Date.now() + timeoutMs;
  let status = 'No dashboard response yet.';
  while (Date.now() < deadline) {
    const results = await Promise.all(snapshots.map(async (expected) => {
      const url = new URL('/api/leaderboard', verification);
      url.searchParams.set('era', expected.era);
      url.searchParams.set('contentType', 'all');
      url.searchParams.set('limit', '1');
      // Probe a fresh CDN key rather than accepting a cached pre-deployment response.
      url.searchParams.set('_snapshot', `${expected.generatedAt}-${Date.now()}`);
      try {
        const response = await fetch(url, {
          headers: {
            'Cache-Control': 'no-cache',
            ...(oidcToken ? { 'x-vercel-trusted-oidc-idp-token': oidcToken } : {}),
          },
          // Never forward the verification identity through a domain redirect.
          redirect: 'error',
          signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now()))),
        });
        if (!response.ok) return { matches: false, status: `${expected.era}: HTTP ${response.status}` };
        const actual = await response.json();
        const matches = actual.generatedAt === expected.generatedAt &&
          actual.totalMembers === expected.totalMembers && actual.total === expected.count &&
          actual.summary?.scopeTotal === expected.count && actual.leaderboard?.length === 1;
        return { matches, status: `${expected.era}: ${actual.generatedAt ?? 'missing snapshot'} (${matches ? 'verified' : 'waiting'})` };
      } catch {
        return { matches: false, status: `${expected.era}: dashboard unavailable` };
      }
    }));
    status = results.map((result) => result.status).join('; ');
    log(status);
    if (results.every((result) => result.matches)) return;
    await sleep(Math.max(0, Math.min(intervalMs, deadline - Date.now())));
  }
  throw new Error(`Dashboard did not publish the expected snapshots within ${timeoutMs / 1000}s. ${status}`);
}

async function main() {
  const snapshots = readSnapshots(join(dirname(scriptPath), '..', 'data'));
  const dashboardUrl = process.env.BENCHMARK_DASHBOARD_URL || 'https://www.nexus-index.com';
  await deployBenchmark({
    hook: process.env.VERCEL_DEPLOY_HOOK,
    dashboardUrl,
    verificationUrl: process.env.BENCHMARK_VERIFICATION_URL || dashboardUrl,
    oidcToken: process.env.VERCEL_OIDC_TOKEN,
    snapshots,
  });
  const summary = [
    '## Benchmark dashboard updated',
    '',
    `Dashboard: ${new URL('/leaderboard', dashboardUrl).href}`,
    '',
    ...snapshots.map((snapshot) => `- ${snapshot.era}: ${snapshot.generatedAt}; ${snapshot.count.toLocaleString('en-US')} publishers`),
    '',
    'Both production API snapshots match the committed data.',
    '',
  ].join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
