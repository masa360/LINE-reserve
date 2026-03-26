import { NextRequest, NextResponse } from 'next/server';

/**
 * GAS の GET ?action=photos&lineUserId=... へプロキシ（ブラウザからの CORS 回避）
 */
export async function GET(request: NextRequest) {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl || !gasUrl.trim()) {
    return NextResponse.json(
      { success: false, error: 'サーバーに GAS_WEBAPP_URL が設定されていません。' },
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

  const base = gasUrl.trim().replace(/\?+$/, '');
  const sep = base.includes('?') ? '&' : '?';
  const target = `${base}${sep}action=photos&lineUserId=${encodeURIComponent(lineUserId)}`;

  const res = await fetch(target, { method: 'GET' });
  const text = await res.text();
  try {
    const data = JSON.parse(text) as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: text || 'GAS の応答を JSON として解析できませんでした' },
      { status: 502 },
    );
  }
}
