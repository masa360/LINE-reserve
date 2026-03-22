import type { Menu } from '@/types';

interface SummaryBarProps {
  menu: Menu | null;
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
}

function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`;
}
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export default function SummaryBar({ menu, onNext, nextLabel = '次へ', disabled = false }: SummaryBarProps) {
  return (
    <div className="bg-[#FFFEFB] border-t border-[#F0E9E0] px-4 pt-3 pb-4">
      {menu ? (
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#7A6555] truncate">{menu.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-bold text-[#2C1A0E]">{formatPrice(menu.price)}</span>
              <span className="text-xs text-[#B0A090]">{formatDuration(menu.duration)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[#B0A090] mb-3">メニューを選択してください</p>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className={`w-full h-12 rounded-xl text-sm font-bold transition-all ${
          disabled
            ? 'bg-[#E8DDD2] text-[#B0A090] cursor-not-allowed'
            : 'bg-[#B5714A] text-white active:scale-[0.98] hover:bg-[#9A5C38]'
        }`}
      >
        {nextLabel}
      </button>
    </div>
  );
}
