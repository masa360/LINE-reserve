import type { Menu, Staff, TimeSlot, PastReservation, User } from '@/types';

// ============================================================
// 店舗情報
// ============================================================
export const store = {
  name: 'SALON de LUMIÈRE',
  address: '東京都渋谷区渋谷2-1-1 渋谷ビル3F',
  tel: '03-1234-5678',
  openTime: '09:00',
  closeTime: '20:00',
  holiday: '毎週火曜日',
  instagram: '@salon_de_lumiere',
};

// ============================================================
// メニューデータ
// ============================================================
export const menus: Menu[] = [
  // ヘアーカテゴリ
  {
    id: 'menu-01',
    name: 'カット',
    category: 'hair',
    duration: 45,
    price: 4500,
    description: 'シャンプー・ブロー込み',
  },
  {
    id: 'menu-02',
    name: 'カラー',
    category: 'hair',
    duration: 90,
    price: 8000,
    description: 'リタッチ・全体カラー対応',
  },
  {
    id: 'menu-03',
    name: 'カット＋カラー',
    category: 'hair',
    duration: 120,
    price: 11000,
    description: 'カット・カラー・シャンプー・ブロー込み',
  },
  {
    id: 'menu-04',
    name: '【3回目限定】カット＋パーマ',
    category: 'hair',
    duration: 120,
    price: 10000,
    tag: '3回目限定',
    description: '3回目ご来店のお客様限定特別価格',
  },
  {
    id: 'menu-05',
    name: 'トリートメント',
    category: 'hair',
    duration: 30,
    price: 3000,
    description: '集中ケアトリートメント',
  },
  // メンズカテゴリ
  {
    id: 'menu-06',
    name: 'メンズカット',
    category: 'mens',
    duration: 30,
    price: 3500,
    description: 'シャンプー・ブロー込み',
  },
  {
    id: 'menu-07',
    name: 'メンズカット＋眉カット',
    category: 'mens',
    duration: 40,
    price: 4000,
    description: '眉カットサービス付き',
  },
  {
    id: 'menu-08',
    name: 'メンズカット＋カラー',
    category: 'mens',
    duration: 90,
    price: 9000,
    tag: '人気',
    description: 'カット・カラー・シャンプー込み',
  },
];

// ============================================================
// スタッフデータ（2名 ＋ 指名なし）
// ============================================================
export const staffList: Staff[] = [
  {
    id: 'staff-00',
    name: '指名なし',
    furigana: 'しめいなし',
    role: 'おまかせ',
    initial: '？',
    avatarColor: 'bg-gray-300',
  },
  {
    id: 'staff-01',
    name: '山本 宏美',
    furigana: 'やまもと ひろみ',
    role: 'トップスタイリスト',
    initial: '山',
    avatarColor: 'bg-rose-400',
  },
  {
    id: 'staff-02',
    name: '小川 あずさ',
    furigana: 'おがわ あずさ',
    role: 'スタイリスト',
    initial: '小',
    avatarColor: 'bg-violet-400',
  },
];

// ============================================================
// 予約可能時間枠を生成（09:00〜19:30, 30分刻み）
// ============================================================
export function generateTimeSlots(unavailableTimes: string[] = []): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 9; hour <= 19; hour++) {
    for (const min of [0, 30]) {
      if (hour === 19 && min === 30) break;
      const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      slots.push({
        time,
        available: !unavailableTimes.includes(time),
      });
    }
  }
  return slots;
}

// スタッフごとの満枠時間（ダミー）
export const unavailableSlots: Record<string, string[]> = {
  'staff-00': ['11:30', '14:00', '16:30'],
  'staff-01': ['10:00', '10:30', '14:00', '14:30', '17:00'],
  'staff-02': ['09:30', '11:00', '13:00', '16:00', '18:30'],
};

// ============================================================
// 過去の予約履歴（ダミー）
// ============================================================
export const pastReservations: PastReservation[] = [
  {
    id: 'res-001',
    date: '2026-04-05',
    time: '11:00',
    menuName: 'カット＋カラー',
    staffName: '山本 宏美',
    price: 11000,
    status: 'upcoming',
  },
  {
    id: 'res-002',
    date: '2026-02-18',
    time: '14:30',
    menuName: '【3回目限定】カット＋パーマ',
    staffName: '小川 あずさ',
    price: 10000,
    status: 'completed',
  },
  {
    id: 'res-003',
    date: '2025-12-10',
    time: '10:00',
    menuName: 'カット',
    staffName: '山本 宏美',
    price: 4500,
    status: 'completed',
  },
];

// ============================================================
// ユーザー情報（ダミー）
// ============================================================
export const currentUser: User = {
  id: 'user-001',
  name: '田中 花子',
  memberNumber: '1234567890',
  points: 1250,
  rank: 'GOLD',
  visitCount: 8,
};
