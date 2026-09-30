import { uiLocale } from './ui/shared/i18n/translate';
import { installNavigationGuard } from './ui/pages/game/navGuard';
import { createElement } from 'react';
import { AppShell } from './ui/pages/game/AppShell';
import { createRoot } from 'react-dom/client';
import { UiErrorBoundary } from './ui/shared/components/UiErrorBoundary';
import { showEdgeMouseNotice } from './ui/pages/game/components/edgeMouseNotice';

document.documentElement.lang = uiLocale;
document.title = uiLocale === 'en' ? 'Red Alert 2 in your browser' : '红色警戒2 网页版';

// Page-lifetime navigation guard: keep accidental back/forward, mouse-side-button, and Alt+Left navigation on this page
// (disable with ?nav-guard=0 for development). Install once, independently of VM lifetime.
installNavigationGuard();

// PWA: register the service worker in production for browser installation eligibility; skip development
// to avoid conflicting with no-cache/manual-refresh policies. Register after load to avoid competing with initial startup resources.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      // A deploy ships a new worker (per-build version stamp in sw.js). When it takes over, the
      // old page may still reference deleted hashed chunks, so reload to the fresh build exactly once.
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
      }
    } catch (error) {
      console.warn('[PWA] 服务线程注册失败', error);
    }
  });
}

// The application has one root; attach the VM through the canvas ref after component commit, without flushSync.
const root = createRoot(document.getElementById('root')!);
root.render(createElement(UiErrorBoundary, null, createElement(AppShell)));
void showEdgeMouseNotice();
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
