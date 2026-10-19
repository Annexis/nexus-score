import type { Metadata } from 'next';
import { getBenchmarkSnapshots } from '@/lib/benchmark-data';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { DataEnvironmentNotice } from '@/components/data-environment-notice';
import { parseBenchmarkEra, parseContentType } from '@/lib/benchmark-scope';
import { isScorableContentType } from '@nexus-score/core';

export const metadata: Metadata = {
  title: 'Benchmark Explorer - Nexus-Index',
  description: 'Compare Overall and Current Crossref metadata health using one explicit content-type scope.',
};

export const revalidate = 3600;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ era?: string | string[]; contentType?: string | string[] }>;
}) {
  const query = await searchParams;
  const pair = getBenchmarkSnapshots();
  const overall = pair?.overall;
  const current = pair?.current;
  const available = new Map<string, { type: string; label: string; count: number }>();
  for (const entry of [...(overall?.availableContentTypes ?? []), ...(current?.availableContentTypes ?? [])]) {
    const existing = available.get(entry.type);
    if (!existing || entry.count > existing.count) available.set(entry.type, entry);
  }
  const availableContentTypes = [...available.values()]
    .map((entry) => ({ ...entry, benchmarked: isScorableContentType(entry.type) }))
    .sort((a, b) => Number(b.benchmarked) - Number(a.benchmarked) || b.count - a.count);
  const requestedContentType = parseContentType(query.contentType);
  const defaultContentType = availableContentTypes.find((entry) => entry.type === 'journal-article' && entry.benchmarked)?.type
    ?? availableContentTypes.find((entry) => entry.benchmarked)?.type
    ?? 'all';
  const hasExplicitContentType = typeof query.contentType === 'string';
  const initialContentType = !hasExplicitContentType
    ? defaultContentType
    : requestedContentType === 'all' || availableContentTypes.some((entry) => entry.type === requestedContentType && entry.benchmarked)
      ? requestedContentType
      : defaultContentType;

  return (
    <main className="min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-gray-900">Benchmark Explorer</h1>
          <p className="mt-2 text-gray-600">Compare like with like by choosing one content type and one benchmark era. Overall and Current remain one click apart.</p>
          <p className="mt-2 text-sm text-gray-500">This is a diagnostic of metadata visible in Crossref, not publisher or research quality.</p>
        </header>

        <DataEnvironmentNotice className="mt-8" />

        <div className="mt-6">
          <LeaderboardTable
            availableContentTypes={availableContentTypes}
            methodologyCompatible={Boolean(pair)}
            methodologyVersion={overall?.methodologyVersion ?? 'unavailable'}
            snapshotDate={overall?.generatedAt}
            initialEra={parseBenchmarkEra(query.era)}
            initialContentType={initialContentType}
          />
        </div>
      </div>
    </main>
  );
}
