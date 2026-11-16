import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed as PWA)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone === true);

    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Capture beforeinstallprompt event (Android / Desktop Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  // Don't show if already installed or dismissed by user
  if (isStandalone || dismissed) return null;

  // Show if deferredPrompt exists, or if device is iOS, or if running in dev mode for easy testing
  const isMobileScreen = typeof window !== "undefined" && window.innerWidth <= 768;
  const showBanner = Boolean(deferredPrompt) || isIOS || (import.meta.env.DEV && isMobileScreen);
  if (!showBanner) return null;

  return (
    <>
      {/* Floating Bottom Banner */}
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-slide-up rounded-2xl border border-indigo-200/80 bg-white/95 p-4 shadow-xl backdrop-blur sm:bottom-6 sm:left-auto sm:right-6 dark:border-indigo-900/60 dark:bg-slate-900/95">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                <path fillRule="evenodd" d="M10.5 3.75a6 6 0 0 0-6 6v8.25a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V9.75a6 6 0 0 0-6-6h-3Zm1.5 4.5a.75.75 0 0 1 .75.75v4.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V9a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Modme Ilovasi</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Telefoningizga o‘rnating va tezkor kiring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              O‘rnatish
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Yopish"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">iPhone'ga o‘rnatish</h3>
              <button
                onClick={() => setShowIOSModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/70 p-3.5 dark:bg-indigo-950/40">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
                <p>Safari brauzerining pastki panelidagi <strong className="text-slate-900 dark:text-slate-100">"Ulashish" (Share / Поделиться)</strong> tugmasini bosing.</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/70 p-3.5 dark:bg-indigo-950/40">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
                <p>Menyudan <strong className="text-slate-900 dark:text-slate-100">"Bosh ekranga qo‘shish" (Add to Home Screen / На экран «Домой»)</strong> bo‘limini tanlang.</p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-indigo-700 active:scale-95"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </>
  );
}
