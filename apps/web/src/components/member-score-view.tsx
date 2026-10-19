'use client';

import type { ContentTypeScore, DimensionScores, ScorableMemberScore, TrendInfo } from '@nexus-score/core';
import { DimensionChart } from '@/components/dimension-chart';
import { DimensionRadar } from '@/components/dimension-radar';
import { useMemberContentType } from '@/components/member-content-type-context';
import { cn, formatNumber } from '@/lib/utils';
import { getEraRange } from '@/lib/benchmark-scope';

interface MemberScoreViewProps {
  total: number;
  trend: TrendInfo;
  currentWorks: number;
  backfileWorks: number;
  contentTypeScores: ContentTypeScore[] | null;
  eraDimensions: {
    current: DimensionScores | null;
    backfile: DimensionScores | null;
  } | null;
  scorableScore: ScorableMemberScore | null;
}

function radarValues(value: DimensionScores | null) {
  return value
    ? {
        provenance: value.provenance.percentage,
        people: value.people.percentage,
        organizations: value.organizations.percentage,
        funding: value.funding.percentage,
        access: value.access.percentage,
      }
    : null;
}

export function MemberScoreView({
  total,
  trend,
  currentWorks,
  backfileWorks,
  contentTypeScores,
  eraDimensions,
  scorableScore,
}: MemberScoreViewProps) {
  const { contentTypeFilter, era } = useMemberContentType();
  const selected = contentTypeFilter === 'all'
    ? null
    : contentTypeScores?.find((entry) => entry.type === contentTypeFilter) ?? null;
  const range = getEraRange();
  const selectedIsUnsupported = selected?.scorable === false;
  const scopeLabel = selected?.label ?? 'All Benchmarked Content Types';
  const overallScore = selectedIsUnsupported ? null : selected?.score ?? scorableScore?.all?.score ?? total;
  const overallWorks = selectedIsUnsupported ? selected?.works : selected?.works ?? scorableScore?.all?.works;
  const currentScore = selectedIsUnsupported ? null : selected?.current?.score ?? (selected ? null : (scorableScore ? scorableScore.current?.score ?? null : trend.currentScore));
  const currentScopeWorks = selected?.current?.works ?? (selected ? undefined : scorableScore?.current?.works ?? currentWorks);
  const backfileScore = selectedIsUnsupported ? null : selected?.backfile?.score ?? (selected ? null : (scorableScore ? scorableScore.backfile?.score ?? null : trend.backfileScore));
  const backfileScopeWorks = selected?.backfile?.works ?? (selected ? undefined : scorableScore?.backfile?.works ?? backfileWorks);
  const selectedChange = currentScore !== null && backfileScore !== null
    ? currentScore - backfileScore
    : null;
  const aggregateChange = scorableScore?.current && scorableScore.backfile
    ? scorableScore.current.score - scorableScore.backfile.score
    : trend.change;
  const historicalDimensions = selectedIsUnsupported ? null : selected
    ? selected.backfile?.metricDetails ?? null
    : scorableScore ? scorableScore.backfile?.metricDetails ?? null : eraDimensions?.backfile ?? null;
  const currentDimensions = selectedIsUnsupported ? null : selected
    ? selected.current?.metricDetails ?? null
    : scorableScore ? scorableScore.current?.metricDetails ?? null : eraDimensions?.current ?? null;
  const selectedIsEmpty = selected !== null && selected.scorable && selected.score === 0 &&
    Object.values(selected.dimensions).every((value) => value === 0);
  const trendsDiverge = selectedChange !== null && selectedChange !== 0 && aggregateChange !== null && aggregateChange !== 0 &&
    Math.sign(selectedChange) !== Math.sign(aggregateChange);

  const scoreCards = [
    {
      key: 'overall',
      title: 'Overall',
      period: 'All years',
      score: overallScore,
      works: overallWorks,
      active: era === 'overall',
      className: 'border-gray-300 bg-gray-50',
    },
    {
      key: 'current',
      title: 'Current',
      period: `${range.currentStart}-${range.currentEnd}`,
      score: currentScore,
      works: currentScopeWorks,
      active: era === 'current',
      className: 'border-blue-200 bg-blue-50',
    },
    {
      key: 'backfile',
      title: 'Backfile',
      period: `Before ${range.backfileBefore}`,
      score: backfileScore,
      works: backfileScopeWorks,
      active: false,
      className: 'border-gray-200 bg-white',
    },
  ] as const;

  return (
    <>
      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-6 print:break-before-page">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{scopeLabel} - Index values</h2>
            <p className="mt-1 text-xs text-gray-500">
              Overall is all years. Change is Current minus Backfile. Only Crossref Participation Report work types are benchmarked.
            </p>
          </div>
          {selectedChange !== null && (
            <span className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
              selectedChange > 0 ? 'bg-green-100 text-green-700' : selectedChange < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            )}>
              Current - Backfile: {selectedChange > 0 ? '+' : ''}{selectedChange}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {scoreCards.map((card) => (
            <div
              key={card.key}
              className={cn(
                'rounded-xl border p-4',
                card.className,
                card.active && 'ring-2 ring-blue-500 ring-offset-2'
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{card.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{card.period}</p>
              {card.score === null ? (
                <p className="mt-5 text-sm font-medium text-gray-500">Not available</p>
              ) : (
                <p className={cn('mt-3 text-3xl font-bold', card.key === 'current' ? 'text-blue-700' : 'text-gray-900')}>
                  {card.score}<span className="ml-1 text-base font-normal text-gray-400">/100</span>
                </p>
              )}
              {card.works !== undefined && (
                <p className="mt-1 text-xs text-gray-500">{formatNumber(card.works)} works</p>
              )}
            </div>
          ))}
        </div>

        {trendsDiverge && selectedChange !== null && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Current {scopeLabel.toLowerCase()} {selectedChange > 0 ? 'improved' : 'declined'} by <strong>{Math.abs(selectedChange)} points</strong>, while All Benchmarked Content Types {aggregateChange > 0 ? 'improved' : 'declined'} by <strong>{Math.abs(aggregateChange)} points</strong>. Supported content types can have different metadata coverage patterns, so the selected-type and member-wide stories can move in opposite directions.
          </div>
        )}
      </section>

      {selectedIsUnsupported && selected && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
          <strong>{selected.label} are not benchmarked.</strong> Their Crossref schema does not use the same 11 Participation Report fields, so displaying 0% or an F would be misleading. The {formatNumber(selected.works ?? 0)} registered records remain visible for transparency.
        </div>
      )}

      {!selected && scorableScore?.current && scorableScore.current.excludedWorks > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 shadow-sm">
          The Current index includes <strong>{formatNumber(scorableScore.current.works)} scorable works</strong>. {formatNumber(scorableScore.current.excludedWorks)} other registered records are shown elsewhere on this page but excluded because their Crossref schemas do not support the same 11 metrics.
        </div>
      )}

      {selectedIsEmpty && selected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 shadow-sm">
          {selected.works !== undefined ? `${formatNumber(selected.works)} ` : ''}{selected.label.toLowerCase()} are registered with Crossref, but their 11 scoreable coverage fields are all 0%. This is observed zero coverage, not missing era data.
        </div>
      )}

      <div className="space-y-6">
        <DimensionChart historical={historicalDimensions} current={currentDimensions} scopeLabel={scopeLabel} />
        <DimensionRadar historical={radarValues(historicalDimensions)} current={radarValues(currentDimensions)} scopeLabel={scopeLabel} />
      </div>
    </>
  );
}
