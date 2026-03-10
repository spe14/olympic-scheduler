// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  useDateValidation,
  DateModeOption,
  ConsecutiveDaysInput,
  SpecificDatesInput,
} from "@/components/date-mode-fields";

afterEach(cleanup);

// ─── useDateValidation ─────────────────────────────────────────────

describe("useDateValidation", () => {
  // 1. Consecutive mode: valid days (1-19) returns isValid=true, no hints
  it("consecutive mode with valid days returns isValid true and no hints", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "5", "", "")
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.daysHints).toEqual([]);
    expect(result.current.dateRangeHints).toEqual([]);
  });

  // 2. Consecutive mode: 0 days returns isValid=false with hint
  it("consecutive mode with 0 days returns isValid false with hint", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "0", "", "")
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.daysHints.length).toBeGreaterThan(0);
  });

  // 3. Consecutive mode: 20 days returns isValid=false, hint about exceeding 19
  it("consecutive mode with 20 days returns isValid false with max hint", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "20", "", "")
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.daysHints).toEqual(
      expect.arrayContaining([expect.stringContaining("19")])
    );
  });

  // 4. Consecutive mode: empty string returns isValid=false, no hints
  it("consecutive mode with empty string returns isValid false and no hints", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "", "", "")
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.daysHints).toEqual([]);
  });

  // 5. Consecutive mode: non-integer returns isValid=false with hint
  it("consecutive mode with non-integer returns isValid false with hint", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "3.5", "", "")
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.daysHints.length).toBeGreaterThan(0);
  });

  // 6. Consecutive mode: boundary values (1 and 19 are valid)
  it("consecutive mode boundary value 1 is valid", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "1", "", "")
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.daysHints).toEqual([]);
  });

  it("consecutive mode boundary value 19 is valid", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "19", "", "")
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.daysHints).toEqual([]);
  });

  // 7. Specific mode: valid date range returns isValid=true, no hints
  it("specific mode with valid date range returns isValid true", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "", "2028-07-12", "2028-07-20")
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.dateRangeHints).toEqual([]);
    expect(result.current.daysHints).toEqual([]);
  });

  // 8. Specific mode: end before start returns isValid=false, dateRangeHints populated
  it("specific mode with end before start returns isValid false with hint", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "", "2028-07-20", "2028-07-12")
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.dateRangeHints).toEqual([
      "End date must be on or after the start date.",
    ]);
  });

  // 9. Specific mode: same start and end date is valid
  it("specific mode with same start and end date is valid", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "", "2028-07-15", "2028-07-15")
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.dateRangeHints).toEqual([]);
  });

  // 10. Specific mode: missing start date returns isValid=false
  it("specific mode with missing start date returns isValid false", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "", "", "2028-07-20")
    );
    expect(result.current.isValid).toBe(false);
  });

  // 11. Specific mode: missing end date returns isValid=false
  it("specific mode with missing end date returns isValid false", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "", "2028-07-12", "")
    );
    expect(result.current.isValid).toBe(false);
  });

  // 12. Specific mode: both dates missing returns isValid=false, no hints
  it("specific mode with both dates missing returns isValid false and no hints", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "", "", "")
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.dateRangeHints).toEqual([]);
  });

  // 13. daysHints only populated in consecutive mode
  it("daysHints not populated in specific mode even with invalid days value", () => {
    const { result } = renderHook(() =>
      useDateValidation("specific", "0", "2028-07-12", "2028-07-20")
    );
    expect(result.current.daysHints).toEqual([]);
  });

  // 14. dateRangeHints only populated in specific mode
  it("dateRangeHints not populated in consecutive mode even with invalid date range", () => {
    const { result } = renderHook(() =>
      useDateValidation("consecutive", "5", "2028-07-20", "2028-07-12")
    );
    expect(result.current.dateRangeHints).toEqual([]);
  });
});

// ─── ConsecutiveDaysInput ───────────────────────────────────────────

