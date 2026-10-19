import type { CoverageFields, CrossrefMember, CrossrefJournal, DateParts } from './types.js';
import { isScorableContentType } from '../scoring/content-types.js';

/** Derived locally; never a second weighted metric. Raw Crossref fields stay intact. */
export const FUNDING_UNION_FIELD = 'funders-including-ror';
export interface FundingOnlyWork {
  DOI: string;
  member: string;
  type: string;
  issued?: DateParts;
}

const proportion = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Return an exact union if known. Marginal percentages cannot reveal overlap. */
export function fundingCoverage(coverage: Record<string, number | undefined>): number | null {
  const existing = coverage.funders;
  const ror = coverage['funder-ror-ids'];
  const union = coverage[FUNDING_UNION_FIELD];
  if (!proportion(existing)) return null;
  if (union !== undefined) return proportion(union) && union >= existing && (!proportion(ror) || union + 1e-12 >= ror) ? union : null;
  if (!proportion(ror)) return null;
  if (existing === 1 || ror === 0) return existing;
  if (ror === 1) return 1;
  if (existing === 0) return ror;
  return null;
}

export function needsFundingSupplement(member: CrossrefMember): boolean {
  return (['all', 'current', 'backfile'] as const).some((era) =>
    Object.entries(member['counts-type']?.[era] ?? {}).some(([type, count]) => {
      const coverage = member['coverage-type']?.[era]?.[type];
      return count > 0 && isScorableContentType(type) && coverage && proportion(coverage.funders) &&
        proportion(coverage['funder-ror-ids']) && fundingCoverage(coverage) === null;
    }));
}

export function fundingOnlyCounts(works: FundingOnlyWork[], currentYear: number) {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const work of works) {
    const doi = work.DOI?.trim().toLowerCase();
    if (!doi || !work.member || !work.type) throw new Error('Incomplete identifier-only funding record');
    if (seen.has(doi)) continue;
    seen.add(doi);
    const member = String(work.member).split('/').pop()!;
    const year = work.issued?.['date-parts']?.[0]?.[0];
    const eras = ['all'];
    if (Number.isInteger(year) && year! > 0 && year! <= currentYear) eras.push(year! >= currentYear - 2 ? 'current' : 'backfile');
    for (const era of eras) {
      const key = `${member}:${era}:${work.type}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** Add only ROR-bearing DOIs excluded by Crossref's existing has-funder cohort. */
export function completeFundingCoverage(members: CrossrefMember[], works: FundingOnlyWork[], currentYear: number): CrossrefMember[] {
  const extra = fundingOnlyCounts(works, currentYear);
  return members.map((member) => ({
    ...member,
    'coverage-type': Object.fromEntries((['all', 'current', 'backfile'] as const).map((era) => [era,
      Object.fromEntries(Object.entries(member['coverage-type']?.[era] ?? {}).map(([type, raw]) => {
        if (!isScorableContentType(type)) return [type, raw];
        const count = member['counts-type']?.[era]?.[type] ?? 0;
        if (!proportion(raw.funders) || !proportion(raw['funder-ror-ids'])) return [type, raw];
        const known = fundingCoverage(raw);
        if (known !== null) return [type, { ...raw, [FUNDING_UNION_FIELD]: known }];
        if (!count) return [type, raw];
        const additional = extra.get(`${member.id}:${era}:${type}`) ?? 0;
        const union = raw.funders + additional / count;
        const ror = raw['funder-ror-ids'];
        // Crossref's cached coverage and live work index can differ. Never clamp
        // inconsistent inputs into a plausible-looking percentage.
        if (!proportion(union) || !proportion(ror) || union + 1e-12 < ror || additional > count) {
          throw new Error(`Inconsistent funding inputs for member ${member.id}, ${era}, ${type}; recollect before scoring.`);
        }
        return [type, { ...raw, [FUNDING_UNION_FIELD]: union } as CoverageFields];
      })),
    ])) as CrossrefMember['coverage-type'],
  }));
}

/** Reuse the same union rule for journal-level era coverage. */
export function journalFundingInput(journal: CrossrefJournal): CrossrefMember {
  const coverageType = { all: {}, current: {}, backfile: {} } as CrossrefMember['coverage-type'];
  const counts = { all: {}, current: {}, backfile: {} } as NonNullable<CrossrefMember['counts-type']>;
  for (const era of ['current', 'backfile'] as const) {
    counts[era] = { 'journal-article': journal.counts[`${era}-dois`] };
    coverageType[era]['journal-article'] = {
      funders: journal.coverage[`funders-${era}`],
      'funder-ror-ids': journal.coverage[`funder-ror-ids-${era}`],
    } as unknown as CoverageFields;
  }
  return { id: 0, 'coverage-type': coverageType, 'counts-type': counts } as CrossrefMember;
}

export function completeJournalFundingCoverage(journal: CrossrefJournal, works: FundingOnlyWork[], year: number): CrossrefJournal {
  const corrected = completeFundingCoverage([journalFundingInput(journal)],
    works.map((work) => ({ ...work, member: '0', type: 'journal-article' })), year)[0];
  const coverage = { ...journal.coverage };
  for (const era of ['current', 'backfile'] as const) {
    coverage[`${FUNDING_UNION_FIELD}-${era}`] = corrected['coverage-type'][era]['journal-article'][FUNDING_UNION_FIELD];
  }
  return { ...journal, coverage };
}
