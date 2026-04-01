'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface FlashSuccessProps {
  message: string;
  queryKey: string;
  timeoutMs?: number;
}

export function FlashSuccess({ message, queryKey, timeoutMs = 15000 }: FlashSuccessProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(true);
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);

      const nextParams = new URLSearchParams(searchParamsString);
      if (!nextParams.has(queryKey)) {
        return;
      }

      nextParams.delete(queryKey);
      const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      router.replace(nextUrl);
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, queryKey, router, searchParamsString, timeoutMs]);

  if (!visible) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}
