// ============================================================
// メニュー関連
// ============================================================
export type MenuCategory = 'hair' | 'mens';

export interface Menu {
  id: string;
  name: string;
  category: MenuCategory;
  duration: number; // 分
  price: number;
  tag?: string; // "3回目限定" など
  description?: string;
}

// ============================================================
// スタッフ関連
// ============================================================
export interface Staff {
  id: string;
  name: string;
  furigana: string;
  role: string;
  initial: string;
  avatarColor: string; // Tailwind bg color class
}

// ============================================================
// 時間枠
// ============================================================
export interface TimeSlot {
  time: string; // "09:00"
  available: boolean;
}

// ============================================================
// 予約状態（Context で保持）
// ============================================================
export interface ReservationState {
  selectedMenu: Menu | null;
  selectedStaff: Staff | null;
  selectedDate: string | null; // "2026-03-21"
  selectedTime: string | null; // "09:00"
  customerName: string;
  notes: string;
}

export type ReservationAction =
  | { type: 'SET_MENU'; payload: Menu }
  | { type: 'SET_STAFF'; payload: Staff }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME'; payload: string | null }
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'RESET' };

// ============================================================
// 過去の予約履歴
// ============================================================
export interface PastReservation {
  id: string;
  date: string; // "2026-03-01"
  time: string; // "11:00"
  menuName: string;
  staffName: string;
  price: number;
  status: 'completed' | 'upcoming' | 'cancelled';
}

// ============================================================
// ユーザー情報
// ============================================================
export interface User {
  id: string;
  name: string;
  memberNumber: string;
  points: number;
  rank: 'STANDARD' | 'SILVER' | 'GOLD' | 'PLATINUM';
  visitCount: number;
}
