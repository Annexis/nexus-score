#!/usr/bin/env node

/**
 * Nexus Score MCP Server
 * Provides Crossref metadata coverage scoring tools for AI assistants
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  CrossrefClient,
  calculateMemberScore,
  calculateJournalScore,
  DIMENSION_WEIGHTS,
  METRICS_BY_DIMENSION,
  analyzeInstitution,
  searchInstitutions,
  type NexusScore,
} from '@nexus-score/core';

// Initialize Crossref client
const client = new CrossrefClient({
  mailto: process.env.CROSSREF_MAILTO || 'varma2friend@gmail.com',
});

// ============ QUERY LOGGING ============

const LOG_DIR = process.env.NEXUS_LOG_DIR || join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'logs'
);

function logQuery(tool: string, params: Record<string, unknown>, result?: { success: boolean; summary?: string }) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      tool,
      params,
      success: result?.success ?? true,
      summary: result?.summary,
    };
    const logFile = join(LOG_DIR, `queries-${new Date().toISOString().split('T')[0]}.jsonl`);
    appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // Logging should never break the tool
  }
}

// Institutional analysis (OpenAlex enumeration + evidence-based Crossref
// classification) lives in @nexus-score/core — single source of truth shared
// with the web app. The old PUBLISHER_MAP / aggregate-projection helpers that
// used to sit here were removed; see issue #10.

// Create MCP server
const server = new McpServer({
  name: 'nexus-score',
  version: '1.0.0',
});

// ============ TOOLS ============

/**
 * Get Nexus Score for a Crossref member (publisher)
 */
