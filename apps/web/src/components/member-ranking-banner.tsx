'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useMemberContentType } from '@/components/member-content-type-context';
import { buildLeaderboardHref, buildMemberHref, formatDataDate, getEraRange, type BenchmarkEra } from '@/lib/benchmark-scope';
import type { ContentTypeScore } from '@nexus-score/core';

export interface NearbyPublisher {
  id: number;
  name: string;
  rank: number;
  score: number;
}

export interface RankingData {
  score: number;
  rank: number;
  totalPublishers: number;
  percentile: number;
  nearbyPublishers: NearbyPublisher[];
  topGap: number | null;
}

interface MemberRankingBannerProps {
  historical: RankingData | null;
  current: RankingData | null;
  historicalByContentType: Record<string, RankingData>;
  currentByContentType: Record<string, RankingData>;
  contentTypeLabels: Record<string, string>;
  benchmarkGeneratedAt: string | null;
  currentBenchmarkGeneratedAt: string | null;
  liveOverallScore: number;
  liveCurrentScore: number | null;
  contentTypeScores: ContentTypeScore[] | null;
  aggregateBenchmarkAvailable: boolean;
}

interface RankingPanelProps {
  title: string;
  subtitle: string;
  ranking: RankingData | null;
  era: BenchmarkEra;
  contentType: string;
  contentTypeLabel: string | null;
  active: boolean;
  generatedAt: string | null;
  liveScore: number | null;
}

function formatSnapshot(value: string | null): string {
  if (!value) return 'Snapshot date unavailable';
  return `Snapshot ${formatDataDate(value)}`;
}

function RankingPanel({
  title,
  subtitle,
  ranking,
  era,
  contentType,
  contentTypeLabel,
  active,
  generatedAt,
  liveScore,
}: RankingPanelProps) {
  const current = era === 'current';
  const scope = { era, contentType } as const;

  return (
    <section className={cn(
      'flex min-w-0 flex-col p-4 sm:p-6',
      current && 'bg-blue-50/70',
      active && 'inset-ring-2 inset-ring-blue-500'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('text-xs font-semibold uppercase tracking-wide', current ? 'text-blue-700' : 'text-gray-700')}>{title}</p>
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        </div>
        {active && <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold uppercase text-white">Emphasis</span>}
      </div>

      {ranking ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <p className={cn('text-2xl font-bold sm:text-3xl', current ? 'text-blue-700' : 'text-gray-900')}>{ranking.score}</p>
              <p className="text-xs text-gray-500">index / 100</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 sm:text-3xl">#{ranking.rank.toLocaleString()}</p>
              <p className="text-xs text-gray-500">of {ranking.totalPublishers.toLocaleString()}{contentTypeLabel && ' with this type'}</p>
            </div>
            <div className="text-right">
              <p className={cn('text-xl font-bold sm:text-2xl', ranking.percentile >= 90 ? 'text-green-600' : ranking.percentile >= 50 ? 'text-blue-600' : 'text-gray-600')}>
                Top {Math.max(1, 100 - ranking.percentile)}%
              </p>
              <p className="text-xs text-gray-500">percentile</p>
            </div>
          </div>

          {liveScore !== null && liveScore !== ranking.score && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              Live profile: <strong>{liveScore}/100</strong>. Benchmark position #{ranking.rank.toLocaleString()} belongs to the snapshot value {ranking.score}/100 and has not been recalculated.
            </p>
          )}

          {ranking.nearbyPublishers.length > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <p className="mb-2 text-xs font-medium text-gray-500">Nearby snapshot values</p>
              <div className="space-y-1.5">
                {ranking.nearbyPublishers.slice(0, 2).map((publisher) => (
                  <Link
                    key={publisher.id}
                    href={buildMemberHref(publisher.id, scope)}
                    className="flex min-w-0 items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-white"
                  >
                    <span className="font-semibold">#{publisher.rank}</span>
                    <span className="min-w-0 flex-1 truncate">{publisher.name}</span>
                    <span className="text-gray-500">{publisher.score}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">No {title.toLowerCase()} benchmark is available for this scope.</p>
      )}

      <p className="mt-3 text-[11px] text-gray-400">{formatSnapshot(generatedAt)}</p>
      {ranking && (
        <Link href={buildLeaderboardHref(scope)} className={cn('mt-auto pt-4 text-sm font-medium hover:underline', current ? 'text-blue-700' : 'text-gray-700')}>
          Explore {title.toLowerCase()} benchmark -&gt;
        </Link>
      )}
    </section>
  );
}

export function MemberRankingBanner({
  historical,
  current,
  historicalByContentType,
  currentByContentType,
  contentTypeLabels,
  benchmarkGeneratedAt,
  currentBenchmarkGeneratedAt,
  liveOverallScore,
  liveCurrentScore,
  contentTypeScores,
  aggregateBenchmarkAvailable,
}: MemberRankingBannerProps) {
  const { contentTypeFilter, era } = useMemberContentType();
  const filtered = contentTypeFilter !== 'all';
  const contentTypeLabel = filtered ? contentTypeLabels[contentTypeFilter] ?? contentTypeFilter : null;
  const selectedScorable = filtered ? contentTypeScores?.find((entry) => entry.type === contentTypeFilter)?.scorable !== false : true;
  const overallRanking = filtered && selectedScorable ? historicalByContentType[contentTypeFilter] ?? null : aggregateBenchmarkAvailable ? historical : null;
  const currentRanking = filtered && selectedScorable ? currentByContentType[contentTypeFilter] ?? null : aggregateBenchmarkAvailable ? current : null;
  const range = getEraRange();
  const selectedLive = filtered ? contentTypeScores?.find((entry) => entry.type === contentTypeFilter) : null;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-brand-mist px-4 py-4 sm:px-6">
        <h2 className="font-semibold text-gray-900">Benchmark comparison</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {contentTypeLabel
            ? selectedScorable ? `${contentTypeLabel} compared like-for-like.` : `${contentTypeLabel} are not benchmarked because their schema does not support the same 11 metrics.`
            : 'All Benchmarked Content Types compared across the all-years and Current eras.'}
        </p>
        {!filtered && !aggregateBenchmarkAvailable && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Compatible aggregate benchmark positions are not available. Live supported-type values remain available below; positions return when a compatible snapshot includes this member.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 divide-y divide-gray-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <RankingPanel
          title="Overall"
          subtitle="All years"
          ranking={overallRanking}
          era="overall"
          contentType={contentTypeFilter}
          contentTypeLabel={contentTypeLabel}
          active={era === 'overall'}
          generatedAt={benchmarkGeneratedAt}
          liveScore={selectedLive?.score ?? (filtered ? null : liveOverallScore)}
        />
        <RankingPanel
          title="Current"
          subtitle={`${range.currentStart}-${range.currentEnd}`}
          ranking={currentRanking}
          era="current"
          contentType={contentTypeFilter}
          contentTypeLabel={contentTypeLabel}
          active={era === 'current'}
          generatedAt={currentBenchmarkGeneratedAt}
          liveScore={selectedLive?.current?.score ?? (filtered ? null : liveCurrentScore)}
        />
      </div>
    </section>
  );
}
