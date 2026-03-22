'use client';

import Link from 'next/link';
import { pastReservations } from '@/data/dummyData';
import type { PastReservation } from '@/types';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}
function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`;
}

function StatusBadge({ status }: { status: PastReservation['status'] }) {
  const config = {
    upcoming:  { label: '予約済み', className: 'bg-sky-50 text-sky-600 border border-sky-100' },
    completed: { label: '来店済み', className: 'bg-[#F5E8DD] text-[#7A3E1E] border border-[#E8C9A8]' },
    cancelled: { label: 'キャンセル', className: 'bg-rose-50 text-rose-600 border border-rose-100' },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}

export default function HistoryPage() {
  const upcoming = pastReservations.filter((r) => r.status === 'upcoming');
  const past     = pastReservations.filter((r) => r.status !== 'upcoming');

  return (
    <div className="min-h-full bg-[#FAF7F2]">
      <header className="bg-[#FFFEFB] px-4 pt-10 pb-4 border-b border-[#F0E9E0]">
        <h1 className="text-lg font-bold text-[#2C1A0E]">予約履歴</h1>
      </header>

      <div className="px-4 py-4 space-y-5">
        {/* 次回予約 */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-[#B5714A] uppercase tracking-wider mb-2">
              次回のご予約
            </h2>
            {upcoming.map((res) => (
              <div key={res.id}
                className="bg-[#FFFEFB] rounded-2xl border-2 border-[#B5714A] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <StatusBadge status={res.status} />
                    <p className="text-sm font-bold text-[#2C1A0E] mt-2">{formatDate(res.date)}</p>
                    <p className="text-sm text-[#7A6555] font-medium">{res.time}〜</p>
                  </div>
                  <Link href="/reservation"
                    className="text-[10px] font-bold text-[#7A6555] border border-[#E8DDD2] rounded-lg px-2.5 py-1.5 hover:bg-[#F5E8DD] transition-colors">
                    変更・取消
                  </Link>
                </div>
                <div className="h-px bg-[#F0E9E0] my-3" />
                <div className="space-y-1.5">
                  {[
                    { label: 'メニュー', value: res.menuName },
                    { label: '担当',    value: res.staffName },
                    { label: '料金',    value: formatPrice(res.price) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-[#B0A090]">{row.label}</span>
                      <span className="text-xs font-semibold text-[#2C1A0E]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 過去の予約 */}
        <section>
          <h2 className="text-xs font-bold text-[#B0A090] uppercase tracking-wider mb-2">
            過去の予約
          </h2>
          <div className="space-y-2.5">
            {past.length === 0 ? (
              <div className="bg-[#FFFEFB] rounded-2xl p-8 text-center border border-[#E8DDD2]">
                <p className="text-sm text-[#B0A090]">予約履歴はありません</p>
              </div>
            ) : (
              past.map((res) => (
                <div key={res.id}
                  className="bg-[#FFFEFB] rounded-2xl border border-[#E8DDD2] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-[#B0A090]">{formatDate(res.date)} {res.time}</p>
                      <p className="text-sm font-semibold text-[#2C1A0E] mt-0.5">{res.menuName}</p>
                    </div>
                    <StatusBadge status={res.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7A6555]">担当：{res.staffName}</span>
                    <span className="text-xs font-bold text-[#B5714A]">{formatPrice(res.price)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <Link href="/reservation"
          className="flex w-full h-12 bg-[#B5714A] text-white rounded-xl text-sm font-bold items-center justify-center hover:bg-[#9A5C38] transition-colors">
          新しく予約する
        </Link>
      </div>
    </div>
  );
}
