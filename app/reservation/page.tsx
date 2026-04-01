'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StepBar from '@/components/StepBar';
import MenuCard from '@/components/MenuCard';
import SummaryBar from '@/components/SummaryBar';
import { useReservation } from '@/app/context/ReservationContext';
import { menus } from '@/data/dummyData';
import { buildReservationTotals } from '@/lib/reservationTotals';
import type { Menu } from '@/types';

export default function ReservationStep1() {
  const router = useRouter();
  const { state, dispatch } = useReservation();
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);

  const cutMenus = menus.filter((m) => m.category === 'cut');
  const styleMenus = menus.filter((m) => m.category === 'colorperm');
  const careMenus = menus.filter((m) => m.category === 'care');

  const totals = buildReservationTotals(
    state.selectedMenu,
    state.selectedStyleMenu ?? null,
    state.selectedCareMenu ?? null,
  );

  const applyMainMenu = (mainMenu: Menu) => {
    dispatch({ type: 'SET_MENU', payload: mainMenu });
    dispatch({ type: 'SET_STYLE_MENU', payload: null });
    dispatch({ type: 'SET_CARE_MENU', payload: null });
    setFlowStep(2);
  };

  const applyStyleMenu = (styleMenu: Menu | null) => {
    dispatch({ type: 'SET_STYLE_MENU', payload: styleMenu });
    dispatch({ type: 'SET_CARE_MENU', payload: null });
    setFlowStep(3);
  };

  const applyCareMenu = (careMenu: Menu | null) => {
    dispatch({ type: 'SET_CARE_MENU', payload: careMenu });
  };

  const handleNext = () => {
    if (!state.selectedMenu) return;
    router.push('/reservation/step2');
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      <StepBar currentStep={1} />

      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-bold text-[#2C1A0E]">メニューを選択</h2>
        <p className="text-xs text-[#7A6555] mt-0.5">
          カット選択 → カラー/パーマ（スキップ可）→ ヘッドスパ/トリートメント（スキップ可）
        </p>
      </div>

      <div className="px-4 pb-3">
        <div className="flex bg-[#F0E9E0] rounded-xl p-1 gap-1">
          {[
            { step: 1 as const, label: '1.カット' },
            { step: 2 as const, label: '2.カラー/パーマ' },
            { step: 3 as const, label: '3.ケア' },
          ].map((tab) => (
            <button
              key={tab.step}
              type="button"
              onClick={() => setFlowStep(tab.step)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                flowStep === tab.step
                  ? 'bg-[#FFFEFB] text-[#B5714A] shadow-sm'
                  : 'text-[#7A6555]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {flowStep === 1 && (
          <div className="space-y-2.5">
            {cutMenus.map((menu) => (
              <MenuCard
                key={menu.id}
                menu={menu}
                isSelected={state.selectedMenu?.id === menu.id}
                onSelect={applyMainMenu}
              />
            ))}
          </div>
        )}

        {flowStep === 2 && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => applyStyleMenu(null)}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-semibold ${
                !state.selectedStyleMenu ? 'border-[#B5714A] bg-[#FDF5EF]' : 'border-[#E8DDD2] bg-[#FFFEFB]'
              }`}
            >
              カラー・パーマを追加しない（スキップ）
            </button>
            {styleMenus.map((menu) => (
              <MenuCard
                key={menu.id}
                menu={menu}
                isSelected={state.selectedStyleMenu?.id === menu.id}
                onSelect={(m) => applyStyleMenu(m)}
              />
            ))}
          </div>
        )}

        {flowStep === 3 && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => applyCareMenu(null)}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-semibold ${
                !state.selectedCareMenu ? 'border-[#B5714A] bg-[#FDF5EF]' : 'border-[#E8DDD2] bg-[#FFFEFB]'
              }`}
            >
              ヘッドスパ・トリートメントを追加しない（スキップ）
            </button>
            {careMenus.map((menu) => (
              <MenuCard
                key={menu.id}
                menu={menu}
                isSelected={state.selectedCareMenu?.id === menu.id}
                onSelect={(m) => applyCareMenu(m)}
              />
            ))}
          </div>
        )}
      </div>

      <SummaryBar
        menu={
          state.selectedMenu
            ? {
                id: 'summary',
                name: totals.menuNameForApi,
                category: 'cut',
                duration: totals.totalDuration,
                price: totals.totalPrice,
              }
            : null
        }
        onNext={handleNext}
        nextLabel="スタッフ・時間を選ぶ"
        disabled={!state.selectedMenu}
      />
    </div>
  );
}
