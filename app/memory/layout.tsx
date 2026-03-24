import type { ReactNode } from 'react';
import { LiffProvider } from '@/app/context/LiffContext';

/**
 * メモリーページ専用レイアウト
 * NEXT_PUBLIC_LIFF_MEMORY_ID が設定されていればそちらを優先して使用する。
 * 設定がない場合は共通の NEXT_PUBLIC_LIFF_ID にフォールバック。
 */
export default function MemoryLayout({ children }: { children: ReactNode }) {
  const memoryLiffId =
    process.env.NEXT_PUBLIC_LIFF_MEMORY_ID ?? process.env.NEXT_PUBLIC_LIFF_ID;

  return <LiffProvider liffId={memoryLiffId}>{children}</LiffProvider>;
}
