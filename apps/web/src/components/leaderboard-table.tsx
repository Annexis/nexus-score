'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PublisherRadar } from '@/components/publisher-radar';
import { buildMemberHref, formatDataDate, getEraRange, type BenchmarkEra } from '@/lib/benchmark-scope';
import { normalizeQuery, trackEvent } from '@/lib/analytics';

interface Dimensions { provenance: number; people: number; organizations: number; funding: number; access: number }
interface Entry {
  rank: number; id: number; name: string; location?: string; score: number;
  totalWorks: number; scopeWorks: number | null; scopeWorksExact: boolean; comparisonScore: number | null;
  comparisonLabel: string; improvement: number | null; currentVsOverall: number | null; dimensions: Dimensions | null;
}
interface Summary {
  scopeTotal: number; averageScore: number; highestScore: number;
  distribution: { label: string; count: number }[];
}
interface ApiResponse {
  generatedAt: string; totalMembers: number; total: number; summary: Summary; leaderboard: Entry[];
}
interface Props {
  methodologyCompatible: boolean;
  methodologyVersion: string;
  snapshotDate?: string;
  availableContentTypes: { type: string; label: string; count: number; benchmarked: boolean }[];
  initialEra: BenchmarkEra;
  initialContentType: string;
}

type SortField = 'default' | 'score' | 'works' | 'improvement' | keyof Dimensions;
type SortDirection = 'desc' | 'asc';
const ITEMS_PER_PAGE = 50;
function ProgressSignal({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-gray-400">Not available</span>;
  if (change > 0) return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800"><span aria-hidden="true">↗</span> +{change} vs Overall</span>;
  if (change < 0) return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800"><span aria-hidden="true">↘</span> {change} vs Overall</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"><span aria-hidden="true">→</span> No change</span>;
}

function SortableHeader({
  field,
  label,
  activeField,
  direction,
  onSort,
}: {
  field: SortField;
  label: string;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const active = activeField === field;
  const indicator = active ? (direction === 'desc' ? '↓' : '↑') : '↕';
  const nextAction = !active
    ? `Sort ${label} high to low`
    : direction === 'desc'
      ? `Sort ${label} low to high`
      : `Restore benchmark order`;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title={nextAction}
      aria-label={`${label}. ${nextAction}.`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500',
        active && 'bg-blue-100 font-semibold text-blue-800'
      )}
    >
      <span>{label}</span>
      <span aria-hidden="true" className={cn('text-sm leading-none', active ? 'text-blue-700' : 'text-gray-400')}>{indicator}</span>
    </button>
  );
}

