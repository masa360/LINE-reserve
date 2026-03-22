'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StepBar from '@/components/StepBar';
import MenuCard from '@/components/MenuCard';
import SummaryBar from '@/components/SummaryBar';
import { useReservation } from '@/app/context/ReservationContext';
import { menus } from '@/data/dummyData';
import type { Menu, MenuCategory } from '@/types';

const CATEGORIES: { key: MenuCategory; label: string }[] = [
  { key: 'hair', label: 'ヘアー' },
  { key: 'mens', label: 'メンズ' },
];

export default function ReservationStep1() {
  const router = useRouter();
  const { state, dispatch } = useReservation();
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('hair');

  const filteredMenus = menus.filter((m) => m.category === activeCategory);

  const handleSelectMenu = (menu: Menu) => dispatch({ type: 'SET_MENU', payload: menu });
  const handleNext = () => { if (state.selectedMenu) router.push('/reservation/step2'); };

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      <StepBar currentStep={1} />

      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-bold text-[#2C1A0E]">メニューを選択</h2>
        <p className="text-xs text-[#7A6555] mt-0.5">ご希望のメニューをお選びください</p>
      </div>

      {/* カテゴリタブ */}
      <div className="px-4 pb-3">
        <div className="flex bg-[#F0E9E0] rounded-xl p-1 gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeCategory === cat.key
                  ? 'bg-[#FFFEFB] text-[#B5714A] shadow-sm'
                  : 'text-[#7A6555]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* メニュー一覧 */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="space-y-2.5">
          {filteredMenus.map((menu) => (
            <MenuCard
              key={menu.id}
              menu={menu}
              isSelected={state.selectedMenu?.id === menu.id}
              onSelect={handleSelectMenu}
            />
          ))}
        </div>
      </div>

      <SummaryBar
        menu={state.selectedMenu}
        onNext={handleNext}
        nextLabel="スタッフ・時間を選ぶ"
        disabled={!state.selectedMenu}
      />
    </div>
  );
}
