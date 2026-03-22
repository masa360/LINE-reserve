import type { Menu } from '@/types';

interface MenuCardProps {
  menu: Menu;
  isSelected: boolean;
  onSelect: (menu: Menu) => void;
}

function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`;
}
function formatDuration(minutes: number): string {
  if (minutes < 60) return `約${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `約${h}時間${m}分` : `約${h}時間`;
}

export default function MenuCard({ menu, isSelected, onSelect }: MenuCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(menu)}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
        isSelected
          ? 'border-[#B5714A] bg-[#FDF5EF]'
          : 'border-[#E8DDD2] bg-[#FFFEFB] hover:border-[#D4956A]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {menu.tag && (
            <span className="inline-block text-[10px] font-bold text-[#7A3E1E] bg-[#F5E8DD] rounded px-1.5 py-0.5 mb-1.5">
              {menu.tag}
            </span>
          )}
          <p className="text-sm font-semibold text-[#2C1A0E] leading-snug">{menu.name}</p>
          {menu.description && (
            <p className="text-xs text-[#7A6555] mt-0.5">{menu.description}</p>
          )}
          <div className="flex items-center gap-1 mt-2">
            <svg className="w-3.5 h-3.5 text-[#B0A090]" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-[#B0A090]">{formatDuration(menu.duration)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-base font-bold text-[#2C1A0E]">{formatPrice(menu.price)}</span>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected ? 'bg-[#B5714A] border-[#B5714A]' : 'border-[#D4C4B4]'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
