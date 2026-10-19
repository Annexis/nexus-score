import type { Metadata } from 'next';
import Link from 'next/link';
import { isScorableContentType, scopedBenchmark, summarizeBenchmark, compareBenchmarkEras, type BenchmarkDimensions } from '@nexus-score/core';
import { getBenchmarkSnapshots } from '@/lib/benchmark-data';
import { buildLeaderboardHref, buildMemberHref, formatDataDate } from '@/lib/benchmark-scope';
import { InsightsContentTypeFilter } from '@/components/insights-content-type-filter';

export const metadata: Metadata = {
  title: 'Benchmark Insights - Nexus-Index',
  description: 'Snapshot-derived findings about Crossref metadata coverage, with explicit content types, populations, and dates.',
};

const dimensions: { key: keyof BenchmarkDimensions; label: string; color: string; measures: string; href: string }[] = [
  { key: 'provenance', label: 'Provenance', color: 'bg-blue-500', measures: 'References, Crossmark metadata, Similarity Check URLs', href: 'https://www.crossref.org/documentation/reports/participation-reports/' },
  { key: 'people', label: 'People', color: 'bg-green-500', measures: 'ORCID coverage; institutional authors cannot hold an ORCID', href: 'https://www.crossref.org/documentation/register-maintain-records/persistent-identifiers/orcid-ids/' },
  { key: 'organizations', label: 'Organizations', color: 'bg-purple-500', measures: 'Affiliation text and affiliation-specific ROR IDs', href: 'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/affiliations/' },
  { key: 'funding', label: 'Funding', color: 'bg-yellow-500', measures: 'Funding information and award numbers recorded in Crossref', href: 'https://www.crossref.org/documentation/funder-registry/funding-data-overview/' },
  { key: 'access', label: 'Access', color: 'bg-red-500', measures: 'Licenses, full-text links, abstracts; this is not an open-access measure', href: 'https://www.crossref.org/documentation/reports/participation-reports/' },
];
const number = (value: number) => value.toLocaleString('en-GB');
const index = (value: number | null) => value === null ? 'Not available' : value.toFixed(1);
const bands = { A: '80–100', B: '65–79', C: '50–64', D: '35–49', F: '0–34' };
const threshold = 10;

