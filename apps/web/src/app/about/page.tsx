import { Metadata } from 'next';
import { DIMENSION_WEIGHTS, METRICS_BY_DIMENSION } from '@nexus-score/core';

export const metadata: Metadata = {
  title: 'Methodology - Nexus-Index',
  description: 'Learn how Nexus-Index diagnoses Crossref metadata health.',
};

export default function AboutPage() {
  const dimensionInfo = [
    {
      name: 'Provenance',
      key: 'provenance' as const,
      description:
        'Measures how well the metadata establishes connections to prior work and supports research integrity. Strong provenance helps build the citation graph and enables discovery.',
    },
    {
      name: 'People',
      key: 'people' as const,
      description:
        'Evaluates author identification through ORCID iDs. Persistent researcher identifiers enable accurate attribution, automatic publication claims, and career tracking.',
    },
    {
      name: 'Organizations',
      key: 'organizations' as const,
      description:
        'Assesses institutional affiliations and affiliation-specific ROR IDs. Clear organizational links support funder compliance, institutional reporting, and collaboration analysis.',
    },
    {
      name: 'Funding',
      key: 'funding' as const,
      description:
        'Tracks funding information and award numbers recorded in Crossref. Legacy funder metadata and funder ROR identifiers receive the same credit, with each work counted once. Funding metadata enables ROI analysis for funders and supports compliance monitoring.',
    },
    {
      name: 'Access',
      key: 'access' as const,
      description:
        'Measures content discoverability and availability. License information, full-text links, and abstracts improve access and enable text mining.',
    },
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Methodology</h1>
        <p className="mt-4 text-lg text-gray-600">
          Nexus-Index is an independent, diagnostic benchmark of metadata
          deposited with Crossref. It examines how well records connect research outputs,
          people, organizations, funders, and access information.
        </p>

        {/* Index overview */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900">Index Overview</h2>
          <p className="mt-4 text-gray-600">
            The index value is calculated on a <strong>0–100 scale</strong> across five
            dimensions. It describes observed Crossref metadata coverage, not publisher,
            journal, or research quality.
          </p>
        </section>

        {/* Dimensions */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900">Dimensions</h2>
          <div className="mt-6 space-y-8">
            {dimensionInfo.map((dim) => (
              <div key={dim.key} className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">{dim.name}</h3>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                    {DIMENSION_WEIGHTS[dim.key]} points max
                  </span>
                </div>
                <p className="mt-3 text-gray-600">{dim.description}</p>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700">Metrics:</h4>
                  <ul className="mt-2 space-y-1">
                    {METRICS_BY_DIMENSION[dim.key].map((metric) => (
                      <li key={metric.key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{metric.name}</span>
                        <span className="text-gray-900">{metric.weight} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reading the Index */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900">Reading the Index</h2>
          <p className="mt-4 text-gray-600">
            The index value is a diagnostic signal, not a quality rating. It asks how much of the
            metadata visible in Crossref supports discovery, connection, and reuse. The
            bands below describe metadata coverage—not institutional performance. Missing
            fields may also reflect discipline, content type, or workflow context.
          </p>
          <div className="mt-6 overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Index Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    What It Typically Means
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 font-bold text-green-600">80–100</td>
                  <td className="px-6 py-4 text-gray-600">
                    Comprehensive coverage — the record is well connected and machine-readable
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 font-bold text-blue-600">65–79</td>
                  <td className="px-6 py-4 text-gray-600">
                    Good coverage with a small number of high-impact gaps left to close
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 font-bold text-yellow-600">50–64</td>
                  <td className="px-6 py-4 text-gray-600">
                    Adequate coverage but with significant gaps across dimensions
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 font-bold text-orange-600">35–49</td>
                  <td className="px-6 py-4 text-gray-600">
                    Substantial gaps across multiple dimensions — often a pipeline problem, not a practice problem
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-6 py-4 font-bold text-red-600">0–34</td>
                  <td className="px-6 py-4 text-gray-600">
                    Limited observed coverage across most measured fields — review the dimension profile for context
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Data Source */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900">Data Source</h2>
          <p className="mt-4 text-gray-600">
            Nexus-Index uses pre-computed coverage statistics from the{' '}
            <a
              href="https://api.crossref.org/swagger-ui/index.html#/Members"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Crossref /members API endpoint
            </a>
            . These statistics are calculated daily by Crossref and represent the
            percentage of works that contain each metadata element.
          </p>
          <p className="mt-4 text-gray-600">
            The &quot;current&quot; metrics reflect the current calendar year plus the two
            preceding calendar years, while &quot;backfile&quot; covers earlier works. The
            era comparison shows the difference between these publication cohorts;
            it does not measure change in a publisher over time.
          </p>
        </section>

        {/* Evolving methodology */}
        <section id="future-directions" className="mt-12 scroll-mt-24">
          <div className="rounded-xl border border-brand-rule bg-brand-mist p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Evolving methodology</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Future directions for research-object benchmarks</h2>
            <p className="mt-4 leading-7 text-gray-700">
              Journal-article metrics should not be imposed on every research object. A peer review,
              dataset, dissertation, standard, software release, or book has a different purpose and
              therefore needs a different definition of complete, connected metadata. Types labelled
              <strong> Coming soon</strong> are visible but deliberately not benchmarked until a
              type-appropriate, actionable profile has been validated.
            </p>
            <p className="mt-4 leading-7 text-gray-700">
              One reference model is the{' '}
              <a
                href="https://casrai.org/dictionary/objects"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-700"
              >
                CASRAI Dictionary object templates
              </a>
              . CASRAI publishes 123 structured research-information objects—including awards,
              books, conference papers, datasets, patents, people, projects, reports, reviews, and
              technical standards. Each template describes its fields, data types, requiredness,
              and links to shared terms or controlled picklists. Nexus can use that structure as a
              vocabulary and crosswalk reference while Crossref remains the source of observed
              publisher metadata.
            </p>

            <div className="mt-6 grid overflow-hidden rounded-xl border border-blue-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-blue-200">
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Foundation today</p>
                <h3 className="mt-2 font-semibold text-gray-900">Crossref Participation Reports</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  The current implementation starts with Participation Report coverage
                  data exposed through Crossref&apos;s <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/members</code> API.
                  Crossref is the first data environment—not the boundary of the intelligence layer.
                </p>
              </div>
              <div className="border-t border-blue-200 p-5 sm:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Extension path</p>
                <h3 className="mt-2 font-semibold text-gray-900">Additional data environments</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Future adapters can bring in other scholarly metadata, registry, repository,
                  and research-information environments. Each source must receive an explicit
                  field crosswalk, provenance rules, validation tests, and a versioned methodology
                  before it contributes to a benchmark.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <article className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold text-gray-900">1. Object-specific profiles</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Map each Crossref content type to the closest research-object definition, then
                  measure fields that are meaningful for that object. Peer reviews, for example,
                  should emphasize the reviewed-object relationship, review stage and type—not
                  article-only fields that do not apply.
                </p>
              </article>
              <article className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold text-gray-900">2. Applicability and context</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Distinguish missing metadata from a legitimately inapplicable field. This includes
                  institutional authorship, unfunded research, non-text outputs, and object types
                  where contributor, funding, access, or version signals work differently.
                </p>
              </article>
              <article className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold text-gray-900">3. Actionable crosswalks</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Every proposed signal must map back to a deposit field, identifier, relationship,
                  or workflow action. CASRAI can clarify the object model; Crossref schema support
                  and publisher control determine whether a signal can enter the benchmark.
                </p>
              </article>
              <article className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold text-gray-900">4. Versioned public validation</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Publish the proposed mapping, metrics, applicability rules, weights, and test
                  results for community review. A content type becomes selectable only after the
                  methodology is reproducible, fair across real deposits, and tied to practical fixes.
                </p>
              </article>
            </div>

            <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-100/60 px-4 py-3 text-sm leading-6 text-indigo-950">
              <strong>Methodology status:</strong> these are research and governance directions,
              not committed scoring changes. Existing weights and benchmark values remain unchanged
              until a versioned proposal is reviewed and adopted.
            </div>
          </div>
        </section>

        {/* Open Source */}
        <section className="mt-12 rounded-lg bg-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900">Open Source</h2>
          <p className="mt-2 text-gray-600">
            Nexus-Index is open source. View the code, report issues, or contribute on{' '}
            <a
              href="https://github.com/aadivar/nexus-score"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
