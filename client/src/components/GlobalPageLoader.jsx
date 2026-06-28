import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

export function GlobalPageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 grid place-items-center bg-slate-950/70 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export function GlobalPageLoadingOverlay({ delay = 150 }) {
  const isFetching = useIsFetching();
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!isFetching) {
      setShowLoader(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setShowLoader(true), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, isFetching]);

  return showLoader ? <GlobalPageLoader /> : null;
}
