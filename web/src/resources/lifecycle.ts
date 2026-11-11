import { catalog, resources } from './manager';
let registration: ServiceWorkerRegistration | undefined;
export async function registerResources() {
  resources.boot();
  if (
    !import.meta.env.PROD ||
    !import.meta.env.VITE_GARDEN_SITE ||
    !location.pathname.startsWith('/garden') ||
    !('serviceWorker' in navigator)
  )
    return;
  try {
    registration = await navigator.serviceWorker.register('/garden/sw.js', {
      scope: '/garden/',
      updateViaCache: 'none',
    });
    const send = () => {
      (registration?.active ?? registration?.installing)?.postMessage({
        type: 'PREPARE_GARDEN_SHELL',
        releaseId: catalog.releaseId,
      });
    };
    send();
    registration.installing?.addEventListener('statechange', send);
    void registration.update();
  } catch {
    resources.diagnostic('worker-unavailable');
  }
}
export async function activateAndReload() {
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration('/garden/'));
  if (reg?.waiting) {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', finish);
        resolve();
      };
      const timer = setTimeout(finish, 3000);
      navigator.serviceWorker.addEventListener('controllerchange', finish);
      reg.waiting!.postMessage({ type: 'ACTIVATE_GARDEN_UPDATE' });
      reg.waiting!.addEventListener('statechange', () => {
        if (reg.waiting?.state === 'activated' || !reg.waiting) finish();
      });
    });
  }
  location.reload();
}
