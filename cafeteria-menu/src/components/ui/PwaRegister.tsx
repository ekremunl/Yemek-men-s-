// src/components/ui/PwaRegister.tsx
'use client';
import { useEffect } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Service worker'ı kaydeder (yalnızca üretimde); uygulama çevrimdışı açılabilir. */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => undefined);
  }, []);
  return null;
}
