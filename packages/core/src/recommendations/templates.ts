/**
 * Recommendation Templates
 * Actionable suggestions for improving metadata coverage
 */

import type { DimensionName, Priority } from '../scoring/types.js';

export interface RecommendationTemplate {
  id: string;
  metric: string;
  dimension: DimensionName;
  title: string;
  description: string;
  howToImprove: string;
  documentationUrl: string;
  targetValue: number;
  priorityThreshold: {
    high: number;
    medium: number;
  };
  metricWeight: number;
}

/**
 * All recommendation templates
 */
export const RECOMMENDATION_TEMPLATES: RecommendationTemplate[] = [
  // PEOPLE
  {
    id: 'orcid-coverage',
    metric: 'orcids-current',
    dimension: 'people',
    title: 'Increase ORCID Coverage',
    description:
      'Add ORCID iDs for all authors to enable precise researcher identification, automatic publication claims, and accurate citation metrics.',
    howToImprove:
      "Require ORCID iDs in your submission system. Use ORCID's public API for validation. Include the <ORCID> element in your Crossref XML deposits with the authenticated-orcid attribute when available.",
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/contributors/',
    targetValue: 0.8,
    priorityThreshold: { high: 0.3, medium: 0.6 },
    metricWeight: 20,
  },

  // ORGANIZATIONS
  {
    id: 'ror-ids',
    metric: 'affiliation-ror-ids-current',
    dimension: 'organizations',
    title: 'Add ROR IDs for Affiliations',
    description:
      'Include ROR (Research Organization Registry) identifiers for institutional affiliations to enable unambiguous organization linking and support funder reporting requirements.',
    howToImprove:
      'Use the ROR API to match affiliation text strings to ROR IDs. Include ROR IDs in your Crossref deposits using the <institution_id type="ror"> element alongside the text affiliation name.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/contributors/',
    targetValue: 0.6,
    priorityThreshold: { high: 0.1, medium: 0.3 },
    metricWeight: 10,
  },
  {
    id: 'affiliations',
    metric: 'affiliations-current',
    dimension: 'organizations',
    title: 'Include Author Affiliations',
    description:
      'Add institutional affiliation text for authors. Even without ROR IDs, affiliation names help users identify where research was conducted.',
    howToImprove:
      'Capture author affiliations during submission and include them in the <affiliation> element within each <person_name> in your Crossref deposits.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/contributors/',
    targetValue: 0.8,
    priorityThreshold: { high: 0.3, medium: 0.6 },
    metricWeight: 5,
  },

  // PROVENANCE
  {
    id: 'references',
    metric: 'references-current',
    dimension: 'provenance',
    title: 'Deposit Complete References',
    description:
      'Include full reference lists to enable citation linking, power the Cited-by service, and contribute to the scholarly citation graph.',
    howToImprove:
      'Extract references from your published content. Include them in the <citation_list> element with DOIs where available. Use the public-references="true" attribute to make them openly available.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/references/',
    targetValue: 0.95,
    priorityThreshold: { high: 0.5, medium: 0.8 },
    metricWeight: 15,
  },
  {
    id: 'update-policies',
    metric: 'update-policies-current',
    dimension: 'provenance',
    title: 'Enable Crossmark',
    description:
      'Register for Crossmark to provide readers with information about corrections, retractions, and version updates for your content.',
    howToImprove:
      'Apply for Crossmark participation through your Crossref membership. Once approved, include the <crossmark> element in your deposits with your update policy URL.',
    documentationUrl: 'https://www.crossref.org/services/crossmark/',
    targetValue: 0.5,
    priorityThreshold: { high: 0.1, medium: 0.3 },
    metricWeight: 5,
  },
  {
    id: 'similarity-checking',
    metric: 'similarity-checking-current',
    dimension: 'provenance',
    title: 'Enable Similarity Check',
    description:
      'Participate in Similarity Check (powered by iThenticate) to help maintain research integrity by detecting potential plagiarism and content overlap.',
    howToImprove:
      'Subscribe to Similarity Check through Crossref. Include full-text URLs in your deposits with intended-application="similarity-checking" to enable content checking.',
    documentationUrl: 'https://www.crossref.org/services/similarity-check/',
    targetValue: 0.5,
    priorityThreshold: { high: 0.1, medium: 0.3 },
    metricWeight: 5,
  },

  // FUNDING
  {
    id: 'funders',
    metric: 'funders-current',
    dimension: 'funding',
    title: 'Add Funder Information',
    description:
      'Include funding acknowledgements, with Open Funder Registry or ROR identifiers where available, to support connections between funding and research outputs. Missing metadata does not establish whether research was funded.',
    howToImprove:
      'Collect funding statements and award numbers. Identify funders using ROR or Open Funder Registry IDs and include them in Crossref deposits. Do not invent funding for unfunded work.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/funding-information/',
    targetValue: 0.6,
    priorityThreshold: { high: 0.2, medium: 0.4 },
    metricWeight: 10,
  },
  {
    id: 'award-numbers',
    metric: 'award-numbers-current',
    dimension: 'funding',
    title: 'Include Award/Grant Numbers',
    description:
      'Add specific grant or award numbers alongside funder information to enable precise funding-to-output linking and ROI analysis.',
    howToImprove:
      'When funding information is available, extract and include specific award numbers in the <fr:award_number> element. Consider implementing the new Grant DOI field when available.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/funding-information/',
    targetValue: 0.5,
    priorityThreshold: { high: 0.1, medium: 0.3 },
    metricWeight: 10,
  },

  // ACCESS
  {
    id: 'abstracts',
    metric: 'abstracts-current',
    dimension: 'access',
    title: 'Include Abstracts',
    description:
      'Add abstracts to improve discoverability, enable better search results, and help researchers quickly assess content relevance.',
    howToImprove:
      'Include the <jats:abstract> or <abstract> element in your Crossref deposits. Both plain text and JATS XML formats are supported.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/abstracts/',
    targetValue: 0.9,
    priorityThreshold: { high: 0.3, medium: 0.6 },
    metricWeight: 6,
  },
  {
    id: 'licenses',
    metric: 'licenses-current',
    dimension: 'access',
    title: 'Add License Information',
    description:
      'Include license URLs to clarify reuse rights, support Open Access compliance checking, and enable automated TDM workflows.',
    howToImprove:
      'Add the <ai:license_ref> element with the license URL (e.g., Creative Commons URL) to your deposits. Include the applies_to attribute and start_date.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/license-information/',
    targetValue: 0.9,
    priorityThreshold: { high: 0.3, medium: 0.6 },
    metricWeight: 7,
  },
  {
    id: 'full-text-links',
    metric: 'resource-links-current',
    dimension: 'access',
    title: 'Add Full-Text URLs',
    description:
      'Include links to full-text content to enable text mining, support content harvesting, and improve accessibility for users and machines.',
    howToImprove:
      'Add <collection property="text-mining"> with <item> elements containing full-text URLs. Specify content-type (application/pdf, text/xml, etc.) and intended-application.',
    documentationUrl:
      'https://www.crossref.org/documentation/schema-library/markup-guide-metadata-segments/full-text-urls/',
    targetValue: 0.8,
    priorityThreshold: { high: 0.3, medium: 0.5 },
    metricWeight: 7,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): RecommendationTemplate | undefined {
  return RECOMMENDATION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by dimension
 */
export function getTemplatesByDimension(
  dimension: DimensionName
): RecommendationTemplate[] {
  return RECOMMENDATION_TEMPLATES.filter((t) => t.dimension === dimension);
}
