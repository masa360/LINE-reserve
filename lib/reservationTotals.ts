import type { Menu } from '@/types';

export interface ReservationTotals {
  totalPrice: number;
  totalDuration: number;
  menuNameForApi: string;
  lineItems: Array<{ label: string; price: number; duration: number }>;
}

export function buildReservationTotals(
  mainMenu: Menu | null,
  styleMenu: Menu | null,
  careMenu: Menu | null,
): ReservationTotals {
  const menus = [mainMenu, styleMenu, careMenu].filter(Boolean) as Menu[];
  const lineItems = menus.map((m) => ({ label: m.name, price: m.price, duration: m.duration }));
  const totalPrice = lineItems.reduce((sum, x) => sum + x.price, 0);
  const totalDuration = lineItems.reduce((sum, x) => sum + x.duration, 0);
  const menuNameForApi = lineItems.map((x) => x.label).join(' ＋ ');

  return { totalPrice, totalDuration, menuNameForApi, lineItems };
}
