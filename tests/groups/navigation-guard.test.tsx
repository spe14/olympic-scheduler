// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import {
  NavigationGuardProvider,
  useNavigationGuard,
} from "@/app/(main)/groups/[groupId]/_components/navigation-guard-context";
import {
  globalGuardNavigation,
  setGlobalGuard,
} from "@/lib/navigation-guard-store";

// ─── Mocks ──────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Test helper component ──────────────────────────────────────────

function TestConsumer({
  dirtyChecker,
  href = "/some/route",
}: {
  dirtyChecker?: (() => string[]) | null;
  href?: string;
}) {
  const { setDirtyChecker, guardNavigation } = useNavigationGuard();

  return (
    <div>
      <button
        data-testid="set-checker"
        onClick={() => setDirtyChecker(dirtyChecker ?? null)}
      >
        Set Checker
      </button>
      <button data-testid="clear-checker" onClick={() => setDirtyChecker(null)}>
        Clear Checker
      </button>
      <button
        data-testid="navigate"
        onClick={() => {
          const allowed = guardNavigation(href);
          // Store result on the button so we can inspect it
          (
            document.querySelector('[data-testid="navigate"]') as HTMLElement
          ).dataset.result = String(allowed);
        }}
      >
        Navigate
      </button>
    </div>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<NavigationGuardProvider>{ui}</NavigationGuardProvider>);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("NavigationGuardProvider & useNavigationGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    // Clean up any mock navigation API
    delete (window as any).navigation;
    // Reset global guard store between tests
    setGlobalGuard(null);
  });

  // 1. guardNavigation returns true when no dirty checker registered
  it("guardNavigation returns true when no dirty checker is registered", () => {
    renderWithProvider(<TestConsumer />);

    fireEvent.click(screen.getByTestId("navigate"));

    const btn = screen.getByTestId("navigate") as HTMLElement;
    expect(btn.dataset.result).toBe("true");
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  // 2. guardNavigation returns true when dirty checker returns empty array
  it("guardNavigation returns true when dirty checker returns empty array", () => {
    renderWithProvider(<TestConsumer dirtyChecker={() => []} />);

    fireEvent.click(screen.getByTestId("set-checker"));
    fireEvent.click(screen.getByTestId("navigate"));

    const btn = screen.getByTestId("navigate") as HTMLElement;
    expect(btn.dataset.result).toBe("true");
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  // 3. guardNavigation returns false and shows confirmation dialog when dirty
  it("guardNavigation returns false and shows dialog when there are dirty steps", () => {
    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Buddies & Budget"]} />
    );

    fireEvent.click(screen.getByTestId("set-checker"));
    fireEvent.click(screen.getByTestId("navigate"));

    const btn = screen.getByTestId("navigate") as HTMLElement;
    expect(btn.dataset.result).toBe("false");
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();
  });

  // 4. Confirmation dialog shows dirty step names correctly
  it("shows the dirty step name in the confirmation dialog", () => {
    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Sport Rankings"]} />
    );

    fireEvent.click(screen.getByTestId("set-checker"));
    fireEvent.click(screen.getByTestId("navigate"));

    expect(screen.getByText("Sport Rankings")).toBeTruthy();
  });

  // 5. Clicking "Stay" dismisses the dialog and doesn't navigate
  it("clicking Stay dismisses the dialog without navigating", () => {
    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Buddies & Budget"]} />
    );

    fireEvent.click(screen.getByTestId("set-checker"));
    fireEvent.click(screen.getByTestId("navigate"));

    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    fireEvent.click(screen.getByText("Stay"));

    expect(screen.queryByText("Unsaved Changes")).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // 6. Clicking "Discard & Leave" navigates using router.push and clears dirty checker
  it("clicking Discard & Leave navigates to the pending href and clears checker", () => {
    renderWithProvider(
      <TestConsumer
        dirtyChecker={() => ["Sessions"]}
        href="/groups/123/settings"
      />
    );

    fireEvent.click(screen.getByTestId("set-checker"));
    fireEvent.click(screen.getByTestId("navigate"));

    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    fireEvent.click(screen.getByText("Discard & Leave"));

    expect(mockPush).toHaveBeenCalledWith("/groups/123/settings");
    expect(screen.queryByText("Unsaved Changes")).toBeNull();

    // Checker was cleared, so next navigation should proceed freely
    fireEvent.click(screen.getByTestId("navigate"));
    const btn = screen.getByTestId("navigate") as HTMLElement;
    expect(btn.dataset.result).toBe("true");
  });

  // 7. Multiple dirty step names shown correctly
  it("shows multiple dirty step names joined by comma", () => {
    renderWithProvider(
      <TestConsumer
        dirtyChecker={() => ["Buddies & Budget", "Sport Rankings"]}
      />
    );

    fireEvent.click(screen.getByTestId("set-checker"));
    fireEvent.click(screen.getByTestId("navigate"));

    expect(screen.getByText("Buddies & Budget, Sport Rankings")).toBeTruthy();
  });

  // 8. setDirtyChecker(null) clears the checker so navigation proceeds
  it("setting checker to null clears it so navigation proceeds", () => {
    renderWithProvider(<TestConsumer dirtyChecker={() => ["Sessions"]} />);

    // Set the dirty checker
    fireEvent.click(screen.getByTestId("set-checker"));

    // Clear it
    fireEvent.click(screen.getByTestId("clear-checker"));

    // Navigate should proceed
    fireEvent.click(screen.getByTestId("navigate"));

    const btn = screen.getByTestId("navigate") as HTMLElement;
    expect(btn.dataset.result).toBe("true");
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  // 9. Navigation API "traverse" event handling
  it("blocks traverse navigation via the Navigation API when dirty", () => {
    const listeners: Record<string, Function[]> = {};
    const mockNav = {
      addEventListener: (type: string, handler: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      removeEventListener: (type: string, handler: Function) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
      },
    };
    (window as any).navigation = mockNav;

    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Buddies & Budget"]} />
    );

    // Register the dirty checker
    fireEvent.click(screen.getByTestId("set-checker"));

    // Simulate a traverse navigation event
    const preventDefault = vi.fn();
    const event = {
      navigationType: "traverse",
      canIntercept: true,
      preventDefault,
    };
    act(() => {
      listeners["navigate"]?.forEach((h) => h(event));
    });

    // Should have called preventDefault
    expect(preventDefault).toHaveBeenCalled();

    // Should show the dialog
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();
  });

  // 10. Navigation API fires __back__ which calls history.back() on discard
  it("calls history.back() when discarding a traverse navigation", () => {
    const historyBackSpy = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => {});
    const listeners: Record<string, Function[]> = {};
    const mockNav = {
      addEventListener: (type: string, handler: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      removeEventListener: (type: string, handler: Function) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
      },
    };
    (window as any).navigation = mockNav;

    renderWithProvider(<TestConsumer dirtyChecker={() => ["Sessions"]} />);

    fireEvent.click(screen.getByTestId("set-checker"));

    // Simulate traverse
    const preventDefault = vi.fn();
    act(() => {
      listeners["navigate"]?.forEach((h) =>
        h({ navigationType: "traverse", canIntercept: true, preventDefault })
      );
    });

    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    fireEvent.click(screen.getByText("Discard & Leave"));

    expect(historyBackSpy).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved Changes")).toBeNull();

    historyBackSpy.mockRestore();
  });

  // 11. Non-traverse navigationType does NOT block navigation
  it("does not block non-traverse navigation types", () => {
    const listeners: Record<string, Function[]> = {};
    const mockNav = {
      addEventListener: (type: string, handler: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      removeEventListener: (type: string, handler: Function) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
      },
    };
    (window as any).navigation = mockNav;

    renderWithProvider(<TestConsumer dirtyChecker={() => ["Sessions"]} />);

    fireEvent.click(screen.getByTestId("set-checker"));

    const preventDefault = vi.fn();
    // Simulate a "push" navigation (not "traverse")
    listeners["navigate"]?.forEach((h) =>
      h({ navigationType: "push", canIntercept: true, preventDefault })
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  // 12. canIntercept=false does NOT block navigation
  it("does not block traverse navigation when canIntercept is false", () => {
    const listeners: Record<string, Function[]> = {};
    const mockNav = {
      addEventListener: (type: string, handler: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      removeEventListener: (type: string, handler: Function) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
      },
    };
    (window as any).navigation = mockNav;

    renderWithProvider(<TestConsumer dirtyChecker={() => ["Sessions"]} />);

    fireEvent.click(screen.getByTestId("set-checker"));

    const preventDefault = vi.fn();
    listeners["navigate"]?.forEach((h) =>
      h({ navigationType: "traverse", canIntercept: false, preventDefault })
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  // 13. guardNavigation with clean state after checker was previously set but returned empty
  it("allows navigation when checker was set but returns empty array", () => {
    let dirtySteps: string[] = ["Sessions"];

    function DynamicConsumer() {
      const { setDirtyChecker, guardNavigation } = useNavigationGuard();

      return (
        <div>
          <button
            data-testid="register"
            onClick={() => setDirtyChecker(() => dirtySteps)}
          >
            Register
          </button>
          <button
            data-testid="try-navigate"
            onClick={() => {
              const allowed = guardNavigation("/target");
              (
                document.querySelector(
                  '[data-testid="try-navigate"]'
                ) as HTMLElement
              ).dataset.result = String(allowed);
            }}
          >
            Go
          </button>
        </div>
      );
    }

    renderWithProvider(<DynamicConsumer />);

    // Register checker that returns dirty steps
    fireEvent.click(screen.getByTestId("register"));

    // First attempt - should block
    fireEvent.click(screen.getByTestId("try-navigate"));
    expect(
      (screen.getByTestId("try-navigate") as HTMLElement).dataset.result
    ).toBe("false");
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    // Dismiss
    fireEvent.click(screen.getByText("Stay"));

    // Now make the checker return empty (simulating user saved changes)
    dirtySteps = [];

    // Second attempt - should proceed
    fireEvent.click(screen.getByTestId("try-navigate"));
    expect(
      (screen.getByTestId("try-navigate") as HTMLElement).dataset.result
    ).toBe("true");
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  // ── Global store integration ──────────────────────────────────

  it("registers globalGuardNavigation when provider mounts", () => {
    // Before mount: no guard registered — should return true
    expect(globalGuardNavigation("/")).toBe(true);

    renderWithProvider(<TestConsumer dirtyChecker={() => ["Sessions"]} />);
    fireEvent.click(screen.getByTestId("set-checker"));

    // After mount with dirty checker: global guard should block navigation
    // globalGuardNavigation triggers React state updates (setPendingHref, setDirtyStepNames)
    let result: boolean;
    act(() => {
      result = globalGuardNavigation("/");
    });
    expect(result!).toBe(false);
  });

  it("clears globalGuardNavigation when provider unmounts", () => {
    const { unmount } = renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Sessions"]} />
    );
    fireEvent.click(screen.getByTestId("set-checker"));

    // Guard is active while mounted
    // globalGuardNavigation triggers React state updates (setPendingHref, setDirtyStepNames)
    let result: boolean;
    act(() => {
      result = globalGuardNavigation("/");
    });
    expect(result!).toBe(false);

    // unmount triggers cleanup effect that calls setGlobalGuard(null)
    act(() => {
      unmount();
    });

    // After unmount: global guard cleared — navigation proceeds freely
    expect(globalGuardNavigation("/")).toBe(true);
  });

  it("globalGuardNavigation returns true when no provider is mounted", () => {
    // No provider rendered at all
    expect(globalGuardNavigation("/some/path")).toBe(true);
  });

  it("globalGuardNavigation returns true when provider is mounted but no dirty steps", () => {
    renderWithProvider(<TestConsumer dirtyChecker={() => []} />);
    fireEvent.click(screen.getByTestId("set-checker"));

    expect(globalGuardNavigation("/")).toBe(true);
  });

  // ── onDiscard callback ──────────────────────────────────────

  it("calls onDiscard callback instead of router.push when provided", () => {
    const onDiscard = vi.fn();

    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Buddies & Budget"]} />
    );
    fireEvent.click(screen.getByTestId("set-checker"));

    // Trigger guard with an onDiscard callback via the global store
    let result: boolean;
    act(() => {
      result = globalGuardNavigation("/login", onDiscard);
    });
    expect(result!).toBe(false);
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    // Click "Discard & Leave"
    fireEvent.click(screen.getByText("Discard & Leave"));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved Changes")).toBeNull();
  });

  it("clears onDiscard after Stay so traverse does not invoke stale callback", () => {
    const historyBackSpy = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => {});
    const listeners: Record<string, Function[]> = {};
    const mockNav = {
      addEventListener: (type: string, handler: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      removeEventListener: (type: string, handler: Function) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
      },
    };
    (window as any).navigation = mockNav;

    const onDiscard = vi.fn();

    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Buddies & Budget"]} />
    );
    fireEvent.click(screen.getByTestId("set-checker"));

    // 1. Trigger guard with onDiscard (simulating logout click)
    act(() => {
      globalGuardNavigation("/login", onDiscard);
    });
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    // 2. Click "Stay" — should clear the onDiscard callback
    fireEvent.click(screen.getByText("Stay"));
    expect(screen.queryByText("Unsaved Changes")).toBeNull();

    // Re-register dirty checker (Stay cleared it via handleCancel path,
    // but the original checker ref was nulled by Discard flow — here we
    // need to re-set it so the traverse handler sees dirty steps)
    fireEvent.click(screen.getByTestId("set-checker"));

    // 3. Simulate browser back (traverse)
    const preventDefault = vi.fn();
    act(() => {
      listeners["navigate"]?.forEach((h) =>
        h({ navigationType: "traverse", canIntercept: true, preventDefault })
      );
    });
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    // 4. Click "Discard & Leave" — should call history.back(), NOT the stale onDiscard
    fireEvent.click(screen.getByText("Discard & Leave"));

    expect(onDiscard).not.toHaveBeenCalled();
    expect(historyBackSpy).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    historyBackSpy.mockRestore();
  });

  it("falls back to router.push when no onDiscard callback is provided", () => {
    renderWithProvider(
      <TestConsumer dirtyChecker={() => ["Buddies & Budget"]} />
    );
    fireEvent.click(screen.getByTestId("set-checker"));

    act(() => {
      globalGuardNavigation("/some/route");
    });
    expect(screen.getByText("Unsaved Changes")).toBeTruthy();

    fireEvent.click(screen.getByText("Discard & Leave"));

    expect(mockPush).toHaveBeenCalledWith("/some/route");
  });

  // Cleanup of Navigation API listener on unmount
  it("removes the navigation event listener on unmount", () => {
    const addedHandlers: Function[] = [];
    const removedHandlers: Function[] = [];
    const mockNav = {
      addEventListener: (_type: string, handler: Function) => {
        addedHandlers.push(handler);
      },
      removeEventListener: (_type: string, handler: Function) => {
        removedHandlers.push(handler);
      },
    };
    (window as any).navigation = mockNav;

    const { unmount } = renderWithProvider(<TestConsumer />);

    expect(addedHandlers.length).toBe(1);

    unmount();

    expect(removedHandlers.length).toBe(1);
    expect(removedHandlers[0]).toBe(addedHandlers[0]);
  });
});
