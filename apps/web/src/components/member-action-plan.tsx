'use client';

import {
  generateRecommendationsFromMetricDetails,
  type ContentTypeScore,
  type DimensionScores,
} from '@nexus-score/core';
import { useMemberContentType } from '@/components/member-content-type-context';
import { RecommendationsList } from '@/components/recommendations-list';
import { formatNumber } from '@/lib/utils';
import { getEraRange } from '@/lib/benchmark-scope';

interface MemberActionPlanProps {
  memberCurrentDimensions: DimensionScores | null;
  memberCurrentWorks?: number;
  contentTypeScores: ContentTypeScore[] | null;
}

export function MemberActionPlan({ memberCurrentDimensions, memberCurrentWorks, contentTypeScores }: MemberActionPlanProps) {
  const { contentTypeFilter } = useMemberContentType();
  const selected = contentTypeFilter === 'all'
    ? null
    : contentTypeScores?.find((entry) => entry.type === contentTypeFilter) ?? null;
  const selectedRecommendations = selected?.scorable && selected.current
    ? generateRecommendationsFromMetricDetails(selected.current.metricDetails)
    : null;
  const memberRecommendations = memberCurrentDimensions
    ? generateRecommendationsFromMetricDetails(memberCurrentDimensions)
    : [];
  const range = getEraRange();

  return (
    <section aria-labelledby="action-plan-heading" className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 shadow-sm sm:p-6 print:break-before-page print:p-4">
      <div className="border-b border-blue-200 pb-4">
        <h2 id="action-plan-heading" className="text-xl font-semibold text-blue-950">Action Plan</h2>
        <p className="mt-1 text-sm leading-6 text-blue-800">
          Recommendations focus on Current publications ({range.currentStart}-{range.currentEnd}). Each list states exactly which records it describes.
        </p>
      </div>

      <div className="mt-5 space-y-5 print:mt-3 print:space-y-3">
        {selected && (
          !selected.scorable ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
              <h3 className="font-semibold">No action list for {selected.label}</h3>
              <p className="mt-1">This record type is not benchmarked against the 11 Participation Report metrics, so Nexus does not manufacture gap recommendations from inapplicable fields.</p>
            </div>
          ) : selectedRecommendations ? (
            <RecommendationsList
              recommendations={selectedRecommendations}
              title={`Actions for ${selected.label}`}
              scopeLabel={`${selected.label} - Current - ${selected.current?.works !== undefined ? `${formatNumber(selected.current.works)} works` : 'work count unavailable'}`}
              limit={5}
            />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              <h3 className="font-semibold">Actions for {selected.label}</h3>
              <p className="mt-1">Not available: Crossref reports no Current works or no Current metric breakdown for this content type. All-years data is not substituted.</p>
            </div>
          )
        )}

        {memberCurrentDimensions && (
          <RecommendationsList
            recommendations={memberRecommendations}
            title="Publisher-wide actions"
            scopeLabel={`All Benchmarked Content Types - Current - ${memberCurrentWorks !== undefined ? `${formatNumber(memberCurrentWorks)} works` : 'work count unavailable'}`}
            limit={5}
          />
        )}
      </div>

      <div className="mt-5 grid gap-3 text-xs leading-5 text-gray-600 sm:grid-cols-2 print:mt-3">
        <p className="rounded-lg border bg-white p-3"><strong className="text-gray-800">People context:</strong> Low ORCID coverage is an observed metadata gap, not proof that every work has an individual author eligible for an ORCID.</p>
        <p className="rounded-lg border bg-white p-3"><strong className="text-gray-800">Funding context:</strong> Missing funder metadata does not prove research was externally funded; applicability varies by discipline and publication.</p>
      </div>
    </section>
  );
}
