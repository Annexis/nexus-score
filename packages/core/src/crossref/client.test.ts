import { afterEach, expect, it, vi } from 'vitest';
import { CrossrefClient } from './client.js';
import { CrossrefNotFoundError } from './errors.js';

afterEach(() => vi.unstubAllGlobals());

it('retains rows and mailto while advancing the member cursor', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: { items: [], 'next-cursor': 'next-page' } })));
  vi.stubGlobal('fetch', fetch);
  const client = new CrossrefClient({ mailto: 'cursor-test@example.org' });
  expect((await client.listMembersPage('*', 500))['next-cursor']).toBe('next-page');
  await client.listMembersPage('next-page', 500);
  const urls = fetch.mock.calls.map(([url]) => new URL(url));
  expect(urls.map((url) => url.searchParams.get('cursor'))).toEqual(['*', 'next-page']);
  expect(urls.every((url) => url.searchParams.get('rows') === '500' && url.searchParams.get('mailto') === 'cursor-test@example.org')).toBe(true);
});

it('retries a rate-limited request using Retry-After', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: { id: 16 } })));
  vi.stubGlobal('fetch', fetch);
  expect((await new CrossrefClient({ mailto: 'retry-test@example.org' }).getMember(16)).id).toBe(16);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not retry missing members', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('missing', { status: 404 }));
  vi.stubGlobal('fetch', fetch);
  await expect(new CrossrefClient({ mailto: 'missing-test@example.org' }).getMember(999)).rejects.toBeInstanceOf(CrossrefNotFoundError);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('restricts funding collection to the disjoint ROR cohort and requested members', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { items: [], 'total-results': 0 } })));
  vi.stubGlobal('fetch', fetch);
  expect(await new CrossrefClient({ mailto: 'funding-filter@example.org' }).getFundingOnlyWorks([123, 456])).toEqual([]);
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.get('filter')).toBe('has-funder-ror-id:true,has-funder:false,member:123,member:456');
  expect(url.searchParams.get('select')).toBe('DOI,member,type,issued');
});

it('keeps funding filters when paging and counts each DOI once', async () => {
  const firstPage = Array.from({ length: 1000 }, (_, n) => ({ DOI: `10.test/${n}`, member: '123', type: 'journal-article' }));
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message: { items: firstPage, 'total-results': 1001, 'next-cursor': 'second' } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: { items: [firstPage[0], { ...firstPage[0], DOI: '10.test/1000' }], 'total-results': 1001 } })));
  vi.stubGlobal('fetch', fetch);
  const works = await new CrossrefClient({ mailto: 'funding-cursor@example.org' }).getFundingOnlyWorks([123]);
  expect(works).toHaveLength(1001);
  const urls = fetch.mock.calls.map(([url]) => new URL(url));
  expect(urls.map((url) => url.searchParams.get('cursor'))).toEqual(['*', 'second']);
  expect(urls[0].searchParams.get('filter')).toBe(urls[1].searchParams.get('filter'));
});

it('refuses incomplete funding collections', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { items: [], 'total-results': 1 } }))));
  await expect(new CrossrefClient({ mailto: 'funding-incomplete@example.org' }).getFundingOnlyWorks([123])).rejects.toThrow('collection changed');
});

it('uses Participation Report coverage directly for ROR-only members and shares concurrent profile requests', async () => {
  const raw = { id: 123, 'counts-type': { all: { 'journal-article': 10 } },
    'coverage-type': { all: { 'journal-article': { funders: 0, 'funder-ror-ids': 0.5 } }, current: {}, backfile: {} } };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: raw })));
  vi.stubGlobal('fetch', fetch);
  const client = new CrossrefClient({ mailto: 'funding-member-direct@example.org' });
  const [one, two] = await Promise.all([client.getMemberForScoring(123), client.getMemberForScoring(123)]);
  expect(one).toBe(two);
  expect(one['coverage-type'].all['journal-article']['funders-including-ror']).toBe(0.5);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('resolves mixed identifiers before returning a member for scoring', async () => {
  const raw = { id: 123, 'counts-type': { all: { 'journal-article': 10 } },
    'coverage-type': { all: { 'journal-article': { funders: 0.4, 'funder-ror-ids': 0.4 } }, current: {}, backfile: {} } };
  const works = [1, 2].map((id) => ({ DOI: `10.test/${id}`, member: '123', type: 'journal-article', issued: { 'date-parts': [[2026]] } }));
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message: raw })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: { items: works, 'total-results': 2 } })));
  vi.stubGlobal('fetch', fetch);
  const result = await new CrossrefClient({ mailto: 'funding-member-mixed@example.org' }).getMemberForScoring(123);
  expect(result['coverage-type'].all['journal-article']['funders-including-ror']).toBeCloseTo(0.6);
  expect(result['coverage-type'].all['journal-article'].funders).toBe(0.4);
  expect(fetch).toHaveBeenCalledTimes(2);
});
