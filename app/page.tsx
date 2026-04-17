'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLiff } from '@/app/context/LiffContext';
import { currentUser, store } from '@/data/dummyData';
import { fetchReservationsFromGas } from '@/lib/reservationApi';
import type { PastReservation } from '@/types';

const MAP_EMBED_SRC =
  process.env.NEXT_PUBLIC_MAP_EMBED_SRC?.trim() ??
  'https://www.google.com/maps?q=Tokyo+Station&output=embed';

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[#B0A090] flex-shrink-0">{icon}</span>
      <span className="text-sm text-[#7A6555]">{text}</span>
    </div>
  );
}

export default function HomePage() {
  const { profile } = useLiff();
  const [upcomingReservation, setUpcomingReservation] = useState<
    PastReservation | undefined
  >(undefined);
  useEffect(() => {
    let alive = true;
    (async () => {
      const lineUserId = profile?.userId?.trim() ?? '';
      const result = await fetchReservationsFromGas(
        lineUserId
          ? {
              lineUserId,
              customerName:
                profile?.displayName?.trim() || currentUser.name,
              limit: 10,
            }
          : { customerName: currentUser.name, limit: 10 },
      );
      if (!alive) return;
      if (!result.ok) {
        setUpcomingReservation(undefined);
        return;
      }
      const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
      const upcoming = result.reservations
        .filter((r) => r.status === 'upcoming' && r.date >= todayStr)
        .sort((a, b) => (a.date + a.time > b.date + b.time ? 1 : -1))[0];
      setUpcomingReservation(upcoming);
    })();
    return () => {
      alive = false;
    };
  }, [profile?.userId, profile?.displayName]);

  return (
    <div className="min-h-full bg-[#FAF7F2]">
      {/* ヘッダー */}
      <header className="bg-[#FFFEFB] px-4 pt-10 pb-5 border-b border-[#F0E9E0]">
        <p className="text-[10px] text-[#B5714A] font-bold tracking-widest uppercase mb-1">
          Hair Salon
        </p>
        <h1 className="text-2xl font-bold text-[#2C1A0E]">{store.name}</h1>
      </header>

      <div className="px-4 py-5 space-y-4">
        {/* 次回予約バナー：当日以降の予約があるときだけ表示 */}
        {upcomingReservation && (
          <Link href="/history">
            <div className="rounded-2xl p-4 border bg-[#F5E8DD] border-[#E8C9A8] flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-[#B5714A]/15 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-[#B5714A]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#B5714A] font-medium">次回のご予約</p>
                <p className="text-lg font-bold text-[#2C1A0E] mt-1 leading-tight">
                  {upcomingReservation.date.replace(/-/g, '/')}（{upcomingReservation.time}〜）
                </p>
                <p className="text-xs text-[#7A6555] truncate mt-1">
                  {upcomingReservation.customerName
                    ? `${upcomingReservation.customerName}様 / `
                    : ''}
                  {upcomingReservation.menuName} / {upcomingReservation.staffName}
                </p>
              </div>
              <svg className="w-4 h-4 text-[#B5714A] flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* 店舗情報カード */}
        <div className="bg-[#FFFEFB] rounded-2xl border border-[#E8DDD2] overflow-hidden">
          <div className="h-20 bg-gradient-to-br from-[#F5E8DD] to-[#EDD8C4] relative flex items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-[#B5714A] flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd"
                  d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.079 3.843-5.086 3.843-9.328a6.75 6.75 0 00-13.5 0c0 4.242 1.9 7.25 3.843 9.328a19.576 19.576 0 002.682 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="px-4 py-4 space-y-2.5">
            <h2 className="text-sm font-bold text-[#2C1A0E]">{store.name}</h2>
            <InfoRow
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>}
              text={store.address}
            />
            <InfoRow
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>}
              text={store.tel}
            />
            <InfoRow
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              text={`${store.openTime} 〜 ${store.closeTime}`}
            />
            <InfoRow
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
              text={`定休日：${store.holiday}`}
            />
          </div>
        </div>

        {/* Googleマップ（東京のサンプル） */}
        <div className="bg-[#FFFEFB] rounded-2xl border border-[#E8DDD2] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0E9E0] bg-[#FDF5EF]">
            <p className="text-xs font-bold text-[#7A3E1E]">アクセス</p>
          </div>
          <div className="p-3">
            <div className="rounded-xl overflow-hidden border border-[#E8DDD2] bg-white">
              <iframe
                title="Google Maps（サンプル）"
                src={MAP_EMBED_SRC}
                width="600"
                height="450"
                style={{ border: 0, width: '100%', height: 220, display: 'block' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <p className="text-[10px] text-[#B0A090] mt-2">
              埋め込みは `.env.local` の `NEXT_PUBLIC_MAP_EMBED_SRC` がある場合はそれを優先します。
            </p>
          </div>
        </div>

        {/* お知らせ */}
        <div className="bg-[#FDF5EF] border border-[#E8C9A8] rounded-2xl px-4 py-3.5">
          <p className="text-xs font-bold text-[#7A3E1E] mb-1">お知らせ</p>
          <p className="text-xs text-[#7A6555] leading-relaxed">
            春の新メニュー「髪質改善トリートメント」が登場しました。
            4月30日まで初回限定20%OFFでご提供中です。
          </p>
        </div>
      </div>
    </div>
  );
}
