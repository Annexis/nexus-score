import { NextRequest, NextResponse } from 'next/server';
import { CrossrefClient, calculateMemberScore, UnscorableMemberError, CrossrefNotFoundError } from '@nexus-score/core';

const client = new CrossrefClient({
  mailto: process.env.CROSSREF_MAILTO || 'varma2friend@gmail.com',
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const member = await client.getMemberForScoring(id);
    const score = calculateMemberScore(member);

    return NextResponse.json(score, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    if (error instanceof UnscorableMemberError) {
      return NextResponse.json({ error: error.message, notBenchmarked: true }, { status: 422 });
    }
    if (error instanceof CrossrefNotFoundError) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }
    console.error('Member fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member' },
      { status: 500 }
    );
  }
}
