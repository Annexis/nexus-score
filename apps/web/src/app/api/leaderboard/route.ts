import { NextRequest, NextResponse } from 'next/server';
import { rankByScore, isScorableContentType, type BenchmarkEntry } from '@nexus-score/core';
import { getBenchmarkSnapshots } from '@/lib/benchmark-data';

type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
type Era = 'overall' | 'current';
type DimensionKey = 'provenance' | 'people' | 'organizations' | 'funding' | 'access';
type SortField = 'default' | 'score' | 'works' | 'improvement' | DimensionKey;
type SortDirection = 'asc' | 'desc';
type OverallEntry = BenchmarkEntry;
type CurrentEntry = BenchmarkEntry;
const GRADES = new Set<Grade>(['A', 'B', 'C', 'D', 'F']);
const DIMENSIONS = new Set<DimensionKey>(['provenance', 'people', 'organizations', 'funding', 'access']);

function integer(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value === null ? fallback : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function gradeFor(score: number): Grade {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const era: Era = params.get('era') === 'current' ? 'current' : 'overall';
  const contentType = (params.get('contentType') || 'all').slice(0, 100);
  const search = (params.get('search') || '').trim().slice(0, 200).toLocaleLowerCase();
  const gradeParam = params.get('grade');
  const grade = gradeParam && GRADES.has(gradeParam as Grade) ? gradeParam as Grade : null;
  const sort = (params.get('sort') || 'default') as SortField;
  const direction: SortDirection = params.get('direction') === 'asc' ? 'asc' : 'desc';
  const limit = integer(params.get('limit'), 50, 1, 500);
  const offset = integer(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);
  const pair = getBenchmarkSnapshots();
  const overall = pair?.overall;
  const current = pair?.current;

  if (!overall || !current) {
    return NextResponse.json({ error: 'Compatible benchmark snapshots are not available. Regenerate both eras.' }, { status: 503 });
  }

  if (contentType !== 'all' && !isScorableContentType(contentType)) {
    return NextResponse.json({ error: 'This record type is not benchmarked.' }, { status: 400 });
  }

  const primary = era === 'current' ? current.leaderboard : overall.leaderboard;
  const comparison = new Map((era === 'current' ? overall.leaderboard : current.leaderboard).map((entry) => [entry.id, entry]));

  let scoped = primary.flatMap((entry) => {
    const selected = contentType === 'all' ? null : entry.contentTypes?.find((item) => item.type === contentType);
    if (contentType !== 'all' && !selected) return [];
    const other = comparison.get(entry.id);
    const otherType = contentType === 'all' ? null : other?.contentTypes?.find((item) => item.type === contentType);
    const score = selected?.score ?? entry.score;
    const comparisonScore = contentType === 'all'
      ? (era === 'current' ? (entry as CurrentEntry).overallScore : (entry as OverallEntry).currentScore ?? null)
      : otherType?.score ?? null;
    const improvement = era === 'current'
      ? (entry as CurrentEntry).improvement ?? null
      : (entry as OverallEntry).improvement ?? null;
    const currentVsOverall = comparisonScore === null
      ? null
      : era === 'current'
        ? score - comparisonScore
        : comparisonScore - score;
    const publisherPeriodWorks = era === 'current'
      ? (entry as CurrentEntry).currentWorks ?? null
      : entry.scopeWorks;
    const selectedTypeWorks = selected?.works ?? null;

    return [{
      rank: entry.rank,
      id: entry.id,
      name: entry.name,
      location: entry.location,
      score,
      grade: selected?.grade ?? gradeFor(score),
      totalWorks: entry.totalWorks,
      scopeWorks: contentType === 'all' ? publisherPeriodWorks : selectedTypeWorks ?? publisherPeriodWorks,
      scopeWorksExact: contentType === 'all' || selectedTypeWorks !== null,
      comparisonScore,
      comparisonLabel: era === 'current' ? 'Overall' : 'Current',
      improvement,
      currentVsOverall,
      dimensions: selected?.dimensions ?? entry.dimensions,
    }];
  });

  // Re-rank inside the selected era/content-type cohort. Equal scores share
  // one competition rank instead of receiving arbitrary sequential ranks.
  scoped = rankByScore(scoped, (entry) => entry.score);

  const scopeTotal = scoped.length;
  const averageScore = scopeTotal > 0 ? Math.round(scoped.reduce((sum, entry) => sum + entry.score, 0) / scopeTotal * 10) / 10 : 0;
  const highestScore = scoped[0]?.score ?? 0;
  const distribution = [
    { label: '80-100', min: 80, max: 101 },
    { label: '65-79', min: 65, max: 80 },
    { label: '50-64', min: 50, max: 65 },
    { label: '35-49', min: 35, max: 50 },
    { label: '0-34', min: 0, max: 35 },
  ].map((band) => ({ ...band, count: scoped.filter((entry) => entry.score >= band.min && entry.score < band.max).length }));

  let filtered = scoped.filter((entry) => {
    if (search && !entry.name.toLocaleLowerCase().includes(search)) return false;
    if (grade && entry.grade !== grade) return false;
    return true;
  });

  const directed = (left: number, right: number) => direction === 'desc' ? right - left : left - right;
  if (sort === 'works') filtered = [...filtered].sort((a, b) => directed(a.scopeWorks ?? -1, b.scopeWorks ?? -1));
  else if (sort === 'improvement') filtered = [...filtered].sort((a, b) => directed(a.currentVsOverall ?? 0, b.currentVsOverall ?? 0));
  else if (DIMENSIONS.has(sort as DimensionKey) && contentType === 'all') {
    const dimension = sort as DimensionKey;
    filtered = [...filtered].sort((a, b) => directed(a.dimensions?.[dimension] ?? 0, b.dimensions?.[dimension] ?? 0));
  } else if (sort === 'score') filtered = [...filtered].sort((a, b) => directed(a.score, b.score));

  return NextResponse.json({
    scope: { era, contentType },
    methodologyVersion: overall.methodologyVersion,
    coverageCollectedAt: overall.coverageCollectedAt,
    fundingCollectedAt: overall.fundingCollectedAt,
    currentStart: overall.currentStart,
    currentEnd: overall.currentEnd,
    generatedAt: era === 'current' ? current.generatedAt : overall.generatedAt,
    totalMembers: era === 'current' ? current.totalMembers : overall.totalMembers,
    summary: { scopeTotal, averageScore, highestScore, distribution },
    total: filtered.length,
    offset,
    limit,
    leaderboard: filtered.slice(offset, offset + limit),
  }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
