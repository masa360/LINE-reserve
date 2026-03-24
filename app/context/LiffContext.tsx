'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import liff from '@line/liff';

/** LINE ログイン済みユーザーのプロフィール */
export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

interface LiffContextValue {
  /** LIFF 初期化が終わったか（未設定の場合も true） */
  ready: boolean;
  /** 初期化エラー（LIFF ID ありで失敗したとき） */
  error: string | null;
  profile: LiffProfile | null;
  /** LINE アプリ内ブラウザかどうか */
  isInLineClient: boolean;
}

const LiffContext = createContext<LiffContextValue | null>(null);

const defaultValue: LiffContextValue = {
  ready: true,
  error: null,
  profile: null,
  isInLineClient: false,
};

interface LiffProviderProps {
  children: ReactNode;
  /** 明示的に渡した場合はそちらを優先。省略時は NEXT_PUBLIC_LIFF_ID を使用 */
  liffId?: string;
}

export function LiffProvider({ children, liffId: liffIdProp }: LiffProviderProps) {
  const [value, setValue] = useState<LiffContextValue>({
    ready: false,
    error: null,
    profile: null,
    isInLineClient: false,
  });

  useEffect(() => {
    const liffId = liffIdProp ?? process.env.NEXT_PUBLIC_LIFF_ID;

    // ローカル開発など LIFF 未設定時はスキップ（予約は GAS のみで動く）
    if (!liffId) {
      setValue({ ...defaultValue, ready: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await liff.init({ liffId });
        if (cancelled) return;

        const isInLineClient = liff.isInClient();
        let profile: LiffProfile | null = null;

        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();
          profile = {
            userId: p.userId,
            displayName: p.displayName,
            pictureUrl: p.pictureUrl,
          };
        }

        setValue({
          ready: true,
          error: null,
          profile,
          isInLineClient,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setValue({
          ready: true,
          error: msg,
          profile: null,
          isInLineClient: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  // liffIdProp が変化したときも再初期化する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liffIdProp]);

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>;
}

export function useLiff(): LiffContextValue {
  const ctx = useContext(LiffContext);
  if (!ctx) {
    throw new Error('useLiff は LiffProvider の内側で使ってください');
  }
  return ctx;
}
