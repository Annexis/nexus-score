#!/usr/bin/env npx tsx
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CrossrefClient, buildBenchmarkSnapshots, completeFundingCoverage, needsFundingSupplement, type CrossrefMember, type FundingOnlyWork } from '@nexus-score/core';

const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const rows = 500;

async function main() {
  const inputFlag = process.argv.indexOf('--input');
  let members: CrossrefMember[];
  let fetchedAt: string;
  if (inputFlag >= 0) {
    const path = process.argv[inputFlag + 1];
    if (!path) throw new Error('--input requires a cached member file path');
    const bytes = readFileSync(path);
    const cached = JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
    if (!Array.isArray(cached.members) || !Number.isFinite(Date.parse(cached.fetchedAt))) throw new Error('Invalid member cache');
    members = cached.members;
    fetchedAt = cached.fetchedAt;
    console.log(`Replaying ${members.length} members collected ${fetchedAt}`);
  } else {
    const client = new CrossrefClient();
    const byId = new Map<number, CrossrefMember>();
    const cursors = new Set<string>();
    let cursor = '*';
    let expected = 0;
    let duplicate = false;
    while (true) {
      if (cursors.has(cursor)) throw new Error('Crossref repeated a cursor; no snapshots were written.');
      cursors.add(cursor);
      const page = await client.listMembersPage(cursor, rows);
      if (!expected) expected = page['total-results'];
      for (const member of page.items) {
        if (byId.has(member.id)) duplicate = true;
        byId.set(member.id, member);
      }
      console.log(`Fetched ${byId.size}/${expected} members`);
      if (page.items.length < rows) break;
      if (!page['next-cursor']) throw new Error('Crossref omitted next-cursor before the end of the collection.');
      cursor = page['next-cursor'];
    }
    if (duplicate || byId.size < expected) {
      throw new Error(`Crossref changed during collection (${byId.size}/${expected}, duplicates: ${duplicate}). Retry; no snapshots were written.`);
    }
    members = [...byId.values()];
    fetchedAt = new Date().toISOString();
    // Private local cache permits repeatable methodology comparisons without
    // fetching the entire API again. This directory is gitignored.
    const cacheDirectory = join(dataDirectory, 'internal');
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(join(cacheDirectory, 'crossref-members.json.gz'), gzipSync(JSON.stringify({ fetchedAt, members })));
  }
  const memberIds = members.filter(needsFundingSupplement).map((member) => member.id);
  const fundingFlag = process.argv.indexOf('--funding-input');
  let funding: { fetchedAt: string; currentYear: number; memberIds: number[]; works: FundingOnlyWork[] };
  const currentYear = new Date(fetchedAt).getUTCFullYear();
  if (fundingFlag >= 0) {
    const path = process.argv[fundingFlag + 1];
    if (!path) throw new Error('--funding-input requires a funding cache file');
    const bytes = readFileSync(path);
    funding = JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
    if (!Array.isArray(funding.works) || !Array.isArray(funding.memberIds) || funding.currentYear !== currentYear ||
        !Number.isFinite(Date.parse(funding.fetchedAt)) || memberIds.some((id) => !funding.memberIds.includes(id))) {
      throw new Error('Funding cache does not cover this member collection and publication window.');
    }
  } else {
    console.log(`Resolving funding overlap for ${memberIds.length} members; other unions are known from /members.`);
    const works = await new CrossrefClient().getFundingOnlyWorks(memberIds, (count, total) => console.log(`Identifier-only funding batch: ${count}/${total}`));
    funding = { fetchedAt: new Date().toISOString(), currentYear, memberIds, works };
    const cacheDirectory = join(dataDirectory, 'internal');
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(join(cacheDirectory, 'funding-supplement.json.gz'), gzipSync(JSON.stringify(funding)));
  }
  const corrected = completeFundingCoverage(members, funding.works, currentYear);
  const generatedAt = new Date(Math.max(Date.parse(fetchedAt), Date.parse(funding.fetchedAt))).toISOString();
  const snapshots = buildBenchmarkSnapshots(corrected, generatedAt);
  for (const snapshot of [snapshots.overall, snapshots.current]) {
    snapshot.coverageCollectedAt = fetchedAt;
    snapshot.fundingCollectedAt = funding.fetchedAt;
  }
  if (!snapshots.overall.leaderboard.length || !snapshots.current.leaderboard.length) {
    throw new Error('No complete supported coverage; refusing to replace benchmark data.');
  }
  mkdirSync(dataDirectory, { recursive: true });
  for (const [name, snapshot] of [['leaderboard', snapshots.overall], ['current-leaderboard', snapshots.current]] as const) {
    const path = join(dataDirectory, `${name}.json`);
    writeFileSync(`${path}.tmp`, JSON.stringify(snapshot, null, 2));
  }
  // Stage both validated outputs before replacing either saved snapshot.
  for (const name of ['leaderboard', 'current-leaderboard']) {
    renameSync(join(dataDirectory, `${name}.json.tmp`), join(dataDirectory, `${name}.json`));
  }
  console.log(`Saved ${snapshots.overall.totalWithWorks} overall and ${snapshots.current.totalActive} current publishers.`);
  console.log(`Methodology: ${snapshots.overall.methodologyVersion}; current ${snapshots.overall.currentStart}–${snapshots.overall.currentEnd}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