describe("ConsecutiveDaysInput", () => {
  // 15. Renders label and placeholder
  it("renders label and placeholder", () => {
    render(<ConsecutiveDaysInput value="" onChange={vi.fn()} hints={[]} />);
    expect(screen.getByText("Number of Days")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. 5")).toBeTruthy();
  });

  // 16. Shows value in input
  it("shows value in input", () => {
    render(<ConsecutiveDaysInput value="7" onChange={vi.fn()} hints={[]} />);
    expect(screen.getByDisplayValue("7")).toBeTruthy();
  });

  // 17. Calls onChange with digit-only values
  it("calls onChange with digit-only values", () => {
    const onChange = vi.fn();
    render(<ConsecutiveDaysInput value="" onChange={onChange} hints={[]} />);
    const input = screen.getByPlaceholderText("e.g. 5");
    fireEvent.change(input, { target: { value: "12" } });
    expect(onChange).toHaveBeenCalledWith("12");
  });

  // 18. Rejects non-digit input
  it("rejects non-digit input", () => {
    const onChange = vi.fn();
    render(<ConsecutiveDaysInput value="" onChange={onChange} hints={[]} />);
    const input = screen.getByPlaceholderText("e.g. 5");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "3!" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "1.5" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  // 19. Allows empty string (clearing the field)
  it("allows empty string to clear the field", () => {
    const onChange = vi.fn();
    render(<ConsecutiveDaysInput value="5" onChange={onChange} hints={[]} />);
    const input = screen.getByPlaceholderText("e.g. 5");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  // 20. Renders hint messages
  it("renders hint messages", () => {
    render(
      <ConsecutiveDaysInput
        value="0"
        onChange={vi.fn()}
        hints={["Must be at least 1 day.", "Another hint"]}
      />
    );
    expect(screen.getByText("Must be at least 1 day.")).toBeTruthy();
    expect(screen.getByText("Another hint")).toBeTruthy();
  });

  // 21. Shows Olympic Period text
  it("shows Olympic Period: 19 days text", () => {
    render(<ConsecutiveDaysInput value="" onChange={vi.fn()} hints={[]} />);
    expect(screen.getByText("Olympic Period: 19 days")).toBeTruthy();
  });
});

// ─── SpecificDatesInput ─────────────────────────────────────────────

describe("SpecificDatesInput", () => {
  const defaultProps = {
    startDate: "",
    endDate: "",
    onStartDateChange: vi.fn(),
    onEndDateChange: vi.fn(),
    hints: [] as string[],
  };

  // 22. Renders start and end date inputs with labels
  it("renders start and end date labels", () => {
    render(<SpecificDatesInput {...defaultProps} />);
    expect(screen.getByText("Start Date")).toBeTruthy();
    expect(screen.getByText("End Date")).toBeTruthy();
  });

  // 23. Shows start/end values
  it("shows start and end date values", () => {
    render(
      <SpecificDatesInput
        {...defaultProps}
        startDate="2028-07-12"
        endDate="2028-07-20"
      />
    );
    expect(screen.getByDisplayValue("2028-07-12")).toBeTruthy();
    expect(screen.getByDisplayValue("2028-07-20")).toBeTruthy();
  });

  // 24. Calls onStartDateChange on change
  it("calls onStartDateChange on start date change", () => {
    const onStartDateChange = vi.fn();
    const { container } = render(
      <SpecificDatesInput
        {...defaultProps}
        onStartDateChange={onStartDateChange}
      />
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2028-07-15" } });
    expect(onStartDateChange).toHaveBeenCalledWith("2028-07-15");
  });

  // 25. Calls onEndDateChange on change
  it("calls onEndDateChange on end date change", () => {
    const onEndDateChange = vi.fn();
    const { container } = render(
      <SpecificDatesInput {...defaultProps} onEndDateChange={onEndDateChange} />
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: "2028-07-25" } });
    expect(onEndDateChange).toHaveBeenCalledWith("2028-07-25");
  });

  // 26. Has min/max attributes for Olympic period
  it("has min and max attributes for Olympic period", () => {
    const { container } = render(<SpecificDatesInput {...defaultProps} />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const startInput = dateInputs[0];
    const endInput = dateInputs[1];

    expect(startInput.getAttribute("min")).toBe("2028-07-12");
    expect(startInput.getAttribute("max")).toBe("2028-07-30");
    expect(endInput.getAttribute("min")).toBe("2028-07-12");
    expect(endInput.getAttribute("max")).toBe("2028-07-30");
  });

  // 27. Renders hint messages
  it("renders hint messages", () => {
    render(
      <SpecificDatesInput
        {...defaultProps}
        hints={["End date must be on or after the start date."]}
      />
    );
    expect(
      screen.getByText("End date must be on or after the start date.")
    ).toBeTruthy();
  });

  // 28. Shows Olympic period info text
  it("shows Olympic period info text", () => {
    render(<SpecificDatesInput {...defaultProps} />);
    expect(
      screen.getByText("Olympic Period: Jul 12, 2028 - Jul 30, 2028")
    ).toBeTruthy();
  });
});

// ─── DateModeOption ─────────────────────────────────────────────────

describe("DateModeOption", () => {
  // 29. Renders label and description
  it("renders label and description", () => {
    render(
      <DateModeOption
        selected={false}
        onClick={vi.fn()}
        label="Consecutive Days"
        description="Choose a number of consecutive days"
      />
    );
    expect(screen.getByText("Consecutive Days")).toBeTruthy();
    expect(
      screen.getByText("Choose a number of consecutive days")
    ).toBeTruthy();
  });

  // 30. Calls onClick when clicked
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <DateModeOption
        selected={false}
        onClick={onClick}
        label="Consecutive Days"
        description="Choose a number of consecutive days"
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  // 31. Shows selected state indicator
  it("renders selected indicator div when selected", () => {
    const { container, rerender } = render(
      <DateModeOption
        selected={false}
        onClick={vi.fn()}
        label="Test"
        description="Desc"
      />
    );
    // The radio circle div is always present; when not selected, it has no inner dot
    const radioCircle = container.querySelector("button > div")!;
    expect(radioCircle.children.length).toBe(0);

    rerender(
      <DateModeOption
        selected={true}
        onClick={vi.fn()}
        label="Test"
        description="Desc"
      />
    );
    // When selected, the radio circle div contains the inner dot div
    const radioCircleSelected = container.querySelector("button > div")!;
    expect(radioCircleSelected.children.length).toBe(1);
  });
});
