import type { TimeSlot } from '@/types';

/** GAS 経由の空き状況レスポンス */
export interface AvailabilityApiResponse {
  success: boolean;
  slots?: TimeSlot[];
  error?: string;
}

/** GAS 経由の予約作成レスポンス */
export interface CreateReservationApiResponse {
  success: boolean;
  eventId?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  error?: string;
}

export interface CancelReservationApiResponse {
  success: boolean;
  eventId?: string;
  error?: string;
  requirePhoneCall?: boolean;
}

export interface ReservationListItemApi {
  id: string;
  date: string;
  time: string;
  menuName: string;
  staffName: string;
  /** 予約フォームのお客様名（親LINEで子の名義のときなど） */
  customerName?: string;
  price: number;
  status: 'completed' | 'upcoming' | 'cancelled';
}

export interface GetReservationsApiResponse {
  success: boolean;
  reservations?: ReservationListItemApi[];
  error?: string;
}

/**
 * Next.js の /api/reservations 経由で GAS を呼び出す
 */
export async function callReservationApi<T>(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = { success: false, error: '応答の解析に失敗しました' } as T;
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * GAS から空き枠を取得。失敗時は呼び出し側でダミーデータにフォールバックする。
 */
export async function fetchAvailabilityFromGas(params: {
  date: string;
  staffId: string;
  durationMinutes: number;
}): Promise<
  | { ok: true; slots: TimeSlot[] }
  | { ok: false; error: string }
> {
  const { ok, data } = await callReservationApi<AvailabilityApiResponse>({
    action: 'getAvailability',
    date: params.date,
    staffId: params.staffId,
    durationMinutes: params.durationMinutes,
  });

  if (ok && data.success && Array.isArray(data.slots)) {
    return { ok: true, slots: data.slots };
  }

  const msg =
    (data && typeof data === 'object' && data.error && String(data.error)) ||
    (!ok ? 'サーバーと通信できませんでした' : '空き状況を取得できませんでした');

  return { ok: false, error: msg };
}

export async function createReservationOnGas(params: {
  customerName: string;
  menuName: string;
  durationMinutes: number;
  price: number;
  staffId: string;
  staffName: string;
  date: string;
  time: string;
  notes: string;
  birthday?: string;
  lineUserId?: string;
  lineDisplayName?: string;
}): Promise<{ success: boolean; error?: string; assignedStaffName?: string; eventId?: string }> {
  const { ok, data } = await callReservationApi<CreateReservationApiResponse>({
    action: 'createReservation',
    customerName: params.customerName,
    menuName: params.menuName,
    durationMinutes: params.durationMinutes,
    price: params.price,
    staffId: params.staffId,
    staffName: params.staffName,
    date: params.date,
    time: params.time,
    notes: params.notes,
    birthday: params.birthday ?? '',
    lineUserId: params.lineUserId ?? '',
    lineDisplayName: params.lineDisplayName ?? '',
  });

  if (ok && data.success) {
    return {
      success: true,
      assignedStaffName: data.assignedStaffName,
      eventId: data.eventId,
    };
  }

  const err =
    data && typeof data === 'object' && data.error
      ? String(data.error)
      : '予約の登録に失敗しました';

  return { success: false, error: err };
}

export async function cancelReservationOnGas(params: {
  eventId?: string;
  date: string;
  time: string;
  staffName?: string;
  menuName?: string;
  customerName?: string;
  /** LIFF ログイン時は必須に近い（他人予約の取消防止） */
  lineUserId?: string;
}): Promise<{ success: boolean; error?: string; requirePhoneCall?: boolean }> {
  const { ok, data } = await callReservationApi<CancelReservationApiResponse>({
    action: 'cancelReservation',
    eventId: params.eventId ?? '',
    date: params.date,
    time: params.time,
    staffName: params.staffName ?? '',
    menuName: params.menuName ?? '',
    customerName: params.customerName ?? '',
    lineUserId: params.lineUserId ?? '',
  });

  if (ok && data.success) {
    return { success: true };
  }

  const err =
    data && typeof data === 'object' && data.error
      ? String(data.error)
      : '予約の取消に失敗しました';

  return {
    success: false,
    error: err,
    requirePhoneCall: !!(data && typeof data === 'object' && data.requirePhoneCall),
  };
}

export async function fetchReservationsFromGas(params: {
  /** LIFF 未接続時のみ主キー。LINE接続時は lineUserId を優先 */
  customerName?: string;
  lineUserId?: string;
  limit?: number;
}): Promise<
  | { ok: true; reservations: ReservationListItemApi[] }
  | { ok: false; error: string }
> {
  const customerName = params.customerName ?? '';
  const lineUserId = params.lineUserId ?? '';
  if (!String(customerName).trim() && !String(lineUserId).trim()) {
    return { ok: false, error: 'lineUserId または customerName が必要です' };
  }

  const { ok, data } = await callReservationApi<GetReservationsApiResponse>({
    action: 'getReservations',
    customerName,
    lineUserId,
    limit: params.limit ?? 30,
  });

  if (ok && data.success && Array.isArray(data.reservations)) {
    return { ok: true, reservations: data.reservations };
  }

  const msg =
    (data && typeof data === 'object' && data.error && String(data.error)) ||
    (!ok ? 'サーバーと通信できませんでした' : '予約一覧を取得できませんでした');
  return { ok: false, error: msg };
}
