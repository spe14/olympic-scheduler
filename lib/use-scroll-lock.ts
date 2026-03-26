import { useEffect } from "react";

/** Prevents body scrolling while active. Defaults to always-on (for components that mount/unmount with the modal). */
export function useScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}
