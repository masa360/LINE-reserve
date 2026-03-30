import type { Menu, Staff, TimeSlot, PastReservation, User, Venue } from '@/types';

// ============================================================
// 店舗情報
// ============================================================
export const store = {
  name: 'SALON de LUMIÈRE',
  postalCode: '〒150-0002',
  address: '東京都渋谷区渋谷2-1-1 渋谷ビル3F',
  addressLine: '東京都渋谷区渋谷2-1-1 渋谷ビル3F',
  tel: '03-1234-5678',
  openTime: '10:00',
  closeTime: '20:00',
  parkingNote: '近隣コインパーキングをご利用ください。',
  hoursLines: ['平日 : 10:00 – 20:00', '土日祝 : 10:00 – 19:00'] as const,
  holiday: '毎週火曜日',
  instagram: '@salon_de_lumiere',
};

export const venues: Venue[] = [
  {
    id: 'venue-main',
    name: store.name,
    addressLines: [store.postalCode, store.address],
  },
];

// ============================================================
// メニューデータ
// ============================================================
export const menus: Menu[] = [
  // ベース: カット
  {
    id: 'cut-01',
    name: 'デザインカット',
    category: 'cut',
    duration: 45,
    price: 5000,
    description: 'シャンプー・ブロー込み',
  },
  {
    id: 'cut-02',
    name: '骨格補正カット',
    category: 'cut',
    duration: 60,
    price: 6500,
    description: '骨格・毛流れを見て似合わせカット',
  },
  {
    id: 'cut-03',
    name: 'メンズカット',
    category: 'cut',
    duration: 40,
    price: 4200,
    description: 'メンズ専用カット',
  },
  // 2段目: カラー or パーマ
  {
    id: 'style-01',
    name: '透明感カラー',
    category: 'colorperm',
    duration: 90,
    price: 8200,
    description: 'リタッチ・全体カラー対応',
  },
  {
    id: 'style-02',
    name: '低刺激グレイカラー',
    category: 'colorperm',
    duration: 90,
    price: 7900,
    description: '白髪染め対応・低刺激薬剤',
  },
  {
    id: 'style-03',
    name: 'デザインパーマ',
    category: 'colorperm',
    duration: 100,
    price: 9800,
    description: 'ウェーブ・ニュアンス対応',
  },
  {
    id: 'style-04',
    name: '前髪ポイントパーマ',
    category: 'colorperm',
    duration: 45,
    price: 4500,
    description: '前髪のニュアンス調整',
  },
  // 3段目: ヘッドスパ / トリートメント
  {
    id: 'care-01',
    name: '炭酸ヘッドスパ',
    category: 'care',
    duration: 20,
    price: 2500,
    description: '頭皮クレンジングと血行促進',
  },
  {
    id: 'care-02',
    name: '集中補修トリートメント',
    category: 'care',
    duration: 25,
    price: 3500,
    description: 'ダメージ毛向け内部補修',
  },
  {
    id: 'care-03',
    name: 'ヘッドスパ＋トリートメント',
    category: 'care',
    duration: 40,
    price: 5400,
    tag: 'おすすめ',
    description: '頭皮ケアと毛髪ケアを同時に実施',
  },
  // 互換カテゴリ（既存UI対策用）
  {
    id: 'mens-01',
    name: 'メンズカット＋眉カット',
    category: 'mens',
    duration: 50,
    price: 5200,
    description: 'メンズ向けオプション',
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
    role: 'トップスタイリスト（早番 10:00-17:00）',
    initial: '山',
    avatarColor: 'bg-rose-400',
  },
  {
    id: 'staff-02',
    name: '小川 あずさ',
    furigana: 'おがわ あずさ',
    role: 'スタイリスト（遅番 13:00-20:00）',
    initial: '小',
    avatarColor: 'bg-violet-400',
  },
];

export const staffShiftHours: Record<string, { start: string; end: string }> = {
  'staff-00': { start: '10:00', end: '20:00' }, // 指名なしは全体枠
  'staff-01': { start: '10:00', end: '17:00' }, // 早番
  'staff-02': { start: '13:00', end: '20:00' }, // 遅番
};

// ============================================================
// 予約可能時間枠を生成（開始〜終了, 30分刻み。終了時刻は開始不可）
// ============================================================
export function generateTimeSlots(
  unavailableTimes: string[] = [],
  startTime = '10:00',
  endTime = '20:00',
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  let cursor = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;

  while (cursor < end) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    slots.push({ time, available: !unavailableTimes.includes(time) });
    cursor += 30;
  }
  return slots;
}

// スタッフごとの満枠時間（ダミー）
export const unavailableSlots: Record<string, string[]> = {
  'staff-00': ['11:30', '14:00', '16:30'],
  'staff-01': ['10:30', '14:00', '16:00'],
  'staff-02': ['13:30', '16:00', '18:30'],
};

// ============================================================
// 過去の予約履歴（ダミー）
// ============================================================
export const pastReservations: PastReservation[] = [
  {
    id: 'res-001',
    date: '2026-04-05',
    time: '11:00',
    menuName: 'デザインカット ＋ 透明感カラー ＋ 炭酸ヘッドスパ',
    staffName: '山本 宏美',
    price: 15700,
    status: 'upcoming',
  },
  {
    id: 'res-002',
    date: '2026-02-18',
    time: '14:30',
    menuName: '骨格補正カット ＋ デザインパーマ',
    staffName: '小川 あずさ',
    price: 16300,
    status: 'completed',
  },
  {
    id: 'res-003',
    date: '2025-12-10',
    time: '10:00',
    menuName: 'メンズカット',
    staffName: '山本 宏美',
    price: 4200,
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
  points: 0,
  rank: 'STANDARD',
  visitCount: 8,
};
