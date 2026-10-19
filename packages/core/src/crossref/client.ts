/**
 * Crossref API Client
 * Uses the polite pool for better rate limits
 */

import {
  CrossrefMember,
  CrossrefJournal,
  CrossrefWork,
  CrossrefResponse,
  SearchResult,
  WorksResult,
} from './types.js';
import {
  CrossrefAPIError,
  CrossrefNotFoundError,
  CrossrefRateLimitError,
  CrossrefTimeoutError,
} from './errors.js';
import { completeFundingCoverage, completeJournalFundingCoverage, journalFundingInput, needsFundingSupplement, type FundingOnlyWork } from './funding.js';

const BASE_URL = 'https://api.crossref.org';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAILTO = 'varma2friend@gmail.com';

// Serialize this process's requests by contact address: Crossref shares its
// budget by email, including separate client instances. External processes must
// also use their own valid contact or coordinate their request budgets.
const queues = new Map<string, Promise<void>>();
const nextRequestAt = new Map<string, number>();
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface CrossrefClientOptions {
  /** Email for polite pool access (required for better rate limits) */
  mailto?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
}

export class CrossrefClient {
  private readonly mailto: string;
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly scoringMembers = new Map<string, { at: number; result: Promise<CrossrefMember> }>();

  constructor(options: CrossrefClientOptions = {}) {
    this.mailto = options.mailto || process.env.CROSSREF_MAILTO || DEFAULT_MAILTO;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.userAgent = options.userAgent || `NexusScore/1.0 (mailto:${this.mailto})`;
  }

