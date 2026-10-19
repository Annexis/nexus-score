'use client';

import { useMemberContentType } from '@/components/member-content-type-context';
import { cn, formatNumber } from '@/lib/utils';
import { getEraRange } from '@/lib/benchmark-scope';
import type {
  ContentTypeScore,
  DimensionDetail,
  DimensionScores,
  MetricDetail,
  MetricStatus,
  ScorableMemberScore,
} from '@nexus-score/core';

interface MetricsTableProps {
  contentTypeScores: ContentTypeScore[] | null;
  eraDimensions: { current: DimensionScores | null; backfile: DimensionScores | null } | null;
  currentWorks: number;
  backfileWorks: number;
  scorableScore: ScorableMemberScore | null;
  className?: string;
}

const statusStyles: Record<MetricStatus, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  'needs-work': 'bg-amber-100 text-amber-800',
  poor: 'bg-red-100 text-red-800',
};

const statusLabels: Record<MetricStatus, string> = {
  excellent: 'Excellent',
  good: 'Good',
  'needs-work': 'Needs Work',
  poor: 'Poor',
};

interface ScopedMetric extends MetricDetail {
  dimension: string;
}

function flatten(dimensions: DimensionScores | null): ScopedMetric[] {
  if (!dimensions) return [];
  return (Object.entries(dimensions) as [string, DimensionDetail][]).flatMap(([dimension, detail]) =>
    detail.metrics.map((metric) => ({ ...metric, dimension }))
  );
}

