import type { Staff } from '@/types';

interface StaffCardProps {
  staff: Staff;
  isSelected: boolean;
  onSelect: (staff: Staff) => void;
}

export default function StaffCard({ staff, isSelected, onSelect }: StaffCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(staff)}
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all w-24 flex-shrink-0 ${
        isSelected
          ? 'border-[#B5714A] bg-[#FDF5EF]'
          : 'border-[#E8DDD2] bg-[#FFFEFB] hover:border-[#D4956A]'
      }`}
    >
      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white ${staff.avatarColor} relative`}>
        {staff.initial}
        {isSelected && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#B5714A] rounded-full border-2 border-[#FDF5EF] flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-[#2C1A0E] leading-tight">{staff.name}</p>
        <p className="text-[10px] text-[#7A6555] mt-0.5 leading-tight">{staff.role}</p>
      </div>
    </button>
  );
}
