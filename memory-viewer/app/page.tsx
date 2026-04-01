'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import liff from '@line/liff';

type Photo = {
  savedAt: string;
  fileId: string;
  viewUrl: string;
  thumbnailUrl: string;
};

function monthLabel(savedAt: string): string {
  const d = new Date(savedAt.replace(/\//g, '-'));
  if (Number.isNaN(d.getTime())) return savedAt.slice(0, 7);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function shortDate(savedAt: string): string {
  const d = new Date(savedAt.replace(/\//g, '-'));
  if (Number.isNaN(d.getTime())) return savedAt;
  return `${d.getMonth() + 1}/${d.getDate()}日`;
}

export default function MemoryPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setError('NEXT_PUBLIC_LIFF_ID が未設定です');
      setReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await liff.init({ liffId });
        if (cancelled) return;
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const p = await liff.getProfile();
        if (cancelled) return;
        setDisplayName(p.displayName);

        const res = await fetch(
          `/api/photos?lineUserId=${encodeURIComponent(p.userId)}`,
        );
        const data = (await res.json()) as {
          success?: boolean;
          photos?: Photo[];
          error?: string;
        };
        if (!data.success) {
          setError(data.error ?? '取得に失敗しました');
          setReady(true);
          return;
        }
        setPhotos(data.photos ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Photo[]>();
    for (const p of photos) {
      const key = monthLabel(p.savedAt);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return Array.from(m.entries());
  }, [photos]);

  if (!ready) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#7a6555' }}>
        <p>読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#b5714a', fontWeight: 700 }}>エラー</p>
        <p style={{ fontSize: 14, color: '#7a6555' }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <header
        style={{
          background: '#fffefb',
          borderBottom: '1px solid #e8ddd2',
          padding: 16,
          position: 'sticky',
          top: 0,
        }}
      >
        <p style={{ margin: 0, fontSize: 10, color: '#b5714a', fontWeight: 700 }}>MEMORY</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: '4px 0 0', fontSize: 18 }}>
            {displayName ?? 'ゲスト'} さんのメモリー
          </h1>
          <span
            style={{
              fontSize: 11,
              color: '#b5714a',
              background: '#f5e8dd',
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            {photos.length} 枚
          </span>
        </div>
      </header>

      <main style={{ padding: 14 }}>
        {photos.length === 0 ? (
          <div style={{ marginTop: 56, textAlign: 'center', color: '#7a6555', lineHeight: 1.8 }}>
            <p style={{ fontWeight: 700, color: '#2c1a0e' }}>まだ写真がありません</p>
            <p style={{ fontSize: 14 }}>
              LINEのトークで写真を送ると、ここに表示されます。
            </p>
          </div>
        ) : (
          <>
            {groups.map(([month, items]) => (
              <section key={month} style={{ marginBottom: 24 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#b5714a',
                    margin: '18px 0 10px',
                  }}
                >
                  {month}
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  {items.map((photo) => (
                    <a
                      key={photo.fileId}
                      href={photo.viewUrl || photo.thumbnailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        border: '1px solid #e8ddd2',
                        borderRadius: 14,
                        overflow: 'hidden',
                        background: '#fff',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
                        <Image
                          src={photo.thumbnailUrl}
                          alt=""
                          fill
                          sizes="50vw"
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: '#7a6555', padding: '6px 8px 8px' }}>
                        {shortDate(photo.savedAt)}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))}
            <p style={{ fontSize: 10, color: '#b0a090', textAlign: 'center', marginTop: 8 }}>
              写真は直近1年で最大4枚まで保存されます
            </p>
          </>
        )}
      </main>
    </>
  );
}
