import { NextRequest, NextResponse } from 'next/server';

/**
 * GAS ウェブアプリへのプロキシ（CORS回避用）
 * フロントは /api/reservations にだけ fetch する。
 *
 * 環境変数: GAS_WEBAPP_URL = デプロイした https://script.google.com/macros/s/.../exec
 */
export async function POST(request: NextRequest) {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          'サーバーに GAS_WEBAPP_URL が設定されていません。.env.local を参照してください。',
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'JSON 本文が不正です' },
      { status: 400 },
    );
  }

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
