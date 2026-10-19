# Benchmark methodology: 2026-10-funding-union-v3

This version corrects affiliation-ROR mapping, includes ROR-only funder metadata,
and reconciles saved benchmarks with live member diagnostics. Dimension weights, the eleven scored metrics, and grade
thresholds remain unchanged. Historical snapshots from a different methodology
version must not be presented as a measured trend against this one.

## Population and eras

Only the work types in `SCORABLE_CONTENT_TYPES` enter a member aggregate. These
are Crossref's documented Participation Report types. Peer reviews, journal
issues, and other schemas remain visible on publisher profiles without receiving
a score or lowering a supported aggregate.

Overall uses all-years per-type coverage. Current and Backfile use their own
per-type coverage and counts. For each metric, the member aggregate is the sum
of coverage multiplied by work count, divided by the supported work count in
that era. The aggregate is scored by the same core function as each content type.
Overall is not an equal average of Current and Backfile.

Current is the collection calendar year and the two preceding calendar years;
Backfile is earlier. The snapshots store their year range and collection date.
No era with zero works is represented as a measured zero score.

Members with no supported works, incomplete coverage for a supported type, or
missing affiliation-ROR coverage are excluded from the aggregate cohort. Their
count is disclosed. Complete, explicitly zero coverage remains eligible.
Tied scores share competition ranks (1, 2, 2, 4).

## ROR and funding

Crossref added `affiliation-ror-ids` and `funder-ror-ids` coverage on 3 August
2026. `ror-ids` continues to cover identifiers in either context. Organizations
now uses `affiliation-ror-ids`; the combined field cannot establish affiliation
coverage and is not used as a fallback when the role-specific field is missing.

Funding retains the existing 10 points for funder information and 10 points for
award numbers. The funder component now counts the union of existing `funders`
coverage and `funder-ror-ids` coverage. Existing funding-name/legacy-ID credit is
preserved; ROR-only deposits also qualify. This is funding-information coverage,
not an identifier-only measure or the prevalence of funded research.

The Participation Report `/members` response provides the two marginal
percentages but no overlap. Where either is zero or one, the union is known
directly. For ambiguous mixtures, the collector retrieves only works matching
`has-funder-ror-id:true,has-funder:false`, restricted to the relevant members.
Those DOIs are disjoint from the existing funding cohort. Each DOI is normalized
and counted once, by member, work type, and publication era. The resulting
`funders-including-ror` field is derived locally; raw API fields remain intact.
We neither sum the marginal percentages nor substitute their maximum for an
unknown union. Award numbers remain their separate, unchanged component.

Crossref's coverage statistics are cached while its work index can update sooner.
The saved snapshots record `coverageCollectedAt` and `fundingCollectedAt` separately.
Inputs producing impossible proportions fail generation rather than being clipped.
Live diagnostics use `getMemberForScoring` / `getJournalForScoring` to resolve
funding before calculation. Unresolved mixtures cannot silently receive a score.

Crossref's 15 September 2026 funder-name matching enriches new or updated records
with ROR IDs when a match is found. Existing records remain unchanged until
updated. These are observations of the served metadata, not claims that a
publisher alone supplied every identifier.

## Insights and actionability

All insight figures are derived at render time from compatible, dated snapshots.
They use an explicit content type. Averages across publishers give each
publisher equal weight and are not work-weighted global coverage percentages.

The era comparison intersects publisher IDs with coverage in both scopes. The
reported difference threshold is explicitly ten index points. This is not a
longitudinal before/after analysis and does not justify causal claims about
pipelines, disciplines, or improvement. Publisher examples use fixed member IDs
and current snapshot values, not selected narrative outcomes.

Dimension explanations link to deposit guidance; publisher examples link to
metric details and action plans. Crossmark has no additional participation fee.
Similarity Check coverage measures deposited URLs, not proof that each work was
screened. Funding and ORCID interpretation retain the contextual limitations in
community issues #2, #4, and #6.

## Collection and reproducibility

The generator uses the shared Crossref client with cursor pagination, preserved
request parameters, and each response's next cursor. It checks for repeated
cursors, duplicate members, and incomplete collections before replacing data.
Requests are serialized per contact address within a process, paced using
response headers and published request-class limits, and retry transient errors
and 429s with backoff / Retry-After. Shared contact addresses across processes
still share Crossref's upstream budget.

A gitignored gzip cache at `apps/web/data/internal/crossref-members.json.gz`
allows the same input to be rescored locally:

```sh
pnpm --filter @nexus-score/core build
pnpm --filter @nexus-score/web generate-leaderboard --input data/internal/crossref-members.json.gz
```

The first replay fetches the small identifier-only supplement and caches it at
`apps/web/data/internal/funding-supplement.json.gz`. For repeatable local replay
without further API calls, append `--funding-input data/internal/funding-supplement.json.gz`.
The snapshot date is the later input collection date. The scheduled job always
fetches fresh inputs. Both outputs carry the same timestamp and methodology
version; consumers refuse incompatible or mismatched pairs.

## Sources

- [Crossref Participation Reports](https://www.crossref.org/documentation/reports/participation-reports/)
- [Separate affiliation and funder ROR fields](https://community.crossref.org/t/ror-filters-for-affiliations-and-funders-in-the-rest-api/16222)
- [Funder-name matching](https://www.crossref.org/blog/improving-how-funding-connects-to-research-outputs/)
- [Request and email rate limits](https://community.crossref.org/t/refining-rest-api-limits-for-improved-stability-and-reliability/16137)
- [Cursor changes](https://community.crossref.org/t/changes-to-cursors-filtering-and-sorting-in-the-rest-api/16246)
- [Crossmark](https://www.crossref.org/services/crossmark/)
