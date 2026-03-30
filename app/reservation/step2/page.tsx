'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepBar from '@/components/StepBar';
import StaffCard from '@/components/StaffCard';
import TimeSlotButton from '@/components/TimeSlotButton';
import SummaryBar from '@/components/SummaryBar';
import { useReservation } from '@/app/context/ReservationContext';
import {
  staffList,
  generateTimeSlots,
  unavailableSlots,
  staffShiftHours,
} from '@/data/dummyData';
import { fetchAvailabilityFromGas } from '@/lib/reservationApi';
import { buildReservationTotals } from '@/lib/reservationTotals';
import type { Staff, TimeSlot } from '@/types';

/** 端末のローカル日付を YYYY-MM-DD に（toISOString の日付ずれを防ぐ） */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 今日から7日分の日付を生成
function generateDates(): { dateStr: string; label: string; dayOfWeek: string }[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = toLocalDateString(d);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = days[d.getDay()];
    const label =
      i === 0 ? '今日' : i === 1 ? '明日' : `${d.getMonth() + 1}/${d.getDate()}`;
    return { dateStr, label, dayOfWeek };
  });
}

const DATES = generateDates();

function dummySlotsForStaff(staffId: string): TimeSlot[] {
  const key = staffId as keyof typeof unavailableSlots;
  const blocked = unavailableSlots[key] ?? [];
  const shift = staffShiftHours[staffId] ?? staffShiftHours['staff-00'];
  return generateTimeSlots(blocked, shift.start, shift.end);
}

export default function ReservationStep2() {
  const router = useRouter();
  const { state, dispatch } = useReservation();

  const selectedStaffId = state.selectedStaff?.id ?? 'staff-00';
  const selectedDate = state.selectedDate ?? DATES[0].dateStr;
  const totals = buildReservationTotals(
    state.selectedMenu,
    state.selectedStyleMenu ?? null,
    state.selectedCareMenu ?? null,
  );
  const durationMinutes = totals.totalDuration > 0 ? totals.totalDuration : 60;

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(() =>
    dummySlotsForStaff(selectedStaffId),
  );
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [usingDemoSlots, setUsingDemoSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError(null);

    const result = await fetchAvailabilityFromGas({
      date: selectedDate,
      staffId: selectedStaffId,
      durationMinutes,
    });

    if (result.ok) {
      setTimeSlots(result.slots);
      setUsingDemoSlots(false);
    } else {
      setTimeSlots(dummySlotsForStaff(selectedStaffId));
      setUsingDemoSlots(true);
      setSlotsError(result.error);
    }

    setSlotsLoading(false);
  }, [selectedDate, selectedStaffId, durationMinutes]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // 取得後、選択中の時間が満枠なら解除
  useEffect(() => {
    if (!state.selectedTime || timeSlots.length === 0) return;
    const current = timeSlots.find((s) => s.time === state.selectedTime);
    if (current && !current.available) {
      dispatch({ type: 'SET_TIME', payload: null });
    }
  }, [timeSlots, state.selectedTime, dispatch]);

  const handleSelectStaff = (staff: Staff) => {
    dispatch({ type: 'SET_STAFF', payload: staff });
  };

  const handleSelectDate = (dateStr: string) => {
    dispatch({ type: 'SET_DATE', payload: dateStr });
  };

  const handleSelectTime = (time: string) => {
    dispatch({ type: 'SET_TIME', payload: time });
  };

  const handleNext = () => {
    if (state.selectedTime) {
      router.push('/reservation/step3');
    }
  };

  const isNextEnabled = !!state.selectedTime && !!state.selectedDate;

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      <StepBar currentStep={2} />

      <div className="flex-1 overflow-y-auto">
        {/* スタッフ選択 */}
        <section className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold text-[#2C1A0E] mb-3">担当スタッフを選択</h2>
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
            {staffList.map((staff) => (
              <StaffCard
                key={staff.id}
                staff={staff}
                isSelected={state.selectedStaff ? state.selectedStaff.id === staff.id : staff.id === 'staff-00'}
                onSelect={handleSelectStaff}
              />
            ))}
          </div>
        </section>

        <div className="h-px bg-[#F0E9E0] mx-4" />

        {/* 日付選択 */}
        <section className="px-4 py-4">
          <h2 className="text-sm font-bold text-[#2C1A0E] mb-3">日付を選択</h2>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {DATES.map(({ dateStr, label, dayOfWeek }) => {
              const isSelected = selectedDate === dateStr;
              const isSun = dayOfWeek === '日';
              const isSat = dayOfWeek === '土';
              return (
                <button key={dateStr} type="button" onClick={() => handleSelectDate(dateStr)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 w-14 py-2.5 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-[#B5714A] bg-[#B5714A]'
                      : 'border-[#E8DDD2] bg-[#FFFEFB] hover:border-[#D4956A]'
                  }`}>
                  <span className={`text-[10px] font-medium ${
                    isSelected ? 'text-white/70'
                    : isSun ? 'text-rose-400'
                    : isSat ? 'text-sky-400'
                    : 'text-[#B0A090]'
                  }`}>{dayOfWeek}</span>
                  <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-[#2C1A0E]'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="h-px bg-[#F0E9E0] mx-4" />

        {/* 時間選択 */}
        <section className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#2C1A0E]">時間を選択</h2>
            <div className="flex items-center gap-3 text-[10px] text-[#B0A090]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#FFFEFB] border border-[#E8DDD2]" />空き
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#F3EDE4]" />満枠
              </div>
            </div>
          </div>

          {usingDemoSlots && slotsError && (
            <div className="mb-3 rounded-xl bg-[#FDF5EF] border border-[#E8C9A8] px-3 py-2 text-xs text-[#7A3E1E]">
              <p className="font-semibold">GASに接続できませんでした</p>
              <p className="text-[#7A6555] mt-0.5 leading-relaxed">
                デモ用の枠を表示しています。.env.local の GAS_WEBAPP_URL を確認してください。
              </p>
            </div>
          )}

          {slotsLoading && (
            <p className="text-xs text-[#B0A090] mb-2">空き状況を読み込み中…</p>
          )}

          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((slot) => (
              <TimeSlotButton
                key={slot.time}
                time={slot.time}
                available={slot.available}
                isSelected={state.selectedTime === slot.time}
                onSelect={handleSelectTime}
              />
            ))}
          </div>
        </section>
      </div>

      <SummaryBar
        menu={state.selectedMenu}
        onNext={handleNext}
        nextLabel="予約内容を確認する"
        disabled={!isNextEnabled}
      />
    </div>
  );
}
