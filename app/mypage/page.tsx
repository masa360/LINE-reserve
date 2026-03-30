'use client';

import Link from 'next/link';
import { currentUser, pastReservations } from '@/data/dummyData';

function Barcode() {
  const bars = [3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 1];
  return (
    <div className="flex items-end gap-[1.5px] h-10">
      {bars.map((width, i) => (
        <div key={i} className="bg-[#2C1A0E] h-full" style={{ width: `${width * 2}px` }} />
      ))}
    </div>
  );
}

interface MenuLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}

function MenuLink({ href, icon, title, subtitle, badge }: MenuLinkProps) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-4 py-3.5 bg-[#FFFEFB] hover:bg-[#FDF5EF] transition-colors">
      <div className="w-9 h-9 rounded-xl bg-[#F5E8DD] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2C1A0E]">{title}</p>
        {subtitle && <p className="text-xs text-[#B0A090] mt-0.5">{subtitle}</p>}
      </div>
      {badge && (
        <span className="text-xs font-bold text-[#7A3E1E] bg-[#F5E8DD] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <svg className="w-4 h-4 text-[#D4C4B4] flex-shrink-0" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function MyPage() {
  const user = currentUser;
  const upcomingCount  = pastReservations.filter((r) => r.status === 'upcoming').length;
  const completedCount = pastReservations.filter((r) => r.status === 'completed').length;

  return (
    <div className="min-h-full bg-[#FAF7F2]">
      <header className="bg-[#FFFEFB] px-4 pt-10 pb-4 border-b border-[#F0E9E0]">
        <h1 className="text-lg font-bold text-[#2C1A0E]">マイページ</h1>
      </header>

      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* ユーザー情報 */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D4956A] to-[#B5714A] flex items-center justify-center shadow-md">
            <span className="text-xl font-bold text-white">田</span>
          </div>
          <div>
            <p className="text-base font-bold text-[#2C1A0E]">{user.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-[#7A6555]">累計来店 {user.visitCount}回</span>
            </div>
          </div>
        </div>

        {/* デジタル会員証カード */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#8C7565] to-[#6B5444] p-5 shadow-lg">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute right-4 bottom-4 w-20 h-20 rounded-full bg-white/5" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase">
                  SALON de LUMIÈRE
                </p>
                <p className="text-white font-bold text-lg mt-0.5">MEMBERSHIP CARD</p>
              </div>
              <span className="text-white/80 text-xs font-bold tracking-wider">MEMBER</span>
            </div>
            <p className="text-white font-bold text-base tracking-wider">{user.name}</p>
            <div className="mt-3 bg-white/90 rounded-lg p-2.5 inline-block">
              <Barcode />
              <p className="text-[9px] text-[#2C1A0E] text-center mt-1 font-mono tracking-widest">
                {user.memberNumber}
              </p>
            </div>
          </div>
        </div>

        {/* 予約サマリー */}
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-[#FFFEFB] rounded-2xl p-4 border border-[#E8DDD2]">
            <p className="text-xs text-[#7A6555]">次回の予約</p>
            <p className="text-2xl font-bold text-[#2C1A0E] mt-1">
              {upcomingCount}
              <span className="text-sm font-medium text-[#7A6555] ml-1">件</span>
            </p>
            <p className="text-xs text-[#B0A090] mt-2">累計来店：{completedCount}回</p>
            <Link href="/history"
              className="mt-2 inline-block text-[10px] font-bold text-[#B5714A] border border-[#E8C9A8] rounded-lg px-2 py-1 bg-[#FDF5EF]">
              履歴を確認
            </Link>
          </div>
        </div>
      </div>

      {/* メニューリスト */}
      <div className="mt-1 border-t border-[#F0E9E0]">
        <div className="divide-y divide-[#F0E9E0]">
          <MenuLink href="/reservation"
            icon={<svg className="w-5 h-5 text-[#B5714A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
            title="予約する" subtitle="空き状況を確認して予約" />
          <MenuLink href="/history"
            icon={<svg className="w-5 h-5 text-[#B5714A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="予約履歴" subtitle="過去の予約・来店履歴"
            badge={upcomingCount > 0 ? `次回${upcomingCount}件` : undefined} />
          <MenuLink href="/mypage"
            icon={<svg className="w-5 h-5 text-[#B5714A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
            title="プロフィール編集" subtitle="名前・連絡先の変更" />
          <MenuLink href="/mypage"
            icon={<svg className="w-5 h-5 text-[#B5714A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            title="設定" subtitle="通知・プライバシー設定" />
        </div>
      </div>

      <p className="text-center text-[10px] text-[#D4C4B4] py-6">
        SALON de LUMIÈRE App v1.0.0
      </p>
    </div>
  );
}
