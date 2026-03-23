// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  SidePanelProvider,
  useSidePanel,
} from "@/app/(main)/groups/[groupId]/_components/side-panel-context";

afterEach(cleanup);

function Consumer() {
  const { panel, setPanel } = useSidePanel();
  return (
    <div>
      <div data-testid="panel">{panel ?? "none"}</div>
      <button onClick={() => setPanel(<span>sidebar content</span>)}>
        Set Panel
      </button>
      <button onClick={() => setPanel(null)}>Clear Panel</button>
    </div>
  );
}

describe("SidePanelProvider", () => {
  it("starts with null panel", () => {
    render(
      <SidePanelProvider>
        <Consumer />
      </SidePanelProvider>
    );
    expect(screen.getByTestId("panel")).toHaveTextContent("none");
  });

  it("updates panel when setPanel is called", () => {
    render(
      <SidePanelProvider>
        <Consumer />
      </SidePanelProvider>
    );

    act(() => {
      screen.getByText("Set Panel").click();
    });

    expect(screen.getByTestId("panel")).toHaveTextContent("sidebar content");
  });

  it("clears panel when setPanel is called with null", () => {
    render(
      <SidePanelProvider>
        <Consumer />
      </SidePanelProvider>
    );

    act(() => {
      screen.getByText("Set Panel").click();
    });
    expect(screen.getByTestId("panel")).toHaveTextContent("sidebar content");

    act(() => {
      screen.getByText("Clear Panel").click();
    });
    expect(screen.getByTestId("panel")).toHaveTextContent("none");
  });
});

describe("useSidePanel outside provider", () => {
  it("returns default context with noop setPanel", () => {
    function BareConsumer() {
      const { panel, setPanel } = useSidePanel();
      // setPanel should be a noop, panel should be null
      setPanel(<div>test</div>);
      return <div data-testid="bare">{panel ?? "null"}</div>;
    }
    render(<BareConsumer />);
    expect(screen.getByTestId("bare")).toHaveTextContent("null");
  });
});
