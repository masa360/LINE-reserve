'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StepBar from '@/components/StepBar';
import { useReservation } from '@/app/context/ReservationContext';
import { createReservationOnGas } from '@/lib/reservationApi';

function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `約${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `約${h}時間${m}分` : `約${h}時間`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

export default function ReservationStep3() {
  const router = useRouter();
  const { state, dispatch } = useReservation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** 確定後の担当名（指名なしのとき GAS が割り当てたスタッフ） */
  const [confirmedStaffName, setConfirmedStaffName] = useState<string | null>(
    null,
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_CUSTOMER_NAME', payload: e.target.value });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'SET_NOTES', payload: e.target.value });
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    const menu = state.selectedMenu;
    const date = state.selectedDate;
    const time = state.selectedTime;
    if (!menu || !date || !time) {
      setSubmitError('メニュー・日付・時間が不足しています。前の画面に戻って選択してください。');
      return;
    }

    const staffId = state.selectedStaff?.id ?? 'staff-00';
    const staffName =
      state.selectedStaff?.name ?? (staffId === 'staff-00' ? '指名なし' : '');

    setIsSubmitting(true);
    const result = await createReservationOnGas({
      customerName: state.customerName.trim(),
      menuName: menu.name,
      durationMinutes: menu.duration,
      price: menu.price,
      staffId,
      staffName,
      date,
      time,
      notes: state.notes,
      lineUserId: '',
    });
    setIsSubmitting(false);

    if (result.success) {
      setConfirmedStaffName(
        result.assignedStaffName ??
          state.selectedStaff?.name ??
          '指名なし',
      );
      setIsComplete(true);
    } else {
      setSubmitError(result.error ?? '予約に失敗しました');
    }
  };

  const displayStaffName =
    confirmedStaffName ??
    state.selectedStaff?.name ??
    '指名なし';

  // 予約完了画面
  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-full bg-[#B5714A] flex items-center justify-center mb-5 shadow-lg shadow-[#B5714A]/30">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#2C1A0E]">ご予約が完了しました</h2>
        <p className="text-sm text-[#7A6555] mt-2 leading-relaxed">
          Googleカレンダーに予約を登録しました。<br />
          ご来店をお待ちしております。
        </p>

        <div className="w-full mt-6 bg-[#FFFEFB] rounded-2xl p-4 border border-[#E8DDD2] text-left">
          <p className="text-xs text-[#B5714A] font-bold mb-3">ご予約内容</p>
          <div className="space-y-2">
            {[
              { label: '日時', value: `${state.selectedDate ? formatDate(state.selectedDate) : '—'} ${state.selectedTime}` },
              { label: '担当', value: displayStaffName },
              { label: 'メニュー', value: state.selectedMenu?.name ?? '—' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-2">
                <span className="text-xs text-[#B0A090]">{row.label}</span>
                <span className="text-xs font-semibold text-[#2C1A0E] text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => { dispatch({ type: 'RESET' }); router.push('/'); }}
          className="mt-5 w-full h-12 bg-[#B5714A] text-white rounded-xl text-sm font-bold hover:bg-[#9A5C38] transition-colors">
          ホームに戻る
        </button>
        <button type="button" onClick={() => { dispatch({ type: 'RESET' }); router.push('/history'); }}
          className="mt-2 w-full h-12 bg-[#FFFEFB] border border-[#E8DDD2] text-[#2C1A0E] rounded-xl text-sm font-semibold">
          予約履歴を確認する
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      <StepBar currentStep={3} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#2C1A0E]">予約内容の確認</h2>
          <p className="text-xs text-[#7A6555] mt-0.5">内容をご確認の上、予約を確定してください</p>
        </div>

        {/* 予約サマリーカード */}
        <div className="bg-[#FFFEFB] rounded-2xl border border-[#E8DDD2] overflow-hidden">
          <div className="bg-[#F5E8DD] px-4 py-3 border-b border-[#E8C9A8]">
            <p className="text-xs text-[#7A3E1E] font-bold">ご予約内容</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            {/* 日時 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5E8DD] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#B5714A]" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-[#B0A090]">予約日時</p>
                <p className="text-sm font-semibold text-[#2C1A0E]">
                  {state.selectedDate ? formatDate(state.selectedDate) : '未選択'}
                </p>
                <p className="text-sm font-semibold text-[#2C1A0E]">{state.selectedTime ?? '未選択'}</p>
              </div>
            </div>
            <div className="h-px bg-[#F0E9E0]" />

            {/* 担当 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5E8DD] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#B5714A]" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-[#B0A090]">担当スタッフ</p>
                <p className="text-sm font-semibold text-[#2C1A0E]">{displayStaffName}</p>
                {state.selectedStaff && state.selectedStaff.id !== 'staff-00' && (
                  <p className="text-xs text-[#7A6555]">{state.selectedStaff.role}</p>
                )}
              </div>
            </div>
            <div className="h-px bg-[#F0E9E0]" />

            {/* メニュー */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5E8DD] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#B5714A]" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#B0A090]">メニュー</p>
                <p className="text-sm font-semibold text-[#2C1A0E]">{state.selectedMenu?.name ?? '未選択'}</p>
                {state.selectedMenu && (
                  <p className="text-xs text-[#7A6555]">{formatDuration(state.selectedMenu.duration)}</p>
                )}
              </div>
              {state.selectedMenu && (
                <p className="text-base font-bold text-[#B5714A]">{formatPrice(state.selectedMenu.price)}</p>
              )}
            </div>
            <div className="h-px bg-[#E8DDD2]" />

            {/* 合計 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#2C1A0E]">合計金額</span>
              <span className="text-lg font-bold text-[#B5714A]">
                {state.selectedMenu ? formatPrice(state.selectedMenu.price) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 予約者氏名 */}
        <div>
          <label className="block text-sm font-bold text-[#2C1A0E] mb-2">
            予約者氏名
            <span className="text-rose-500 ml-1 text-xs">必須</span>
          </label>
          <input type="text" value={state.customerName} onChange={handleNameChange}
            placeholder="山田 太郎"
            className="w-full h-12 px-4 border-2 border-[#E8DDD2] rounded-xl text-sm text-[#2C1A0E] bg-[#FFFEFB] focus:outline-none focus:border-[#B5714A] transition-colors placeholder:text-[#C4B4A4]" />
        </div>

        {/* ご要望 */}
        <div>
          <label className="block text-sm font-bold text-[#2C1A0E] mb-2">
            ご要望・ご相談
            <span className="text-[#B0A090] ml-1 text-xs font-normal">任意</span>
          </label>
          <textarea value={state.notes} onChange={handleNotesChange}
            placeholder="スタイルのご要望、アレルギー等がございましたらご記入ください"
            rows={4}
            className="w-full px-4 py-3 border-2 border-[#E8DDD2] rounded-xl text-sm text-[#2C1A0E] bg-[#FFFEFB] focus:outline-none focus:border-[#B5714A] transition-colors resize-none leading-relaxed placeholder:text-[#C4B4A4]" />
        </div>

        {/* 注意事項 */}
        <div className="bg-[#FDF5EF] border border-[#E8C9A8] rounded-xl px-4 py-3">
          <p className="text-xs text-[#7A6555] leading-relaxed">
            ご予約の変更・キャンセルは前日18:00まで承ります。
            当日のキャンセルはキャンセル料が発生する場合がございます。
          </p>
        </div>
      </div>

      {/* 予約確定ボタン */}
      <div className="px-4 pt-3 pb-4 bg-[#FFFEFB] border-t border-[#F0E9E0]">
        {submitError && (
          <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-800">
            {submitError}
          </div>
        )}
        <button type="button" onClick={handleSubmit}
          disabled={isSubmitting || !state.customerName.trim()}
          className={`w-full h-12 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            isSubmitting || !state.customerName.trim()
              ? 'bg-[#E8DDD2] text-[#B0A090] cursor-not-allowed'
              : 'bg-[#B5714A] text-white active:scale-[0.98] hover:bg-[#9A5C38]'
          }`}>
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              予約中...
            </>
          ) : (
            'この内容で予約する'
          )}
        </button>
      </div>
    </div>
  );
}
