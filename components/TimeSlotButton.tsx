interface TimeSlotButtonProps {
  time: string;
  available: boolean;
  isSelected: boolean;
  onSelect: (time: string) => void;
}

export default function TimeSlotButton({ time, available, isSelected, onSelect }: TimeSlotButtonProps) {
  if (!available) {
    return (
      <div className="flex items-center justify-center h-10 rounded-xl bg-[#F3EDE4] border border-[#E8DDD2]">
        <span className="text-xs text-[#C4B4A4] line-through">{time}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(time)}
      className={`flex items-center justify-center h-10 rounded-xl border-2 text-sm font-medium transition-all ${
        isSelected
          ? 'bg-[#B5714A] border-[#B5714A] text-white'
          : 'bg-[#FFFEFB] border-[#E8DDD2] text-[#2C1A0E] hover:border-[#B5714A] hover:text-[#B5714A]'
      }`}
    >
      {time}
    </button>
  );
}
