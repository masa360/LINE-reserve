'use client';

import { ReservationProvider } from '@/app/context/ReservationContext';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <ReservationProvider>{children}</ReservationProvider>;
}