export default async function BenchmarkInsightsPage({ searchParams }: {
  searchParams: Promise<{ contentType?: string | string[] }>;
}) {
  const query = await searchParams;
  const pair = getBenchmarkSnapshots();
  if (!pair) return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Benchmark Insights</h1>
      <p className="mt-4 text-gray-600">Compatible benchmark snapshots are not available. Insights will return after both eras are regenerated with the current methodology.</p>
      <Link href="/leaderboard" className="mt-4 inline-block text-blue-700 underline">Open Benchmark Explorer</Link>
    </main>
  );
  const available = pair.overall.availableContentTypes.filter((type) => isScorableContentType(type.type));
  const defaultType = available.some((type) => type.type === 'journal-article') ? 'journal-article' : available[0]?.type ?? 'all';
  const requested = typeof query.contentType === 'string' ? query.contentType : defaultType;
  const contentType = requested === 'all' || available.some((type) => type.type === requested) ? requested : defaultType;
  const scopeLabel = contentType === 'all' ? 'All Benchmarked Content Types' : available.find((type) => type.type === contentType)?.label ?? 'Journal Articles';
  const overallRows = scopedBenchmark(pair.overall, contentType);
  const currentRows = scopedBenchmark(pair.current, contentType);
  const overall = summarizeBenchmark(overallRows);
  const current = summarizeBenchmark(currentRows);
  const byId = new Map(overallRows.map((row) => [row.id, row]));
  const matched = compareBenchmarkEras(overallRows, currentRows, threshold);
  const { higher, lower } = matched;
  const examples = currentRows.filter((row) => [4374, 16, 235, 1968, 78, 311, 286, 179].includes(row.id));
  const typeComparisons = available.map((type) => ({ ...type, summary: summarizeBenchmark(scopedBenchmark(pair.current, type.type)) }))
    .filter((type) => type.summary.count > 0).sort((a, b) => b.summary.count - a.summary.count);
  const period = `${pair.current.currentStart}–${pair.current.currentEnd}`;
  const explorer = (era: 'overall' | 'current') => buildLeaderboardHref({ era, contentType });

  return (
    <main className="min-h-screen py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-4xl">
          <Link href={explorer('current')} className="text-sm font-medium text-blue-700 underline">Back to Benchmark Explorer</Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Health check of publisher metadata deposited in Crossref · {formatDataDate(pair.current.generatedAt)}</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Benchmark Insights</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">A dated view of the metadata visible in Crossref. Every figure below is calculated from the same saved benchmark used by the explorer.</p>
          <p className="mt-2 text-sm text-gray-500">Coverage describes registered metadata, not publisher quality or the quality of research.</p>
        </header>

        <InsightsContentTypeFilter key={contentType} contentType={contentType} options={available} explorerHref={explorer('current')} />
        <p className="mt-3 text-sm text-gray-600"><strong>{scopeLabel}</strong> · Current: publications issued in {period} · Overall: all years. Backfile is before {pair.current.currentStart}.</p>
        <p className="mt-1 text-xs text-gray-500">Source: Crossref /members · methodology {pair.current.methodologyVersion}. Snapshot dates reflect collection, not the publication date or the last metadata deposit.</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Current benchmark summary">
          {[
            ['Publishers in Current', number(current.count), `${number(overall.count)} publishers in Overall`],
            ['Average current index', index(current.average), 'Each publisher has equal weight'],
            ['Median current index', index(current.median), 'The middle publisher in this scope'],
            ['Current index 80+', number(current.distribution[0].count), `${current.count ? (100 * current.distribution[0].count / current.count).toFixed(1) : '0.0'}% of publishers in scope`],
          ].map(([title, value, description]) => <div key={title} className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p><p className="mt-2 text-3xl font-bold text-brand-primary">{value}</p><p className="mt-2 text-xs text-gray-500">{description}</p></div>)}
        </section>

        <section className="mt-12" aria-labelledby="era-comparison">
          <h2 id="era-comparison" className="text-2xl font-bold text-gray-900">Overall and Current, compared consistently</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">The complete Overall and Current populations differ. The table below compares the same {number(matched.count)} publishers, with {scopeLabel.toLowerCase()} coverage in both eras. Each publisher has equal weight in these summaries.</p>
          <div className="mt-5 overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm"><caption className="sr-only">Matched publisher cohort, Overall versus Current</caption>
              <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-5 py-3">Matched cohort</th><th className="px-5 py-3 text-right">Overall · all years</th><th className="px-5 py-3 text-right">Current · {period}</th></tr></thead>
              <tbody className="divide-y">
                <tr><th className="px-5 py-3 text-left font-medium">Average index</th><td className="px-5 py-3 text-right">{index(matched.overall.average)}</td><td className="px-5 py-3 text-right font-semibold text-blue-700">{index(matched.current.average)}</td></tr>
                {matched.overall.distribution.map((band, i) => <tr key={band.grade}><th className="px-5 py-3 text-left font-medium">Index {bands[band.grade]}</th><td className="px-5 py-3 text-right">{number(band.count)}</td><td className="px-5 py-3 text-right">{number(matched.current.distribution[i].count)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-6 text-gray-600"><strong>{number(higher)}</strong> publishers have a Current index at least {threshold} points above Overall; <strong>{number(lower)}</strong> are at least {threshold} points below. This is a comparison of publication eras in one snapshot, not evidence that individual publishers improved or declined over time.</p>
          <div className="mt-4 flex flex-wrap gap-5 text-sm"><Link href={explorer('overall')} className="font-medium text-blue-700 underline">Explore Overall in this scope</Link><Link href={explorer('current')} className="font-medium text-blue-700 underline">Explore Current in this scope</Link></div>
        </section>

        <section className="mt-12" aria-labelledby="dimension-profile">
          <h2 id="dimension-profile" className="text-2xl font-bold text-gray-900">Where the current metadata gaps are</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">These are average dimension indices across publishers in the selected Current scope. They are not percentages of all papers with metadata, and different dimensions measure different signals.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {dimensions.map((dimension) => <article key={dimension.key} className="rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4"><h3 className="font-semibold text-gray-900">{dimension.label}</h3><p className="whitespace-nowrap text-lg font-bold text-gray-900">{index(current.dimensions[dimension.key])}<span className="text-xs font-normal text-gray-500"> / 100</span></p></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${dimension.color}`} style={{ width: `${current.dimensions[dimension.key] ?? 0}%` }} /></div>
              <p className="mt-3 text-sm leading-6 text-gray-600">{dimension.measures}.</p>
              <a href={dimension.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-blue-700 underline">How to improve this metadata →</a>
            </article>)}
            <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <h3 className="font-semibold">Interpret funding in context</h3>
              <p className="mt-2">Absent funding metadata does not establish that research was funded or unfunded. The current weighting remains under community discussion.</p>
              <p className="mt-2">Funder-ROR coverage averages {current.funderRor === null ? 'Not available' : `${index(current.funderRor)}%`} across publishers with this field, including zero coverage. These records receive funding credit: a work with both legacy funder metadata and a funder ROR ID counts once.</p>
              <p className="mt-2">The weights remain 10 points for funder information and 10 points for award numbers.</p>
              <p className="mt-2">Organizations uses affiliation-specific ROR coverage. Funder ROR IDs do not contribute to that dimension.</p>
            </aside>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="content-types">
          <h2 id="content-types" className="text-2xl font-bold text-gray-900">Content types have different coverage profiles</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">Each row uses that content type’s Current publisher cohort. Counts and averages have different denominators across rows; these are not comparisons of publisher or research quality.</p>
          <div className="mt-5 overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-5 py-3">Current content type</th><th className="px-5 py-3 text-right">Publishers</th><th className="px-5 py-3 text-right">Average index</th></tr></thead>
            <tbody className="divide-y">{typeComparisons.map((type) => <tr key={type.type}><th className="px-5 py-3 text-left font-medium"><Link className="text-blue-700 underline" href={buildLeaderboardHref({ era: 'current', contentType: type.type })}>{type.label}</Link></th><td className="px-5 py-3 text-right">{number(type.summary.count)}</td><td className="px-5 py-3 text-right">{index(type.summary.average)}</td></tr>)}</tbody>
          </table></div>
          <p className="mt-3 text-xs leading-5 text-gray-500">Only documented Participation Report work types are scored. Peer reviews, journal issues, and other unsupported schemas are disclosed on publisher profiles without receiving an index. {number(pair.overall.notBenchmarked)} registered members have no complete supported aggregate in this snapshot.</p>
        </section>

        <section className="mt-12" aria-labelledby="publisher-examples">
          <h2 id="publisher-examples" className="text-2xl font-bold text-gray-900">Publisher examples in this scope</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">A fixed selection of familiar members, with values and positions read from this snapshot. Select a publisher for metric details and an action plan. Live profiles may show newer API data; their snapshot positions remain dated.</p>
          <div className="mt-5 overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-5 py-3">Publisher</th><th className="px-5 py-3 text-right">Current works</th><th className="px-5 py-3 text-right">Overall</th><th className="px-5 py-3 text-right">Current</th><th className="px-5 py-3 text-right">Current position</th></tr></thead>
            <tbody className="divide-y">{examples.map((row) => <tr key={row.id}><th className="px-5 py-3 text-left font-medium"><Link href={buildMemberHref(row.id, { era: 'current', contentType })} className="text-blue-700 underline">{row.name}</Link></th><td className="px-5 py-3 text-right">{number(row.scopeWorks)}</td><td className="px-5 py-3 text-right">{byId.get(row.id)?.score ?? 'Not available'}</td><td className="px-5 py-3 text-right font-semibold">{row.score}</td><td className="px-5 py-3 text-right">#{number(row.rank)}</td></tr>)}{examples.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-gray-600">None of the example publishers has a Current benchmark in this content type. Use the explorer to see the publishers in scope.</td></tr>}</tbody>
          </table></div>
        </section>

        <footer className="mt-12 space-y-3 rounded-xl border border-brand-rule bg-brand-mist p-6 text-sm leading-6 text-gray-700">
          <h2 className="text-lg font-semibold text-gray-900">What this snapshot can tell us</h2>
          <p>The index diagnoses metadata visible through Crossref. It does not identify why metadata is absent, establish research funding eligibility, or demonstrate that a work was screened for plagiarism. Similarity Check measures deposited URLs; Crossmark measures registered update metadata and has no additional participation fee.</p>
          <p>Overall uses all-years coverage of supported work types, weighted by their work counts within each publisher. Current uses the same rules for {period}. Publishers then have equal weight in the averages on this page. Weights and grade thresholds are unchanged.</p>
          <p>Crossref can enrich metadata, including matching funder names to ROR IDs on new or updated records. Changes between snapshots can reflect deposits, enrichment, content mix, or membership changes. A historical comparison needs matched cohorts and compatible methodology versions.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><a className="text-blue-700 underline" href="https://www.crossref.org/documentation/reports/participation-reports/">Crossref Participation Reports</a><a className="text-blue-700 underline" href="https://github.com/Annexis/nexus-score/issues">Community methodology discussions</a><Link className="text-blue-700 underline" href="/gap-fixer">Explore the metadata fixer</Link></div>
        </footer>
      </div>
    </main>
  );
}