server.tool(
  'get_member_score',
  'Get the Nexus Score for a Crossref member (publisher/organization) by ID. Returns a composite score (0-100), grade (A-F), dimension breakdown, and improvement recommendations.',
  {
    member_id: z
      .string()
      .describe('Crossref member ID (e.g., "286" for Oxford University Press, "311" for Wiley)'),
  },
  async ({ member_id }) => {
    try {
      const member = await client.getMemberForScoring(member_id);
      const score = calculateMemberScore(member);
      logQuery('get_member_score', { member_id }, { success: true, summary: `${score.metadata.entityName}: ${score.total}/${score.grade}` });

      return {
        content: [
          {
            type: 'text' as const,
            text: formatScoreResponse(score),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logQuery('get_member_score', { member_id }, { success: false, summary: message });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching member ${member_id}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Search for Crossref members by name
 */
server.tool(
  'search_members',
  'Search for Crossref members (publishers) by name. Returns member IDs that can be used with get_member_score.',
  {
    query: z.string().describe('Search query (publisher name, e.g., "Elsevier", "Nature")'),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum number of results (default: 5, max: 20)'),
  },
  async ({ query, limit }) => {
    try {
      const actualLimit = Math.min(limit, 20);
      const result = await client.searchMembers(query, actualLimit);

      const members = result.items.map((m) => ({
        id: m.id,
        name: m['primary-name'],
        totalWorks: m.counts['total-dois'],
        location: m.location || 'Unknown',
      }));

      logQuery('search_members', { query, limit }, { success: true, summary: `${result['total-results']} results` });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                total: result['total-results'],
                showing: members.length,
                members,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error searching members: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Get Nexus Score for a journal by ISSN
 */
server.tool(
  'get_journal_score',
  'Get the Nexus Score for a specific journal by ISSN. Returns scoring similar to member scores.',
  {
    issn: z.string().describe('Journal ISSN (e.g., "0028-0836" for Nature)'),
  },
  async ({ issn }) => {
    try {
      const journal = await client.getJournalForScoring(issn);
      const score = calculateJournalScore(journal);

      return {
        content: [
          {
            type: 'text' as const,
            text: formatScoreResponse(score),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching journal ${issn}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Compare scores between multiple publishers
 */
server.tool(
  'compare_members',
  'Compare Nexus Scores between multiple Crossref members (publishers). Useful for benchmarking.',
  {
    member_ids: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe('Array of member IDs to compare (2-5 members)'),
  },
  async ({ member_ids }) => {
    try {
      const scores = await Promise.all(
        member_ids.map(async (id) => {
          const member = await client.getMemberForScoring(id);
          return calculateMemberScore(member);
        })
      );

      const comparison = scores.map((score) => ({
        name: score.metadata.entityName,
        id: score.metadata.entityId,
        total: score.total,
        grade: score.grade,
        dimensions: {
          provenance: score.dimensions.provenance.percentage,
          people: score.dimensions.people.percentage,
          organizations: score.dimensions.organizations.percentage,
          funding: score.dimensions.funding.percentage,
          access: score.dimensions.access.percentage,
        },
        trend: score.trend.direction,
      }));

      // Sort by total score descending
      comparison.sort((a, b) => b.total - a.total);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ comparison }, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error comparing members: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Get improvement recommendations for a member
 */
server.tool(
  'get_recommendations',
  'Get specific improvement recommendations for a Crossref member to increase their Nexus Score.',
  {
    member_id: z.string().describe('Crossref member ID'),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum recommendations to return (default: 5)'),
  },
  async ({ member_id, limit }) => {
    try {
      const member = await client.getMemberForScoring(member_id);
      const score = calculateMemberScore(member);

      const recommendations = score.recommendations.slice(0, limit).map((rec) => ({
        priority: rec.priority,
        title: rec.title,
        dimension: rec.dimension,
        currentValue: `${rec.currentValue}%`,
        targetValue: `${rec.targetValue}%`,
        potentialGain: `+${rec.potentialGain} points`,
        howToImprove: rec.howToImprove,
        documentation: rec.documentationUrl,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                member: score.metadata.entityName,
                currentScore: score.total,
                currentGrade: score.grade,
                recommendations,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting recommendations: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Analyze institutional research visibility
 * Shows what publishers deposit vs what the institution produces
 */
server.tool(
  'analyze_institution',
  'Analyze what an institution can see about its own research output. Enumerates the institution\'s journal articles from OpenAlex over the window, then probes every DOI directly against Crossref and classifies each by evidence read from the Crossref record: in Crossref as a journal-article (grouped by the publisher Crossref itself reports), in Crossref under another content type (deposit gap), or absent from Crossref entirely (registered with DataCite / a repository — out of scope). No hand-maintained publisher map; no projection from aggregate coverage. Takes a ROR ID.',
  {
    ror_id: z
      .string()
      .describe('ROR ID for the institution (e.g., "052gg0110" for University of Oxford, "042nb2s44" for MIT)'),
    window_days: z
      .number()
      .optional()
      .default(90)
      .describe('Publication window in days (default: 90, clamped to 7–365)'),
  },
  async ({ ror_id, window_days }) => {
    try {
      const days = Math.max(7, Math.min(365, window_days ?? 90));
      const report = await analyzeInstitution(ror_id, days);
      const missingInstRor = (100 - report.totals.institutionalRorPercent).toFixed(0);
      logQuery(
        'analyze_institution',
        { ror_id, window_days: days },
        {
          success: true,
          summary: `${report.institution.name}: ${report.measuredArticles}/${report.totalArticles} measured, ${missingInstRor}% missing institutional ROR`,
        }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logQuery('analyze_institution', { ror_id }, { success: false, summary: message });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error analyzing institution ${ror_id}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Search for institutions by name
 */
server.tool(
  'search_institutions',
  'Search for research institutions by name. Returns ROR IDs that can be used with analyze_institution.',
  {
    query: z.string().describe('Institution name (e.g., "University of Oxford", "MIT", "Harvard")'),
    limit: z.number().optional().default(5).describe('Maximum results (default: 5)'),
  },
  async ({ query, limit }) => {
    try {
      const all = await searchInstitutions(query);
      const results = all.slice(0, Math.min(limit, 20));

      logQuery('search_institutions', { query, limit }, { success: true, summary: `${results.length} results` });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ results }, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logQuery('search_institutions', { query }, { success: false, summary: message });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error searching institutions: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============ RESOURCES ============

/**
 * Methodology documentation
 */
server.resource('methodology', 'nexus-score://methodology', async () => ({
  contents: [
    {
      uri: 'nexus-score://methodology',
      mimeType: 'text/markdown',
      text: `# Nexus Score Methodology

Nexus Score measures how well metadata contributes to Crossref's Research Nexus vision - connecting research outputs, people, organizations, and funders.

## Total Score: 100 points

### Provenance (${DIMENSION_WEIGHTS.provenance} points)
Links to prior work and research integrity.
${METRICS_BY_DIMENSION.provenance.map((m) => `- ${m.name}: ${m.weight} points`).join('\n')}

### People (${DIMENSION_WEIGHTS.people} points)
Author identification and disambiguation.
${METRICS_BY_DIMENSION.people.map((m) => `- ${m.name}: ${m.weight} points`).join('\n')}

### Organizations (${DIMENSION_WEIGHTS.organizations} points)
Institutional affiliations and linking.
${METRICS_BY_DIMENSION.organizations.map((m) => `- ${m.name}: ${m.weight} points`).join('\n')}

### Funding (${DIMENSION_WEIGHTS.funding} points)
Grant tracking and funder linking.
${METRICS_BY_DIMENSION.funding.map((m) => `- ${m.name}: ${m.weight} points`).join('\n')}

### Access (${DIMENSION_WEIGHTS.access} points)
Content availability and discoverability.
${METRICS_BY_DIMENSION.access.map((m) => `- ${m.name}: ${m.weight} points`).join('\n')}

## Grades
- **A** (80-100): Excellent metadata coverage
- **B** (65-79): Good, with room for improvement
- **C** (50-64): Adequate, significant gaps
- **D** (35-49): Needs substantial work
- **F** (0-34): Poor metadata coverage

## Data Source
Scores use pre-computed coverage statistics from the Crossref /members API endpoint, updated daily.
`,
    },
  ],
}));

// ============ HELPERS ============

function formatScoreResponse(score: NexusScore): string {
  const topRecs = score.recommendations.slice(0, 3);

  return JSON.stringify(
    {
      score: {
        total: score.total,
        grade: score.grade,
        trend: score.trend,
      },
      dimensions: Object.fromEntries(
        Object.entries(score.dimensions).map(([key, dim]) => [
          key,
          {
            score: dim.score,
            maxScore: dim.maxScore,
            percentage: dim.percentage,
          },
        ])
      ),
      entity: {
        name: score.metadata.entityName,
        id: score.metadata.entityId,
        type: score.metadata.entityType,
        totalWorks: score.metadata.totalWorks,
        currentWorks: score.metadata.currentWorks,
      },
      topRecommendations: topRecs.map((r) => ({
        priority: r.priority,
        title: r.title,
        potentialGain: r.potentialGain,
      })),
    },
    null,
    2
  );
}

// ============ START SERVER ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Nexus Score MCP server running');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
