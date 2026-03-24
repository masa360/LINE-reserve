import { NextRequest, NextResponse } from 'next/server';

/**
 * メンバー写真一覧取得 API（GASへのプロキシ）
 * GET /api/member-photos?lineUserId=Uxxxx
 */
export async function GET(request: NextRequest) {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return NextResponse.json(
      { success: false, error: 'GAS_WEBAPP_URL が設定されていません' },
      { status: 500 },
    );
  }

  const lineUserId = request.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) {
    return NextResponse.json(
      { success: false, error: 'lineUserId は必須です' },
      { status: 400 },
    );
  }

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getMemberPhotos', lineUserId }),
  });

  const text = await res.text();
  try {
    const data = JSON.parse(text) as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: text || 'GAS からの応答を解析できませんでした' },
      { status: res.status },
    );
  }
}
