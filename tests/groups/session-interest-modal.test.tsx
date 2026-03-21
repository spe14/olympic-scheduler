// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SessionInterestModal from "@/app/(main)/groups/[groupId]/preferences/_components/session-interest-modal";
import type { SessionData } from "@/app/(main)/groups/[groupId]/preferences/_components/preference-wizard";

const mockSession: SessionData = {
  sessionCode: "TEN-001",
  sport: "Tennis",
  venue: "Court A",
  zone: "Valley Zone",
  sessionDate: "2025-07-26",
  sessionType: "Final",
  sessionDescription: "Men's Singles Final",
  startTime: "10:00",
  endTime: "12:00",
};

describe("SessionInterestModal", () => {
  const defaultProps = {
    session: mockSession,
    sportColor: {
      accent: "#009de5",
      bg: "#d0edfa",
      text: "#006a9e",
      title: "#0084c2",
    },
    existingPreference: null,
    onSave: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Rendering ──────────────────────────────────────────────────

  it("renders session info", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.getByText("Tennis")).toBeDefined();
    expect(screen.getByText("Final")).toBeDefined();
    expect(screen.getByText("Men's Singles Final")).toBeDefined();
  });

  it("renders interest level buttons", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.getByText("Low")).toBeDefined();
    expect(screen.getByText("Medium")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
  });

  it("renders Cancel and Apply buttons", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeDefined();
    expect(screen.getByText("Apply")).toBeDefined();
  });

  it("renders session code in modal", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.getByText(/TEN-001/)).toBeDefined();
  });

  it("renders date and time info", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.getByText(/10:00 AM/)).toBeDefined();
    expect(screen.getByText(/12:00 PM/)).toBeDefined();
  });

  it("renders venue and zone info", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.getByText(/Court A/)).toBeDefined();
    expect(screen.getByText(/Valley Zone/)).toBeDefined();
  });

  it("renders session description items split by semicolons", () => {
    const session = {
      ...mockSession,
      sessionDescription: "Event A; Event B",
    };
    render(<SessionInterestModal {...defaultProps} session={session} />);
    expect(screen.getByText("Event A")).toBeDefined();
    expect(screen.getByText("Event B")).toBeDefined();
  });

  it("does not render description section when sessionDescription is null", () => {
    const session = { ...mockSession, sessionDescription: null };
    render(<SessionInterestModal {...defaultProps} session={session} />);
    // Should still render sport and type, just no description list
    expect(screen.getByText("Tennis")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  // ── Apply disabled state ──────────────────────────────────────

  it("has Apply disabled when nothing is selected", () => {
    render(<SessionInterestModal {...defaultProps} />);
    const saveBtn = screen.getByText("Apply");
    expect(saveBtn.hasAttribute("disabled")).toBe(true);
  });

  it("enables Apply when interest is selected", () => {
    render(<SessionInterestModal {...defaultProps} />);
    fireEvent.click(screen.getByText("High"));
    const saveBtn = screen.getByText("Apply");
    expect(saveBtn.hasAttribute("disabled")).toBe(false);
  });

  // ── Save callback ─────────────────────────────────────────────

  it("calls onSave with correct data", () => {
    render(<SessionInterestModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Medium"));
    fireEvent.click(screen.getByText("Apply"));

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      sessionId: "TEN-001",
      interest: "medium",
    });
  });

  it("does not call onSave when Apply is clicked and no interest is selected", () => {
    render(<SessionInterestModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Apply"));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("allows changing interest level after initial selection", () => {
    render(<SessionInterestModal {...defaultProps} />);
    fireEvent.click(screen.getByText("High"));
    // Change interest
    fireEvent.click(screen.getByText("Low"));
    fireEvent.click(screen.getByText("Apply"));

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      sessionId: "TEN-001",
      interest: "low",
    });
  });

  // ── Close/Cancel ──────────────────────────────────────────────

  it("calls onClose when Cancel is clicked", () => {
    render(<SessionInterestModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Existing preference ───────────────────────────────────────

  it("pre-fills existing preference values", () => {
    render(
      <SessionInterestModal
        {...defaultProps}
        existingPreference={{
          sessionId: "TEN-001",
          interest: "high",
        }}
      />
    );

    // Apply should be enabled (both values pre-filled)
    const saveBtn = screen.getByText("Apply");
    expect(saveBtn.hasAttribute("disabled")).toBe(false);

    // Remove Session Interest link should be visible
    expect(screen.getByText("Remove Session Interest")).toBeDefined();
  });

  it("does not show Remove Session Interest for new session", () => {
    render(<SessionInterestModal {...defaultProps} />);
    expect(screen.queryByText("Remove Session Interest")).toBeNull();
  });

  it("calls onClear when Remove Session Interest is clicked", () => {
    render(
      <SessionInterestModal
        {...defaultProps}
        existingPreference={{
          sessionId: "TEN-001",
          interest: "high",
        }}
      />
    );

    fireEvent.click(screen.getByText("Remove Session Interest"));
    expect(defaultProps.onClear).toHaveBeenCalledWith("TEN-001");
  });

  // ── Interest info tooltip ──────────────────────────────────────

  describe("interest info tooltip", () => {
    it("shows interest info tooltip on click", () => {
      render(<SessionInterestModal {...defaultProps} />);

      // Find the "?" info button near "Interest Level"
      const infoButtons = screen.getAllByText("?");
      fireEvent.click(infoButtons[0]);

      expect(
        screen.getByText("How interested are you in attending this session?")
      ).toBeDefined();
    });

    it("hides interest info tooltip on second click", () => {
      render(<SessionInterestModal {...defaultProps} />);

      const infoButtons = screen.getAllByText("?");
      fireEvent.click(infoButtons[0]);
      expect(
        screen.getByText("How interested are you in attending this session?")
      ).toBeDefined();

      fireEvent.click(infoButtons[0]);
      expect(
        screen.queryByText("How interested are you in attending this session?")
      ).toBeNull();
    });

    it("shows interest info tooltip on mouse enter", () => {
      render(<SessionInterestModal {...defaultProps} />);

      // The wrapper div has onMouseEnter
      const infoButtons = screen.getAllByText("?");
      const wrapper = infoButtons[0].parentElement!;
      fireEvent.mouseEnter(wrapper);

      expect(
        screen.getByText("How interested are you in attending this session?")
      ).toBeDefined();
    });

    it("hides interest info tooltip on mouse leave", () => {
      render(<SessionInterestModal {...defaultProps} />);

      const infoButtons = screen.getAllByText("?");
      const wrapper = infoButtons[0].parentElement!;
      fireEvent.mouseEnter(wrapper);
      expect(
        screen.getByText("How interested are you in attending this session?")
      ).toBeDefined();

      fireEvent.mouseLeave(wrapper);
      expect(
        screen.queryByText("How interested are you in attending this session?")
      ).toBeNull();
    });
  });

  // ── Toggle deselection ─────────────────────────────────────────

  describe("toggle deselection", () => {
    it("deselects interest level when clicking the same level again", () => {
      render(<SessionInterestModal {...defaultProps} />);

      fireEvent.click(screen.getByText("High"));
      // Apply should be enabled
      expect(screen.getByText("Apply").hasAttribute("disabled")).toBe(false);

      // Deselect interest
      fireEvent.click(screen.getByText("High"));
      // Apply should be disabled again (interest is null)
      expect(screen.getByText("Apply").hasAttribute("disabled")).toBe(true);
    });
  });
});