  /**
   * Internal fetch method with polite pool headers
   */
  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const previous = queues.get(this.mailto) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((resolve) => { release = resolve; });
    queues.set(this.mailto, turn);
    await previous;
    try {
      for (let attempt = 0; ; attempt++) {
        await pause(Math.max(0, (nextRequestAt.get(this.mailto) ?? 0) - Date.now()));
        try {
          return await this.request<T>(endpoint, params);
        } catch (error) {
          const retryable = error instanceof CrossrefRateLimitError || error instanceof CrossrefTimeoutError ||
            error instanceof CrossrefAPIError && error.isServerError || error instanceof TypeError;
          if (!retryable || attempt >= 4) throw error;
          const wait = error instanceof CrossrefRateLimitError && error.retryAfter !== null
            ? error.retryAfter * 1000 : Math.min(30000, 1000 * 2 ** attempt);
          await pause(wait);
        }
      }
    } finally {
      release();
      if (queues.get(this.mailto) === turn) queues.delete(this.mailto);
    }
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);

    // Add polite pool mailto
    url.searchParams.set('mailto', this.mailto);

    // Add additional params
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const limit = Number(response.headers.get('x-rate-limit-limit'));
      const interval = Number.parseFloat(response.headers.get('x-rate-limit-interval') ?? '1') * 1000;
      const listRequest = /\/(members|works|journals|funders|prefixes|types|licenses)$/.test(endpoint);
      const publishedMinimum = listRequest ? 334 : 100;
      nextRequestAt.set(this.mailto, Date.now() + Math.max(publishedMinimum,
        limit > 0 && interval > 0 ? Math.ceil(interval / limit) : 0));

      if (!response.ok) {
        const body = await response.text();

        if (response.status === 404) {
          throw new CrossrefNotFoundError(endpoint, url.pathname);
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const seconds = retryAfter === null ? NaN : Number.isFinite(Number(retryAfter))
            ? Number(retryAfter) : (Date.parse(retryAfter) - Date.now()) / 1000;
          throw new CrossrefRateLimitError(
            endpoint,
            Number.isFinite(seconds) ? Math.max(0, seconds) : null
          );
        }

        throw new CrossrefAPIError(response.status, body, endpoint);
      }

      const data = (await response.json()) as CrossrefResponse<T>;
      return data.message;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CrossrefTimeoutError(endpoint, this.timeout);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============ MEMBER ENDPOINTS ============

  /**
   * Get member by ID - returns pre-computed coverage stats
   * Use getMemberForScoring when passing the result to the scoring functions.
   *
   * @example
   * const member = await client.getMember('286'); // Oxford UP
   */
  async getMember(memberId: string | number): Promise<CrossrefMember> {
    return this.fetch<CrossrefMember>(`/members/${memberId}`);
  }

  /** Same member response, augmented with exact, deduplicated funding coverage. */
  async getMemberForScoring(memberId: string | number): Promise<CrossrefMember> {
    const key = String(memberId);
    const cached = this.scoringMembers.get(key);
    if (cached && Date.now() - cached.at < 60000) return cached.result;
    const result = this.prepareMemberForScoring(memberId);
    this.scoringMembers.set(key, { at: Date.now(), result });
    if (this.scoringMembers.size > 200) this.scoringMembers.delete(this.scoringMembers.keys().next().value!);
    try { return await result; } catch (error) { this.scoringMembers.delete(key); throw error; }
  }

  private async prepareMemberForScoring(memberId: string | number): Promise<CrossrefMember> {
    const member = await this.getMember(memberId);
    const works = needsFundingSupplement(member) ? await this.getFundingOnlyWorks([member.id]) : [];
    return completeFundingCoverage([member], works, new Date().getUTCFullYear())[0];
  }

  /** Fetch only the disjoint ROR cohort, restricted to members with ambiguous overlap. */
  async getFundingOnlyWorks(memberIds: number[], onProgress?: (count: number, total: number) => void): Promise<FundingOnlyWork[]> {
    const collected = new Map<string, FundingOnlyWork>();
    // Repeated member filters have OR semantics; keep URLs below proxy limits.
    for (let offset = 0; offset < memberIds.length; offset += 50) {
      const ids = memberIds.slice(offset, offset + 50);
      const filter = ['has-funder-ror-id:true', 'has-funder:false', ...ids.map((id) => `member:${id}`)].join(',');
      const batch = await this.fetchFundingOnlyPages('/works', filter, onProgress);
      for (const work of batch) collected.set(work.DOI.toLowerCase(), work);
    }
    return [...collected.values()];
  }

  private async fetchFundingOnlyPages(endpoint: string, filter: string, onProgress?: (count: number, total: number) => void) {
    let cursor = '*';
    let expected = 0;
    const seenCursors = new Set<string>();
    const batch = new Map<string, FundingOnlyWork>();
    while (true) {
      if (seenCursors.has(cursor)) throw new Error('Repeated funding cursor; refusing incomplete funding coverage.');
      seenCursors.add(cursor);
      const page = await this.fetch<SearchResult<FundingOnlyWork>>(endpoint, {
        filter, cursor, rows: '1000', select: 'DOI,member,type,issued',
      });
      expected ||= page['total-results'];
      for (const work of page.items) batch.set(work.DOI.toLowerCase(), work);
      onProgress?.(batch.size, expected);
      if (page.items.length < 1000) break;
      if (!page['next-cursor']) throw new Error('Missing funding cursor; refusing incomplete funding coverage.');
      cursor = page['next-cursor'];
    }
    if (batch.size < expected) throw new Error('Crossref funding collection changed; retry before replacing benchmark data.');
    return [...batch.values()];
  }

  /**
   * Search members by name
   *
   * @example
   * const result = await client.searchMembers('oxford', 10);
   */
  async searchMembers(query: string, limit = 10): Promise<SearchResult<CrossrefMember>> {
    return this.fetch<SearchResult<CrossrefMember>>('/members', {
      query,
      rows: limit.toString(),
    });
  }

  /**
   * List members without a search query (returns members by internal ordering)
   * Useful for leaderboards and browsing all members
   *
   * @example
   * const result = await client.listMembers(50);
   */
  async listMembers(limit = 50, offset = 0): Promise<SearchResult<CrossrefMember>> {
    const params: Record<string, string> = {
      rows: limit.toString(),
    };
    if (offset > 0) {
      params.offset = offset.toString();
    }
    return this.fetch<SearchResult<CrossrefMember>>('/members', params);
  }

  /** Cursor paging keeps every original parameter and consumes each next-cursor. */
  async listMembersPage(cursor = '*', limit = 500): Promise<SearchResult<CrossrefMember>> {
    return this.fetch<SearchResult<CrossrefMember>>('/members', { cursor, rows: String(limit) });
  }

  /**
   * Get sample works from a member (for deep analysis)
   * Uses the sample parameter to get random works without pagination
   *
   * @example
   * const works = await client.getMemberWorksSample('286', 100);
   */
  async getMemberWorksSample(
    memberId: string | number,
    sampleSize = 100
  ): Promise<CrossrefWork[]> {
    const result = await this.fetch<WorksResult>(`/members/${memberId}/works`, {
      sample: sampleSize.toString(),
      select: 'DOI,title,author,funder,reference,license,link,abstract,type,issued,publisher',
    });
    return result.items;
  }

  /**
   * Get recent works from a member (sorted by indexed date)
   *
   * @example
   * const works = await client.getMemberRecentWorks('286', 20);
   */
  async getMemberRecentWorks(
    memberId: string | number,
    limit = 20
  ): Promise<CrossrefWork[]> {
    const result = await this.fetch<WorksResult>(`/members/${memberId}/works`, {
      rows: limit.toString(),
      sort: 'indexed',
      order: 'desc',
      select: 'DOI,title,author,funder,reference,license,link,abstract,type,issued,publisher',
    });
    return result.items;
  }

  // ============ JOURNAL ENDPOINTS ============

  /**
   * Get journal by ISSN
   *
   * @example
   * const journal = await client.getJournal('0028-0836'); // Nature
   */
  async getJournal(issn: string): Promise<CrossrefJournal> {
    return this.fetch<CrossrefJournal>(`/journals/${issn}`);
  }

  async getJournalForScoring(issn: string): Promise<CrossrefJournal> {
    const journal = await this.getJournal(issn);
    const works = needsFundingSupplement(journalFundingInput(journal))
      ? await this.fetchFundingOnlyPages(`/journals/${issn}/works`, 'has-funder-ror-id:true,has-funder:false') : [];
    return completeJournalFundingCoverage(journal, works, new Date().getUTCFullYear());
  }

  /**
   * Get sample works from a journal
   *
   * @example
   * const works = await client.getJournalWorksSample('0028-0836', 100);
   */
  async getJournalWorksSample(issn: string, sampleSize = 100): Promise<CrossrefWork[]> {
    const result = await this.fetch<WorksResult>(`/journals/${issn}/works`, {
      sample: sampleSize.toString(),
      select: 'DOI,title,author,funder,reference,license,link,abstract,type,issued,publisher',
    });
    return result.items;
  }

  /**
   * Search journals by title
   *
   * @example
   * const result = await client.searchJournals('nature', 10);
   */
  async searchJournals(query: string, limit = 10): Promise<SearchResult<CrossrefJournal>> {
    return this.fetch<SearchResult<CrossrefJournal>>('/journals', {
      query,
      rows: limit.toString(),
    });
  }

  // ============ WORKS ENDPOINTS ============

  /**
   * Get a single work by DOI
   *
   * @example
   * const work = await client.getWork('10.1038/nature12373');
   */
  async getWork(doi: string): Promise<CrossrefWork> {
    return this.fetch<CrossrefWork>(`/works/${encodeURIComponent(doi)}`);
  }

  /**
   * Search works
   *
   * @example
   * const result = await client.searchWorks('machine learning', 20);
   */
  async searchWorks(query: string, limit = 20): Promise<WorksResult> {
    return this.fetch<WorksResult>('/works', {
      query,
      rows: limit.toString(),
    });
  }

  // ============ UTILITY METHODS ============

  /**
   * Check if the API is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.fetch('/members', { rows: '1' });
      return true;
    } catch {
      return false;
    }
  }
}

// Export a default instance factory
export function createCrossrefClient(options?: CrossrefClientOptions): CrossrefClient {
  return new CrossrefClient(options);
}
