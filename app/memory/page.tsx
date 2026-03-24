'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useLiff } from '@/app/context/LiffContext';

/* ─── 型定義 ─────────────────────────────────────────────── */
interface Photo {
  savedAt: string;
  fileId: string;
  viewUrl: string;
  thumbnailUrl: string;
}

interface GroupedPhotos {
  label: string; // "2025年12月"
  photos: Photo[];
}

/* ─── 日付ユーティリティ ─────────────────────────────────── */
function toMonthLabel(savedAt: string): string {
  const d = new Date(savedAt.replace(/\//g, '-'));
  if (isNaN(d.getTime())) return savedAt.slice(0, 7);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function toDateLabel(savedAt: string): string {
  const d = new Date(savedAt.replace(/\//g, '-'));
  if (isNaN(d.getTime())) return savedAt;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ─── 写真取得フック ─────────────────────────────────────── */
function useMemberPhotos(lineUserId: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lineUserId) return;
    setLoading(true);
    setError(null);
    void fetch(`/api/member-photos?lineUserId=${encodeURIComponent(lineUserId)}`)
      .then((r) => r.json() as Promise<{ success: boolean; photos?: Photo[]; error?: string }>)
      .then((data) => {
        if (data.success && data.photos) {
          setPhotos(data.photos);
        } else {
          setError(data.error ?? '取得に失敗しました');
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '通信エラーが発生しました');
      })
      .finally(() => setLoading(false));
  }, [lineUserId]);

  return { photos, loading, error };
}

/* ─── ライトボックス ─────────────────────────────────────── */
function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 日付バッジ */}
        <div className="mb-2 text-center text-sm text-white/70">
          {toDateLabel(photo.savedAt)}
        </div>

        {/* 写真 */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src={photo.thumbnailUrl}
            alt={`ヘアスタイル写真 ${photo.savedAt}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 480px"
            unoptimized
          />
        </div>

        {/* Driveで開くリンク */}
        <a
          href={photo.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Google Drive で見る
        </a>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl leading-none"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ─── メインページ ───────────────────────────────────────── */
export default function MemoryPage() {
  const { ready, profile } = useLiff();
  const { photos, loading, error } = useMemberPhotos(profile?.userId ?? null);
  const [selected, setSelected] = useState<Photo | null>(null);

  /* 月ごとにグループ化（新しい順） */
  const groups = useMemo<GroupedPhotos[]>(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const label = toMonthLabel(p.savedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(p);
    }
    return Array.from(map.entries()).map(([label, ps]) => ({ label, photos: ps }));
  }, [photos]);

  /* ─ ローディング ─ */
  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#b5967a] border-t-transparent animate-spin" />
          <p className="text-sm text-[#8a7060]">読み込み中…</p>
        </div>
      </div>
    );
  }

  /* ─ LINEログイン未完了 ─ */
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-[#5a4a3a] font-medium">LINE でログインしてください</p>
          <p className="text-xs text-[#8a7060] mt-1">LINEアプリ内から開いてください</p>
        </div>
      </div>
    );
  }

  /* ─ エラー ─ */
  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-[#5a4a3a] font-medium">読み込みに失敗しました</p>
          <p className="text-xs text-[#8a7060] mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0eb]">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-[#f5f0eb]/90 backdrop-blur-md border-b border-[#e0d5c8]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          {profile.pictureUrl && (
            <Image
              src={profile.pictureUrl}
              alt="プロフィール"
              width={32}
              height={32}
              className="rounded-full"
              unoptimized
            />
          )}
          <div>
            <p className="text-[10px] text-[#8a7060] uppercase tracking-widest">Memory</p>
            <h1 className="text-sm font-semibold text-[#3a2a1a] leading-tight">
              {profile.displayName} さんのヘアスタイル
            </h1>
          </div>
          <span className="ml-auto text-xs text-[#8a7060] bg-[#e8ddd0] px-2 py-0.5 rounded-full">
            {photos.length} 枚
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {/* 写真ゼロ状態 */}
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-[#e8ddd0] flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-[#b5967a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-medium text-[#5a4a3a]">まだ写真がありません</p>
            <p className="text-xs text-[#8a7060] mt-1 leading-relaxed">
              LINEのトーク画面から<br />写真を送ると自動保存されます
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.label}>
                {/* 月見出し */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-[#d5c8b8]" />
                  <span className="text-xs font-semibold text-[#8a7060] tracking-wide">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-[#d5c8b8]" />
                </div>

                {/* グリッド（2列） */}
                <div className="grid grid-cols-2 gap-2">
                  {group.photos.map((photo) => (
                    <button
                      key={photo.fileId}
                      onClick={() => setSelected(photo)}
                      className="relative aspect-square rounded-xl overflow-hidden shadow-sm
                                 ring-1 ring-[#d5c8b8] hover:ring-[#b5967a] hover:shadow-md
                                 transition-all duration-200 group"
                    >
                      <Image
                        src={photo.thumbnailUrl}
                        alt={`ヘアスタイル ${photo.savedAt}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 240px"
                        unoptimized
                      />
                      {/* 日付オーバーレイ */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
                        <p className="text-white text-[10px] font-medium">
                          {toDateLabel(photo.savedAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {/* 保持期間の注記 */}
            <p className="text-center text-[10px] text-[#a89888] pb-4">
              写真は送信から1年間保存されます（最大4枚）
            </p>
          </div>
        )}
      </main>

      {/* ライトボックス */}
      {selected && (
        <Lightbox photo={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