function StatusPill({ status }: { status: MetricStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-1 text-[11px] font-medium', statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}

function MetricEraValue({ metric }: { metric?: ScopedMetric }) {
  if (!metric) return <span className="text-sm font-medium text-gray-400">Not available</span>;
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-gray-900">{(metric.value * 100).toFixed(0)}%</span>
        <span className="text-xs text-gray-500">{metric.contribution.toFixed(1)} / {metric.maxContribution} pts</span>
      </div>
      <div className="mt-1"><StatusPill status={metric.status} /></div>
    </div>
  );
}

export function MetricsTable({
  contentTypeScores,
  eraDimensions,
  currentWorks,
  backfileWorks,
  scorableScore,
  className,
}: MetricsTableProps) {
  const { contentTypeFilter } = useMemberContentType();
  const selected = contentTypeFilter === 'all'
    ? null
    : contentTypeScores?.find((entry) => entry.type === contentTypeFilter) ?? null;
  const selectedIsUnsupported = selected?.scorable === false;
  const currentDimensions = selectedIsUnsupported ? null : selected ? selected.current?.metricDetails ?? null : scorableScore?.current?.metricDetails ?? eraDimensions?.current ?? null;
  const backfileDimensions = selectedIsUnsupported ? null : selected ? selected.backfile?.metricDetails ?? null : scorableScore?.backfile?.metricDetails ?? eraDimensions?.backfile ?? null;
  const currentScopeWorks = selected ? selected.current?.works : scorableScore?.current?.works ?? currentWorks;
  const backfileScopeWorks = selected ? selected.backfile?.works : scorableScore?.backfile?.works ?? backfileWorks;
  const scopeLabel = selected?.label ?? 'All Benchmarked Content Types';
  const currentMetrics = flatten(currentDimensions);
  const backfileMetrics = flatten(backfileDimensions);
  const orderedKeys = [...new Set([...currentMetrics, ...backfileMetrics].map((metric) => metric.key))];
  const currentByKey = new Map(currentMetrics.map((metric) => [metric.key, metric]));
  const backfileByKey = new Map(backfileMetrics.map((metric) => [metric.key, metric]));
  const range = getEraRange();

  return (
    <section className={cn('overflow-hidden rounded-xl border bg-white shadow-sm print:break-before-page', className)}>
      <div className="border-b px-4 py-5 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Detailed Metrics</h2>
        <p className="mt-1 text-sm text-gray-600">{scopeLabel} - the same 11 metrics compared across both publication eras.</p>
        {selectedIsUnsupported && selected && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Not benchmarked: {selected.label} use a different Crossref schema, so these Participation Report metrics are not treated as 0% coverage.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border">
          <div className="bg-gray-50 px-3 py-3 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Backfile</p>
            <p className="text-xs text-gray-500">Before {range.backfileBefore}</p>
            <p className="mt-1 text-xs font-medium text-gray-700">
              {backfileDimensions && backfileScopeWorks !== undefined ? `${formatNumber(backfileScopeWorks)} works` : 'Not available'}
            </p>
          </div>
          <div className="border-l bg-blue-50 px-3 py-3 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Current</p>
            <p className="text-xs text-gray-500">{range.currentStart}-{range.currentEnd}</p>
            <p className="mt-1 text-xs font-medium text-blue-800">
              {currentDimensions && currentScopeWorks !== undefined ? `${formatNumber(currentScopeWorks)} works` : 'Not available'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          Missing era data is shown as Not available. A recorded 0% is preserved as observed zero coverage and classified Poor.
        </p>
      </div>

      {orderedKeys.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">No Current or Backfile metric breakdown is available for this scope.</div>
      ) : (
        <>
          <div className="divide-y sm:hidden">
            {orderedKeys.map((key) => {
              const current = currentByKey.get(key);
              const backfile = backfileByKey.get(key);
              const descriptor = current ?? backfile!;
              const coverageChange = current && backfile ? (current.value - backfile.value) * 100 : null;
              const pointsChange = current && backfile ? current.contribution - backfile.contribution : null;
              return (
                <article key={key} className="p-4">
                  <h3 className="font-medium text-gray-900">{descriptor.name}</h3>
                  <p className="text-xs capitalize text-gray-500">{descriptor.dimension}</p>
                  <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border">
                    <div className="bg-gray-50 p-3"><p className="mb-2 text-[11px] font-semibold uppercase text-gray-500">Backfile</p><MetricEraValue metric={backfile} /></div>
                    <div className="border-l bg-blue-50/60 p-3"><p className="mb-2 text-[11px] font-semibold uppercase text-blue-600">Current</p><MetricEraValue metric={current} /></div>
                  </div>
                  {coverageChange !== null && pointsChange !== null && (
                    <p className={cn('mt-2 text-xs font-medium', coverageChange > 0 ? 'text-green-700' : coverageChange < 0 ? 'text-red-700' : 'text-gray-500')}>
                      Change: {coverageChange > 0 ? '+' : ''}{coverageChange.toFixed(0)} pp; {pointsChange > 0 ? '+' : ''}{pointsChange.toFixed(1)} points
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[900px]">
              <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3 print:py-2">Metric</th>
                  <th className="px-5 py-3 print:py-2">Backfile coverage</th>
                  <th className="px-5 py-3 print:py-2">Backfile points</th>
                  <th className="px-5 py-3 print:py-2">Current coverage</th>
                  <th className="px-5 py-3 print:py-2">Current points</th>
                  <th className="px-5 py-3 print:py-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orderedKeys.map((key) => {
                  const current = currentByKey.get(key);
                  const backfile = backfileByKey.get(key);
                  const descriptor = current ?? backfile!;
                  const coverageChange = current && backfile ? (current.value - backfile.value) * 100 : null;
                  const pointsChange = current && backfile ? current.contribution - backfile.contribution : null;
                  return (
                    <tr key={key} className="align-middle hover:bg-gray-50">
                      <td className="px-6 py-4 print:py-2"><p className="font-medium text-gray-900">{descriptor.name}</p><p className="text-xs capitalize text-gray-500">{descriptor.dimension}</p></td>
                      <td className="px-5 py-4 print:py-2">{backfile ? <><span className="font-semibold">{(backfile.value * 100).toFixed(0)}%</span><div className="mt-1"><StatusPill status={backfile.status} /></div></> : <span className="text-gray-400">Not available</span>}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 print:py-2">{backfile ? `${backfile.contribution.toFixed(1)} / ${backfile.maxContribution}` : '-'}</td>
                      <td className="bg-blue-50/40 px-5 py-4 print:py-2">{current ? <><span className="font-semibold text-blue-900">{(current.value * 100).toFixed(0)}%</span><div className="mt-1"><StatusPill status={current.status} /></div></> : <span className="text-gray-400">Not available</span>}</td>
                      <td className="bg-blue-50/40 px-5 py-4 text-sm text-gray-700 print:py-2">{current ? `${current.contribution.toFixed(1)} / ${current.maxContribution}` : '-'}</td>
                      <td className="px-5 py-4 print:py-2">{coverageChange !== null && pointsChange !== null ? <div className={cn('text-sm font-semibold', coverageChange > 0 ? 'text-green-700' : coverageChange < 0 ? 'text-red-700' : 'text-gray-500')}><p>{coverageChange > 0 ? '+' : ''}{coverageChange.toFixed(0)} pp</p><p className="text-xs font-normal">{pointsChange > 0 ? '+' : ''}{pointsChange.toFixed(1)} pts</p></div> : <span className="text-gray-400">-</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
