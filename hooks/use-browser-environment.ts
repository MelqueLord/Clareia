'use client';

import { useSyncExternalStore } from 'react';

let installedInThisPage = false;
const serverSnapshot = () => 16;

function browserSnapshot() {
  const platform = navigator as Navigator & { standalone?: boolean; userAgentData?: { platform?: string } };
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || platform.userAgentData?.platform === 'iOS'
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  const installed = installedInThisPage || window.matchMedia('(display-mode: standalone)').matches || platform.standalone === true;
  const push = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return Number(ios) | (Number(android) << 1) | (Number(installed) << 2) | (Number(push) << 3) | (Number(navigator.onLine) << 4) | 32;
}

function subscribe(onChange: () => void) {
  const displayMode = window.matchMedia('(display-mode: standalone)');
  const installed = () => { installedInThisPage = true; onChange(); };
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  window.addEventListener('appinstalled', installed);
  displayMode.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
    window.removeEventListener('appinstalled', installed);
    displayMode.removeEventListener('change', onChange);
  };
}

export default function useBrowserEnvironment() {
  const value = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  return { ios: Boolean(value & 1), android: Boolean(value & 2), installed: Boolean(value & 4),
    pushSupported: Boolean(value & 8), online: Boolean(value & 16), hydrated: Boolean(value & 32) };
}
