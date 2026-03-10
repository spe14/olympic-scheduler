"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";

type DirtyChecker = (() => string[]) | null;

type NavigationGuardContextType = {
  /** Register a function that returns names of dirty steps (empty = clean) */
  setDirtyChecker: (checker: DirtyChecker) => void;
  /** Call before navigating — returns true if navigation should proceed */
  guardNavigation: (href: string) => boolean;
};

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  setDirtyChecker: () => {},
  guardNavigation: () => true,
});

export function NavigationGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dirtyChecker = useRef<DirtyChecker>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [dirtyStepNames, setDirtyStepNames] = useState<string[]>([]);

  const setDirtyChecker = useCallback((checker: DirtyChecker) => {
    dirtyChecker.current = checker;
  }, []);

  const guardNavigation = useCallback((href: string): boolean => {
    if (dirtyChecker.current) {
      const dirtySteps = dirtyChecker.current();
      if (dirtySteps.length > 0) {
        setDirtyStepNames(dirtySteps);
        setPendingHref(href);
        return false;
      }
    }
    return true;
  }, []);

  // Guard browser back/forward using the Navigation API
  // Fires BEFORE navigation happens and is cancellable via preventDefault()
  // Only blocks "traverse" (back/forward), not "push"/"replace" (programmatic)
  useEffect(() => {
    if (!("navigation" in window)) return;

    const nav = window.navigation as EventTarget & {
      addEventListener: (
        type: string,
        handler: (e: NavigateEvent) => void
      ) => void;
      removeEventListener: (
        type: string,
        handler: (e: NavigateEvent) => void
      ) => void;
    };

    function handleNavigate(e: NavigateEvent) {
      if (
        e.navigationType === "traverse" &&
        e.canIntercept &&
        dirtyChecker.current
      ) {
        const dirtySteps = dirtyChecker.current();
        if (dirtySteps.length > 0) {
          e.preventDefault();
          setDirtyStepNames(dirtySteps);
          setPendingHref("__back__");
        }
      }
    }

    nav.addEventListener("navigate", handleNavigate);
    return () => nav.removeEventListener("navigate", handleNavigate);
  }, []);

  function handleDiscard() {
    const href = pendingHref;
    setPendingHref(null);
    setDirtyStepNames([]);
    dirtyChecker.current = null;

    if (href === "__back__") {
      history.back();
    } else if (href) {
      router.push(href);
    }
  }

  function handleCancel() {
    setPendingHref(null);
    setDirtyStepNames([]);
  }

  return (
    <NavigationGuardContext.Provider
      value={{ setDirtyChecker, guardNavigation }}
    >
      {children}
      {pendingHref && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              Unsaved Changes
            </h2>
            <p className="mb-5 text-sm text-slate-500">
              You have unsaved changes in{" "}
              <span className="font-medium text-slate-700">
                {dirtyStepNames.join(", ")}
              </span>
              . Are you sure you want to leave? Your changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

// Type for Navigation API (not yet in all TypeScript libs)
interface NavigateEvent extends Event {
  navigationType: "push" | "replace" | "reload" | "traverse";
  canIntercept: boolean;
  preventDefault: () => void;
}
