/**
 * Module-level store for the navigation guard.
 * Allows components outside the NavigationGuardProvider (e.g. NavBar)
 * to trigger the guard dialog before navigating.
 *
 * The provider registers a `triggerGuard` function; external components
 * call it. If there are no dirty steps, it returns true (proceed). If dirty,
 * it shows the dialog and returns false (navigation intercepted).
 */

type GuardFn = ((href: string) => boolean) | null;

let _guard: GuardFn = null;

export function setGlobalGuard(fn: GuardFn) {
  _guard = fn;
}

export function globalGuardNavigation(href: string): boolean {
  if (_guard) return _guard(href);
  return true; // no guard registered — allow navigation
}
