'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useReservation } from '@/app/context/ReservationContext';
import { useLiff } from '@/app/context/LiffContext';
import { currentUser, menus, pastReservations, staffList } from '@/data/dummyData';
import { cancelReservationOnGas, fetchReservationsFromGas } from '@/lib/reservationApi';
import type { PastReservation } from '@/types';

const TEMP_STORE_PHONE = '03-0000-0000';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}
function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`;
}

function canCancelOnline(reservation: PastReservation, now: Date): boolean {
  // 当日9:00までオンラインキャンセル可
  const deadline = new Date(`${reservation.date}T09:00:00`);
  return now.getTime() <= deadline.getTime();
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
  const router = useRouter();
  const { profile } = useLiff();
  const { dispatch } = useReservation();
  const [reservations, setReservations] = useState<PastReservation[]>(pastReservations);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const upcoming = useMemo(
    () => reservations.filter((r) => r.status === 'upcoming'),
    [reservations],
  );
  const past = useMemo(
    () => reservations.filter((r) => r.status !== 'upcoming'),
    [reservations],
  );

  const normalize = (s: string) => s.replace(/[ 　]/g, '').toLowerCase();
  const findMenu = (name: string) => {
    const key = normalize(name);
    return menus.find((m) => normalize(m.name) === key) ?? null;
  };
  const findStaff = (name: string) =>
    staffList.find((s) => s.name === name) ?? staffList[0];
  const handleRebook = (res: PastReservation) => {
    const parts = res.menuName.split('＋').map((x) => x.trim()).filter(Boolean);
    const base = parts.map(findMenu).find((m) => m?.category === 'cut') ?? null;
    if (!base) return;
    const style = parts.map(findMenu).find((m) => m?.category === 'colorperm') ?? null;
    const care = parts.map(findMenu).find((m) => m?.category === 'care') ?? null;
    dispatch({
      type: 'APPLY_REBOOK_PATCH',
      payload: {
        selectedMenu: base,
        selectedStyleMenu: style,
        selectedCareMenu: care,
        selectedStaff: findStaff(res.staffName),
      },
    });
    router.push('/reservation/step2');
  };

  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
              limit: 50,
            }
          : { customerName: currentUser.name, limit: 50 },
      );
      if (!alive) return;
      if (result.ok && result.reservations.length > 0) {
        setReservations(result.reservations);
      }
      setLoadingReservations(false);
    })();
    return () => {
      alive = false;
    };
  }, [profile?.userId, profile?.displayName]);

  const handleCancel = async (res: PastReservation) => {
    if (!canCancelOnline(res, new Date())) {
      setCancelMessage(
        `この予約は当日9:00を過ぎているため、オンラインでは取消できません。店舗へお電話ください（${TEMP_STORE_PHONE}）。`,
      );
      return;
    }

    const ok = window.confirm('この予約をキャンセルしますか？');
    if (!ok) return;

    setCancellingId(res.id);
    const result = await cancelReservationOnGas({
      eventId: res.id,
      date: res.date,
      time: res.time,
      staffName: res.staffName,
      menuName: res.menuName,
      customerName: res.customerName?.trim() || currentUser.name,
      lineUserId: profile?.userId ?? '',
    });
    setCancellingId(null);

    if (!result.success) {
      if (result.requirePhoneCall) {
        setCancelMessage(
          `この予約は当日9:00を過ぎているため、オンラインでは取消できません。店舗へお電話ください（${TEMP_STORE_PHONE}）。`,
        );
      } else {
        setCancelMessage(result.error || '取消に失敗しました。時間をおいて再度お試しください。');
      }
      return;
    }

    setReservations((prev) =>
      prev.map((item) =>
        item.id === res.id ? { ...item, status: 'cancelled' } : item,
      ),
    );
    setCancelMessage('予約をキャンセルしました。');
  };

  return (
    <div className="min-h-full bg-[#FAF7F2]">
      <header className="bg-[#FFFEFB] px-4 pt-10 pb-4 border-b border-[#F0E9E0]">
        <h1 className="text-lg font-bold text-[#2C1A0E]">予約履歴</h1>
      </header>

      <div className="px-4 py-4 space-y-5">
        {cancelMessage && (
          <div className="rounded-xl border border-[#E8C9A8] bg-[#FDF5EF] px-3 py-2 text-xs text-[#7A3E1E]">
            {cancelMessage}
          </div>
        )}
        {loadingReservations && (
          <div className="rounded-xl border border-[#E8DDD2] bg-[#FFFEFB] px-3 py-2 text-xs text-[#7A6555]">
            最新の予約履歴を読み込み中...
          </div>
        )}

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
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRebook(res)}
                      className="text-[10px] font-bold text-[#7A3E1E] border border-[#E8C9A8] rounded-lg px-2 py-1 bg-[#FDF5EF]"
                    >
                      同じ内容で再予約
                    </button>
                    <Link
                      href="/reservation"
                      className="text-[10px] font-bold text-[#7A6555] border border-[#E8DDD2] rounded-lg px-2.5 py-1.5 hover:bg-[#F5E8DD] transition-colors"
                    >
                      変更
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleCancel(res)}
                      disabled={cancellingId === res.id}
                      className="text-[10px] font-bold text-[#7A6555] border border-[#E8DDD2] rounded-lg px-2.5 py-1.5 hover:bg-[#F5E8DD] transition-colors"
                    >
                      {cancellingId === res.id ? 'キャンセル中...' : 'キャンセル'}
                    </button>
                  </div>
                </div>
                <div className="h-px bg-[#F0E9E0] my-3" />
                <div className="space-y-1.5">
                  {[
                    ...(res.customerName
                      ? [{ label: 'お客様名', value: res.customerName } as const]
                      : []),
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
                      {res.customerName && (
                        <p className="text-[10px] text-[#7A6555] mt-0.5">お客様：{res.customerName}</p>
                      )}
                      <p className="text-sm font-semibold text-[#2C1A0E] mt-0.5">{res.menuName}</p>
                    </div>
                    <StatusBadge status={res.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7A6555]">担当：{res.staffName}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRebook(res)}
                        className="text-[10px] font-bold text-[#7A3E1E] border border-[#E8C9A8] rounded-lg px-2 py-1 bg-[#FDF5EF]"
                      >
                        同じ内容で再予約
                      </button>
                      <span className="text-xs font-bold text-[#B5714A]">{formatPrice(res.price)}</span>
                    </div>
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
        <p className="text-[10px] text-[#B0A090] leading-relaxed">
          予約取消は当日9:00までオンライン対応です。以降は店舗へ電話連絡（仮: {TEMP_STORE_PHONE}）をお願いします。
        </p>
      </div>
    </div>
  );
}