export function LeaderboardTable({ availableContentTypes, initialEra, initialContentType, methodologyCompatible, methodologyVersion, snapshotDate }: Props) {
  const router = useRouter();
  const [era, setEra] = useState<BenchmarkEra>(initialEra);
  const [contentType, setContentType] = useState(initialContentType);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortField>('default');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [resultTotal, setResultTotal] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radarEntry, setRadarEntry] = useState<Entry | null>(null);
  const range = getEraRange(snapshotDate ? new Date(snapshotDate) : new Date());
  const contentLabel = contentType === 'all' ? 'All Benchmarked Content Types' : availableContentTypes.find((entry) => entry.type === contentType)?.label ?? contentType;

  const updateScopeUrl = (nextEra: BenchmarkEra, nextContentType: string) => {
    const params = new URLSearchParams({ era: nextEra, contentType: nextContentType });
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      era,
      contentType,
      comparisonModel: methodologyVersion,
      limit: ITEMS_PER_PAGE.toString(),
      offset: ((page - 1) * ITEMS_PER_PAGE).toString(),
      sort,
      direction,
    });
    if (debouncedSearch) params.set('search', debouncedSearch);

    async function load() {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/leaderboard?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json() as ApiResponse;
        setEntries(data.leaderboard); setSummary(data.summary); setResultTotal(data.total);
        setGeneratedAt(data.generatedAt); setTotalMembers(data.totalMembers);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Could not load this benchmark scope. Please try again.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [contentType, debouncedSearch, direction, era, methodologyVersion, page, sort]);

  useEffect(() => {
    if (debouncedSearch.length < 2) return;
    const timer = window.setTimeout(() => trackEvent('leaderboard_search', {
      query: normalizeQuery(debouncedSearch), results: resultTotal, era, contentType,
    }), 700);
    return () => window.clearTimeout(timer);
  }, [contentType, debouncedSearch, era, resultTotal]);

  const totalPages = Math.max(1, Math.ceil(resultTotal / ITEMS_PER_PAGE));
  const scope = useMemo(() => ({ era, contentType }), [era, contentType]);

  const changeEra = (next: BenchmarkEra) => {
    setEra(next); setPage(1); setSort('default'); setDirection('desc'); setRadarEntry(null);
    updateScopeUrl(next, contentType);
  };
  const changeContentType = (next: string) => {
    setContentType(next); setPage(1); setSort('default'); setDirection('desc'); setRadarEntry(null);
    updateScopeUrl(era, next);
  };
  const toggleSort = (field: SortField) => {
    if (sort === field && direction === 'desc') setDirection('asc');
    else if (sort === field) { setSort('default'); setDirection('desc'); }
    else { setSort(field); setDirection('desc'); }
    setPage(1);
  };

  return (
    <div>
      {!methodologyCompatible && <p className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Compatible benchmark snapshots are not available. Regenerate both eras to view these results.</p>}
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-white shadow-sm" aria-label="Benchmark era">
        <button onClick={() => changeEra('current')} className={cn('px-4 py-4 text-left sm:px-6', era === 'current' ? 'bg-blue-600 text-white' : 'hover:bg-blue-50')}>
          <span className="block text-sm font-semibold">Current</span>
          <span className={cn('block text-xs', era === 'current' ? 'text-blue-100' : 'text-gray-500')}>{range.currentStart}-{range.currentEnd}</span>
        </button>
        <button onClick={() => changeEra('overall')} className={cn('border-l px-4 py-4 text-left sm:px-6', era === 'overall' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50')}>
          <span className="block text-sm font-semibold">Overall</span>
          <span className={cn('block text-xs', era === 'overall' ? 'text-gray-300' : 'text-gray-500')}>All years</span>
        </button>
      </section>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search publishers..." className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="benchmark-content-type" className="text-sm text-gray-600">Content type</label>
          <select id="benchmark-content-type" value={contentType} onChange={(event) => changeContentType(event.target.value)} className="max-w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All Benchmarked Content Types</option>
            <optgroup label="Available now">
              {availableContentTypes.filter((entry) => entry.benchmarked).map((entry) => <option key={entry.type} value={entry.type}>{entry.label} ({entry.count.toLocaleString()})</option>)}
            </optgroup>
            <optgroup label="Coming soon - not yet benchmarked">
              {availableContentTypes.filter((entry) => !entry.benchmarked).map((entry) => <option key={entry.type} value={entry.type} disabled>{entry.label} ({entry.count.toLocaleString()}) - Coming soon</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      <div className={cn('mt-4 rounded-xl border px-4 py-3 text-sm', contentType === 'all' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-100 bg-blue-50 text-blue-900')}>
        <strong>{contentLabel} - {era === 'overall' ? 'Overall, all years' : `Current, ${range.currentStart}-${range.currentEnd}`}</strong>
        {contentType === 'all' ? (
          <span className="ml-2">Supported Participation Report work types are combined using their work counts. Other record schemas are excluded from the index and remain visible on publisher profiles.</span>
        ) : (
          <span className="ml-2 text-blue-700">
            All statistics and benchmark positions below use this exact supported content type.{' '}
            <Link href="/about#future-directions" className="font-medium underline underline-offset-2">See how Coming soon types will evolve.</Link>
          </span>
        )}
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-gray-500">Publishers in scope</p><p className="mt-1 text-2xl font-bold">{summary.scopeTotal.toLocaleString()}</p><p className="text-xs text-gray-400">of {totalMembers.toLocaleString()} members</p></div>
          <div className={cn('rounded-xl border p-4 shadow-sm', era === 'current' ? 'border-blue-200 bg-blue-50' : 'bg-white')}><p className="text-xs uppercase text-gray-500">{era === 'current' ? 'Average current index' : 'Average overall index'}</p><p className={cn('mt-1 text-2xl font-bold', era === 'current' && 'text-blue-700')}>{summary.averageScore}</p></div>
          <div className={cn('rounded-xl border p-4 shadow-sm', era === 'current' ? 'border-green-200 bg-green-50' : 'bg-white')}><p className="text-xs uppercase text-gray-500">{era === 'current' ? 'Current excellence mark' : 'Highest overall index'}</p><p className={cn('mt-1 text-2xl font-bold', era === 'current' ? 'text-green-700' : 'text-blue-700')}>{era === 'current' ? `★ ${summary.highestScore}` : summary.highestScore}</p></div>
          <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-gray-500">Benchmark snapshot</p><p className="mt-1 text-base font-semibold">{generatedAt ? formatDataDate(generatedAt) : 'Not available'}</p></div>
        </div>
      )}

      {summary && (
        <div className="mt-3 flex flex-wrap gap-2 rounded-xl border bg-white p-4 text-xs shadow-sm">
          <span className="font-medium text-gray-600">Index distribution:</span>
          {summary.distribution.map((band) => <span key={band.label} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">{band.label}: {band.count.toLocaleString()}</span>)}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between text-sm text-gray-600">
        <p>{loading ? 'Updating...' : `${resultTotal.toLocaleString()} publishers`}</p>
        <p className="text-xs text-gray-500">Works reflect the selected content type and era. Index values are independent of publisher size.</p>
      </div>
      <p className="mt-2 text-xs text-gray-500"><span aria-hidden="true" className="font-semibold">↕</span> Sortable columns: select once for high-to-low, again for low-to-high, and a third time to restore benchmark order.</p>
      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-3 overflow-x-auto rounded-xl border bg-white shadow-sm" aria-busy={loading}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Benchmark position</th><th className="px-4 py-3 text-left">Publisher</th>
              <th className="px-4 py-3 text-center" aria-sort={sort === 'score' ? direction === 'desc' ? 'descending' : 'ascending' : 'none'}><SortableHeader field="score" label={era === 'current' ? 'Current index' : 'Overall index'} activeField={sort} direction={direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3 text-center">{era === 'overall' ? 'Current' : 'Overall'}</th>
              <th className="px-4 py-3 text-center" aria-sort={sort === 'improvement' ? direction === 'desc' ? 'descending' : 'ascending' : 'none'}><SortableHeader field="improvement" label="Current vs Overall" activeField={sort} direction={direction} onSort={toggleSort} /></th>
              {contentType === 'all' && (['provenance','people','organizations','funding','access'] as (keyof Dimensions)[]).map((dimension) => <th key={dimension} className="hidden px-3 py-3 text-center xl:table-cell" aria-sort={sort === dimension ? direction === 'desc' ? 'descending' : 'ascending' : 'none'}><SortableHeader field={dimension} label={dimension === 'organizations' ? 'Orgs' : dimension} activeField={sort} direction={direction} onSort={toggleSort} /></th>)}
              <th className="px-4 py-3 text-right" aria-sort={sort === 'works' ? direction === 'desc' ? 'descending' : 'ascending' : 'none'}><SortableHeader field="works" label="Volume context" activeField={sort} direction={direction} onSort={toggleSort} /></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id} className={cn('hover:bg-gray-50', entry.dimensions && 'cursor-pointer')} onClick={() => entry.dimensions && setRadarEntry(entry)}>
                <td className="px-4 py-4 text-lg font-bold text-gray-400">#{entry.rank.toLocaleString()}</td>
                <td className="px-4 py-4"><Link href={buildMemberHref(entry.id, scope)} onClick={(event) => event.stopPropagation()} className="font-medium text-gray-900 hover:text-blue-600">{entry.name}</Link>{entry.location && <p className="text-xs text-gray-500">{entry.location}</p>}</td>
                <td className="px-4 py-4 text-center"><span className="text-lg font-bold">{entry.score}</span>{era === 'current' && entry.score >= 80 && <span className="ml-1.5 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800" title="Current excellence: index 80 or above">★ Excellence</span>}</td>
                <td className="px-4 py-4 text-center text-sm text-gray-600">{entry.comparisonScore ?? 'Not available'}</td>
                <td className="px-4 py-4 text-center"><ProgressSignal change={entry.currentVsOverall ?? (entry.comparisonScore === null ? null : era === 'current' ? entry.score - entry.comparisonScore : entry.comparisonScore - entry.score)} /></td>
                {contentType === 'all' && (['provenance','people','organizations','funding','access'] as (keyof Dimensions)[]).map((dimension) => <td key={dimension} className="hidden px-3 py-4 text-center text-sm text-gray-600 xl:table-cell">{entry.dimensions?.[dimension] ?? '-'}%</td>)}
                <td className="px-4 py-4 text-right text-sm text-gray-600">
                  {entry.scopeWorks === null ? 'Not available' : <><span className="font-semibold text-gray-800">{entry.scopeWorks.toLocaleString()}</span><span className="block text-[11px] text-gray-400">{entry.scopeWorksExact ? (contentType === 'all' ? 'works in scope' : `${contentLabel.toLowerCase()} works`) : `${era === 'current' ? 'current' : 'all-years'} works · all types`}</span></>}
                </td>
              </tr>
            ))}
            {!loading && entries.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-500">No publishers match this scope.</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && <div className="mt-5 flex items-center justify-between"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-gray-600">Page {page} of {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button></div>}

      {radarEntry?.dimensions && <><div className="fixed inset-0 z-40 bg-black/20" onClick={() => setRadarEntry(null)} /><PublisherRadar id={radarEntry.id} name={radarEntry.name} score={radarEntry.score} dimensions={radarEntry.dimensions} scope={scope} onClose={() => setRadarEntry(null)} /></>}
    </div>
  );
}
