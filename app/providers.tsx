'use client';

import { LiffProvider } from '@/app/context/LiffContext';
import { ReservationProvider } from '@/app/context/ReservationContext';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LiffProvider>
      <ReservationProvider>{children}</ReservationProvider>
    </LiffProvider>
  );
}
