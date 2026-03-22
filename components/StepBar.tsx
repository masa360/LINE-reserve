interface StepBarProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { number: 1, label: 'メニュー選択' },
  { number: 2, label: 'スタッフ・時間' },
  { number: 3, label: '予約確認' },
];

export default function StepBar({ currentStep }: StepBarProps) {
  return (
    <div className="bg-[#FFFEFB] px-4 py-3 border-b border-[#F0E9E0]">
      <div className="flex items-center justify-between relative">
        {/* 接続線 */}
        <div className="absolute left-0 right-0 top-[14px] flex px-7">
          <div className={`flex-1 h-px transition-colors ${currentStep >= 2 ? 'bg-[#B5714A]' : 'bg-[#E8DDD2]'}`} />
          <div className={`flex-1 h-px transition-colors ${currentStep >= 3 ? 'bg-[#B5714A]' : 'bg-[#E8DDD2]'}`} />
        </div>

        {steps.map((step) => {
          const isDone   = step.number < currentStep;
          const isActive = step.number === currentStep;
          return (
            <div key={step.number} className="flex flex-col items-center gap-1 z-10">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone
                  ? 'bg-[#B5714A] text-white'
                  : isActive
                    ? 'bg-[#B5714A] text-white ring-4 ring-[#F5E8DD]'
                    : 'bg-[#F0E9E0] text-[#B0A090]'
              }`}>
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${isActive ? 'text-[#2C1A0E]' : 'text-[#B0A090]'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
