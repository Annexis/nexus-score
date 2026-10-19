import { MemberSearch } from '@/components/member-search';
import { PilotBanner } from '@/components/pilot-banner';
import { DataEnvironmentNotice } from '@/components/data-environment-notice';
import { NewHomeBadge } from '@/components/new-home-badge';
import Link from 'next/link';

// The five index dimensions (weights defined in @nexus-score/core scoring/weights.ts)
const dimensionTable = [
  {
    name: 'Provenance',
    points: 25,
    badgeClass: 'border border-brand-rule bg-brand-paper text-brand-ink',
    measures: 'References (15), Crossmark metadata (5), Similarity Check URLs (5)',
    aiNeeds: 'Trust and traceability of the claim',
    plainEnglish:
      "Where did this paper come from, and can we trust the trail? Did the publisher tell us when it was published, what version this is, what license it's under, and what it cites? Basically — is the paper's paperwork in order.",
  },
  {
    name: 'People',
    points: 20,
    badgeClass: 'border border-brand-rule bg-brand-paper text-brand-ink',
    measures: 'ORCID iD Coverage (20)',
    aiNeeds: 'Unambiguous author attribution',
    plainEnglish:
      'Do we actually know who wrote it? Are the authors real, identified humans with ORCIDs — or just names on a page that could belong to anyone? If two researchers share a name, can we tell them apart?',
  },
  {
    name: 'Organizations',
    points: 15,
    badgeClass: 'border border-brand-rule bg-brand-paper text-brand-ink',
    measures: 'Affiliations (5), Affiliation ROR IDs (10)',
    aiNeeds: 'Machine-readable institutional links',
    plainEnglish:
      'Do we know where the authors work? Is the university or institution properly identified with a ROR ID, or is it a free-text string like "Dept of Bio, Univ" that no machine can match to anything?',
  },
  {
    name: 'Funding',
    points: 20,
    badgeClass: 'border border-brand-rule bg-brand-paper text-brand-ink',
    measures: 'Funder information, including ROR (10), Award Numbers (10)',
    aiNeeds: 'Investment traceability for funders',
    plainEnglish:
      'Who paid for this research, and can we follow the money? Is the funder identified with a registry ID? Is the grant number there? Without this, you can\'t answer basic questions like "what did the NIH\'s $40B actually produce?"',
  },
  {
    name: 'Access',
    points: 20,
    badgeClass: 'border border-brand-rule bg-brand-paper text-brand-ink',
    measures: 'Licenses (7), Full-text Links (7), Abstracts (6)',
    aiNeeds: 'Whether AI can legally read and ingest the work',
    plainEnglish:
      "Can anyone actually read it? Is the full text open, or paywalled? Is there a license that tells AI tools whether they're allowed to use it? If a paper exists but no one can access it, it may as well not exist for AI discovery.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <PilotBanner />
      {/* Hallmark · Focused Search hero: compact introduction · search-led · no enrichment */}
      <section className="relative overflow-hidden border-b border-brand-rule bg-brand-paper pb-16 pt-12 sm:pb-24 sm:pt-16">
        <div aria-hidden="true" className="hero-ring hero-ring--outer pointer-events-none absolute -right-28 top-10 hidden h-96 w-96 rounded-full border-2 sm:block" />
        <div aria-hidden="true" className="hero-ring hero-ring--inner pointer-events-none absolute -right-4 top-32 hidden h-64 w-64 rounded-full border-2 sm:block" />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_12.5rem] lg:items-center lg:gap-12 lg:px-8">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <h1 className="hero-title max-w-3xl text-brand-ink">
              Measure your <span className="text-brand-signal">metadata</span> completeness
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-brand-ink">
              Nexus-Index is a diagnostic benchmark of the metadata publishers
              deposit into{' '}
              <a
                href="https://www.crossref.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="brand-link rounded font-semibold underline"
              >
                Crossref
              </a>
              . It shows what is visible, what is missing, and what can be improved across
              five dimensions.
            </p>
            <div className="mt-8 max-w-2xl">
              <MemberSearch placeholder="Search for a publisher (e.g., Elsevier, Nature)…" />
              <p className="mt-3 max-w-xl text-sm leading-6 text-brand-muted">
                Opens Journal Articles — Current ({new Date().getFullYear() - 2}–{new Date().getFullYear()}). Overall and Backfile remain visible for comparison.
              </p>
            </div>
          </div>
          <div className="row-start-1 justify-self-start lg:col-start-2 lg:justify-self-end">
            <NewHomeBadge />
          </div>
        </div>
      </section>

      <div className="bg-brand-paper px-4 py-6 sm:px-6 lg:px-8">
        <DataEnvironmentNotice className="mx-auto max-w-6xl" />
      </div>

      {/* Dimensions Table */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">The framework</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
              Dimensions (100 points total)
            </h2>
            <p className="mt-4 text-gray-600">
              Five dimensions, eleven metrics, one hundred points. Every point maps to
              a specific, fixable metadata field in your Crossref deposits.
            </p>
          </div>

          {/* Mobile: stacked cards */}
          <div className="mt-10 space-y-4 lg:hidden">
            {dimensionTable.map((dim) => (
              <div key={dim.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${dim.badgeClass}`}
                  >
                    {dim.name}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {dim.points} pts
                  </span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-semibold text-gray-900">What it measures</dt>
                    <dd className="mt-0.5 text-gray-700">{dim.measures}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-900">Why AI needs it</dt>
                    <dd className="mt-0.5 text-gray-700">{dim.aiNeeds}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-900">In plain English</dt>
                    <dd className="mt-0.5 text-gray-600">{dim.plainEnglish}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="mt-10 hidden overflow-x-auto rounded-xl border border-slate-200 shadow-sm lg:block">
            <table className="w-full min-w-[900px] divide-y divide-gray-200 bg-white text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-900">Dimension</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Points</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">What It Measures</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Why AI Needs It</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">In Plain English</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dimensionTable.map((dim) => (
                  <tr key={dim.name} className="align-top">
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${dim.badgeClass}`}
                      >
                        {dim.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-gray-900">{dim.points}</td>
                    <td className="px-4 py-4 text-gray-700">{dim.measures}</td>
                    <td className="px-4 py-4 text-gray-700">{dim.aiNeeds}</td>
                    <td className="px-4 py-4 text-gray-600">{dim.plainEnglish}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-semibold text-gray-900">How the Index Is Calculated</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <p>
                <strong>1. Coverage Data:</strong> We use Crossref&apos;s pre-computed
                coverage percentages for each metadata field and supported work type.
              </p>
              <p>
                <strong>2. Dimension value:</strong> We weight each metadata field&apos;s
                coverage by work counts across supported types, then apply the metric
                weights within each dimension. Overall uses all years; Current uses
                the current publication window.
              </p>
              <p>
                <strong>3. Index value:</strong> Provenance × 25% +
                People × 20% + Organizations × 15% + Funding × 20% + Access × 20%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beyond a Single Metadata Source */}
      <section className="border-y border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
              Beyond a Single Metadata Source
            </h2>
            <div className="mt-5 space-y-4 text-gray-600">
              <p>
                Nexus-Index measures the machine interpretability of scholarly
                metadata records.
              </p>
              <p>
                The current implementation begins with metadata deposited in Crossref
                because Crossref is open, publisher-contributed infrastructure and one of
                the most important public sources of scholarly metadata. But the Index
                is not limited to Crossref, nor is it a replacement for Crossref&apos;s own
                participation reports, metadata health checks, or community
                infrastructure work.
              </p>
              <p>
                The broader purpose of the Index is to examine how well a scholarly
                object can be discovered, connected, attributed, verified, and reused
                across the research information ecosystem.
              </p>
              <p>
                The same article, dataset, preprint, grant, protocol, or research object
                may appear across Crossref, OpenAlex, PubMed, institutional repositories,
                publisher platforms, funder databases, disciplinary registries, Scopus,
                Web of Science, and other scholarly knowledge graphs. Each system may
                represent the record differently, with different levels of completeness,
                linkage, provenance, and machine-readiness.
              </p>
            </div>
          </div>

          <div className="my-10 rounded-xl border border-blue-200 bg-white p-7 text-center shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              The Index asks a larger question
            </p>
            <p className="mt-3 text-xl font-semibold leading-relaxed text-gray-900">
              How interpretable is this scholarly record to humans, systems, and AI
              agents wherever it appears?
            </p>
          </div>

          <div className="space-y-4 text-gray-600">
            <p>
              A high index value does not measure research quality, journal prestige,
              publisher reputation, or scholarly impact. It measures whether the record
              contains enough structured, connected, and trustworthy metadata to support
              discovery, attribution, accountability, and AI-mediated research
              workflows.
            </p>
            <p className="font-medium text-gray-900">
              Nexus-Index is an AI-readiness and interoperability signal for the
              scholarly record.
            </p>
          </div>
        </div>
      </section>

      {/* What Nexus-Index is — and what it is not */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-gray-900">
            What Nexus-Index Is — and Is Not
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-center text-gray-600">
            The number is not the verdict. The Index is a diagnostic — a way to
            find where metadata breaks down between a publisher&apos;s workflow and
            the open research infrastructure that depends on it. Every index value
            exists to answer one question: what specific, fixable gap is keeping
            this research from being found, connected, and reused?
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
              <h3 className="font-semibold text-green-800">The Index is</h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    <strong>A diagnostic</strong> — it locates the exact metadata
                    fields (ORCID iDs, licenses, references, funding IDs) where a
                    publisher&apos;s deposits leak value
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    <strong>A repair list</strong> — every point lost maps to a
                    specific, fixable field, with a recommendation and a fixer
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    <strong>A reusability measure</strong> — how ready a scholarly
                    record is to be found, connected, and legally reused by both
                    people and machines
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    <strong>A recognition of best open-science practice</strong> —
                    complete, open metadata is invisible work, and the Index makes
                    it visible and rewarded
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <h3 className="font-semibold text-red-800">The Index is not</h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="text-red-600">✗</span>
                  <span>
                    <strong>A measure of publisher quality</strong> — the benchmark
                    makes gaps visible and progress trackable; two publishers with the
                    same index value can have
                    completely different gaps
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">✗</span>
                  A measure of research quality or scholarly impact
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">✗</span>
                  A judgment of journal prestige or publisher reputation
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">✗</span>
                  A replacement for Crossref&apos;s own participation reports or
                  metadata health checks
                </li>
              </ul>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm font-medium text-gray-500">
            Every index value is a starting point, not a verdict. Every gap has a fix.
            The only direction is forward.
          </p>
        </div>
      </section>

      {/* Media Mentions */}
      <section className="border-y border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-gray-900">
            In the Conversation
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            Nexus-Index is part of an ongoing community discussion about metadata
            quality and open research infrastructure.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                outlet: 'LinkedIn',
                type: 'Community post',
                title:
                  'On scholarly publishing, open science, and research infrastructure',
                href: 'https://www.linkedin.com/posts/robjohnsonresearchconsulting_scholarlypublishing-openscience-researchinfrastructure-activity-7441740521741463552-Nlsz/',
              },
              {
                outlet: 'The Scholarly Kitchen',
                type: 'Guest post',
                title:
                  'Fixing the Leaky Metadata Pipeline: A Conversation with the Creator of Research Nexus Score',
                href: 'https://scholarlykitchen.sspnet.org/2026/06/11/guest-post-fixing-the-leaky-metadata-pipeline-a-conversation-with-the-creator-of-research-nexus-score/',
              },
              {
                outlet: 'Patreon',
                type: 'Commentary',
                title: 'Industry commentary on metadata and the scholarly record',
                href: 'https://www.patreon.com/DavidWorlock/posts/notation-its-and-159270373',
              },
              {
                outlet: 'Patreon',
                type: 'Podcast interview',
                title: 'Measuring in the age of AI',
                href: 'https://www.patreon.com/DavidWorlock/posts/measuring-in-age-161710561',
              },
              {
                outlet: 'Patreon',
                type: 'Guest post',
                title: 'Is AI changing how scholarly work is discovered?',
                href: 'https://www.patreon.com/DavidWorlock/posts/guest-blog-is-ai-162519816',
              },
            ].map((mention) => (
              <a
                key={mention.href}
                href={mention.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 whitespace-normal shadow-sm transition-colors hover:border-brand-signal"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    {mention.type}
                  </span>
                  <span className="text-xs text-gray-400">{mention.outlet}</span>
                </div>
                <p className="mt-3 break-words text-sm font-medium leading-6 text-gray-900 group-hover:text-blue-700">
                  {mention.title}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            Aligned with the Open Research Information Movement
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            Nexus-Index supports the open research information movement by making
            metadata coverage visible, measurable, and improvable. Better metadata means
            better connections across the scholarly ecosystem.
          </p>
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3">
            {[
              { name: 'Barcelona Declaration', href: 'https://barcelona-declaration.org/' },
              { name: 'DORA', href: 'https://sfdora.org/' },
              { name: 'FAIR Principles', href: 'https://www.go-fair.org/fair-principles/' },
              { name: 'Metadata 2020', href: 'https://metadata2020.org/' },
            ].map((org) => (
              <a
                key={org.name}
                href={org.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                {org.name}
              </a>
            ))}
            <span className="px-1 text-sm text-gray-500">
              among other open research information initiatives
            </span>
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/about"
              className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800"
            >
              Learn About Our Methodology
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Explore the Benchmark
            </Link>
          </div>
        </div>
      </section>

      {/* Data Source */}
      <section className="border-t border-slate-800 bg-slate-950 py-9">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-slate-300">
            Data sourced from the{' '}
            <a
              href="https://api.crossref.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 hover:underline"
            >
              Crossref REST API
            </a>
            . Nexus-Index analyzes observed metadata coverage for{' '}
            <strong>27,000+ publishers</strong> registered with Crossref.
          </p>
        </div>
      </section>
    </div>
  );
}
