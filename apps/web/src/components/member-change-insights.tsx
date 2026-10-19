'use client';

import { useMemberContentType } from '@/components/member-content-type-context';
import { formatNumber, cn } from '@/lib/utils';

export interface MetricChange {
  /** Simplified coverage key, e.g. 'orcids' */
  key: string;
  /** Human label, e.g. 'ORCID iDs' */
  name: string;
  /** Metric weight in the 100-point system */
  weight: number;
  /** Coverage percentage 0-100 in the current three-calendar-year window */
  current: number;
  /** Coverage percentage 0-100 in the backfile era */
  backfile: number;
  /** Score-point impact of the change: (current - backfile) x weight */
  impact: number;
}

export interface MixShiftEntry {
  type: string;
  label: string;
  /** Share of era works, 0-100 */
  currentShare: number;
  backfileShare: number;
  currentWorks: number;
  backfileWorks: number;
  /** All-years score for this type, for context */
  score: number;
}

interface MemberChangeInsightsProps {
  /** Member-level metric changes across all content types */
  aggregate: MetricChange[];
  /** Per content type metric changes */
  perType: Record<string, MetricChange[]>;
  /** Content-mix shift between eras (aggregate view only) */
  mixShift: MixShiftEntry[];
  /** Era scores for the header, e.g. backfile 43 -> current 18 */
  currentScore: number | null;
  backfileScore: number | null;
  /** Per-type era scores for the filtered header */
  perTypeScores: Record<string, { current?: number; backfile?: number; label: string }>;
  aggregateScope?: {
    currentWorks: number;
    backfileWorks: number;
    currentExcludedWorks: number;
    backfileExcludedWorks: number;
  };
}

const IMPACT_THRESHOLD = 0.1; // score points — preserve visible metric movement

function ChangeRow({ change }: { change: MetricChange }) {
  const up = change.impact > 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{change.name}</p>
        <p className="text-xs text-gray-500">
          {Math.round(change.backfile)}% backfile &rarr;{' '}
          {Math.round(change.current)}% current
        </p>
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
          up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        )}
      >
        {up ? (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        ) : (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
            <polyline points="16 17 22 17 22 11" />
          </svg>
        )}
        {up ? '+' : ''}
        {change.impact.toFixed(1)} pts
      </span>
    </div>
  );
}

export function MemberChangeInsights({
  aggregate,
  perType,
  mixShift,
  currentScore,
  backfileScore,
  perTypeScores,
  aggregateScope,
}: MemberChangeInsightsProps) {
  const { contentTypeFilter } = useMemberContentType();
  const currentYear = new Date().getFullYear();
  const filtered = contentTypeFilter !== 'all';

  const changes = filtered ? (perType[contentTypeFilter] ?? []) : aggregate;
  const typeInfo = filtered ? perTypeScores[contentTypeFilter] : null;

  const headerCurrent = filtered ? typeInfo?.current : currentScore;
  const headerBackfile = filtered ? typeInfo?.backfile : backfileScore;
  const headerDelta =
    headerCurrent != null && headerBackfile != null
      ? headerCurrent - headerBackfile
      : null;

  const improved = changes
    .filter((c) => c.impact >= IMPACT_THRESHOLD)
    .sort((a, b) => b.impact - a.impact);
  const declined = changes
    .filter((c) => c.impact <= -IMPACT_THRESHOLD)
    .sort((a, b) => a.impact - b.impact);

  // Mix shifts worth calling out: share moved by 5+ percentage points
  const notableMixShifts = filtered
    ? []
    : mixShift
        .filter((m) => Math.abs(m.currentShare - m.backfileShare) >= 5)
        .sort(
          (a, b) =>
            Math.abs(b.currentShare - b.backfileShare) -
            Math.abs(a.currentShare - a.backfileShare)
        );

  if (changes.length === 0 && notableMixShifts.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">
          What Changed: Backfile &rarr; Current
          {filtered && typeInfo ? ` (${typeInfo.label})` : ''}
        </h3>
        {headerDelta !== null && (
          <span
            className={cn(
              'text-sm font-semibold',
              headerDelta > 2
                ? 'text-green-600'
                : headerDelta < -2
                  ? 'text-red-600'
                  : 'text-gray-500'
            )}
          >
            {headerBackfile} &rarr; {headerCurrent}{' '}
            ({headerDelta > 0 ? '+' : ''}
            {headerDelta} pts)
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">
        How metadata practice on current records ({currentYear - 2}–{currentYear})
        compares with the backfile, and how each change affects the index value.
      </p>
      {!filtered && aggregateScope && (
        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
          Like-for-like aggregate: {formatNumber(aggregateScope.backfileWorks)} scorable Backfile works versus {formatNumber(aggregateScope.currentWorks)} scorable Current works. {formatNumber(aggregateScope.backfileExcludedWorks)} Backfile and {formatNumber(aggregateScope.currentExcludedWorks)} Current records with different schemas are excluded from this comparison.
        </p>
      )}

      {(improved.length > 0 || declined.length > 0) && (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              Improved
            </h4>
            <div className="mt-1 divide-y divide-gray-100">
              {improved.length > 0 ? (
                improved.map((c) => <ChangeRow key={c.key} change={c} />)
              ) : (
                <p className="py-2 text-sm text-gray-400">
                  No metrics improved meaningfully.
                </p>
              )}
            </div>
          </div>
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                <polyline points="16 17 22 17 22 11" />
              </svg>
              Declined
            </h4>
            <div className="mt-1 divide-y divide-gray-100">
              {declined.length > 0 ? (
                declined.map((c) => <ChangeRow key={c.key} change={c} />)
              ) : (
                <p className="py-2 text-sm text-gray-400">
                  No metrics declined meaningfully.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {improved.length === 0 && declined.length === 0 && changes.length > 0 && (
        <p className="mt-4 text-sm text-gray-500">
          Metadata practice is roughly stable between eras — no metric moved
          the index value by at least one tenth of a point.
        </p>
      )}

      {/* Content-mix shift — often the hidden driver of member-level changes */}
      {notableMixShifts.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Content Mix Shift
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            The scorable aggregate weights each supported DOI equally, so changes
            in the mix of supported content types can still affect the index.
          </p>
          <div className="mt-3 space-y-2">
            {notableMixShifts.map((m) => {
              const grew = m.currentShare > m.backfileShare;
              const lowMetadata = m.score < 35;
              return (
                <div
                  key={m.type}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    grew && lowMetadata
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-gray-50 text-gray-700'
                  )}
                >
                  <span className="font-medium">{m.label}</span>:{' '}
                  {Math.round(m.backfileShare)}% of backfile works &rarr;{' '}
                  {Math.round(m.currentShare)}% of current works (
                  {formatNumber(m.currentWorks)} recent works)
                  {grew && lowMetadata && (
                    <>
                      {' '}
                      &mdash; this supported type has an index value of {m.score}/100, so its growing
                      share lowers the scorable aggregate
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
