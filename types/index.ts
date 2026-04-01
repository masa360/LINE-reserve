// ============================================================
// メニュー関連
// ============================================================
export type MenuCategory = 'cut' | 'colorperm' | 'care' | 'mens' | 'hair' | 'bridal';

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
  selectedVenue?: Venue | null;
  selectedMenu: Menu | null;
  selectedStyleMenu?: Menu | null;
  selectedCareMenu?: Menu | null;
  selectedStaff: Staff | null;
  selectedDate: string | null; // "2026-03-21"
  selectedTime: string | null; // "09:00"
  customerName: string;
  notes: string;
}

export type ReservationAction =
  | { type: 'SET_VENUE'; payload: Venue }
  | { type: 'SET_MENU'; payload: Menu }
  | { type: 'SET_STYLE_MENU'; payload: Menu | null }
  | { type: 'SET_CARE_MENU'; payload: Menu | null }
  | { type: 'SET_STAFF'; payload: Staff }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME'; payload: string | null }
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | {
      type: 'APPLY_REBOOK_PATCH';
      payload: {
        selectedMenu: Menu;
        selectedStyleMenu: Menu | null;
        selectedCareMenu: Menu | null;
        selectedStaff: Staff;
      };
    }
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
  /** 予約フォームに入力した来店者名（親LINEで子の名前など） */
  customerName?: string;
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

export interface Venue {
  id: string;
  name: string;
  addressLines: string[];
  imageUrl?: string;
}
