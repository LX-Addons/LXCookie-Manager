import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckboxGroup } from "@/components/CheckboxGroup";

describe("CheckboxGroup", () => {
  it("should render all options", () => {
    const options = [
      { checked: false, label: "Option 1", onChange: vi.fn() },
      { checked: true, label: "Option 2", onChange: vi.fn() },
    ];

    render(<CheckboxGroup options={options} />);

    expect(screen.getByText("Option 1")).toBeTruthy();
    expect(screen.getByText("Option 2")).toBeTruthy();
  });

  it("should render checkbox with correct checked state", () => {
    const options = [
      { checked: false, label: "Unchecked", onChange: vi.fn() },
      { checked: true, label: "Checked", onChange: vi.fn() },
    ];

    render(<CheckboxGroup options={options} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
  });

  it("should call onChange when checkbox is clicked", () => {
    const mockOnChange = vi.fn();
    const options = [{ checked: false, label: "Test Option", onChange: mockOnChange }];

    render(<CheckboxGroup options={options} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it("should call onChange with false when checked checkbox is clicked", () => {
    const mockOnChange = vi.fn();
    const options = [{ checked: true, label: "Test Option", onChange: mockOnChange }];

    render(<CheckboxGroup options={options} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  it("should render with group role", () => {
    const options = [{ checked: false, label: "Option", onChange: vi.fn() }];

    render(<CheckboxGroup options={options} />);

    const group = screen.getByRole("group");
    expect(group).toBeTruthy();
  });

  it("should render multiple checkboxes", () => {
    const options = [
      { checked: false, label: "Option 1", onChange: vi.fn() },
      { checked: false, label: "Option 2", onChange: vi.fn() },
      { checked: false, label: "Option 3", onChange: vi.fn() },
    ];

    render(<CheckboxGroup options={options} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3);
  });

  it("should handle multiple checkbox changes independently", () => {
    const mockOnChange1 = vi.fn();
    const mockOnChange2 = vi.fn();
    const options = [
      { checked: false, label: "Option 1", onChange: mockOnChange1 },
      { checked: false, label: "Option 2", onChange: mockOnChange2 },
    ];

    render(<CheckboxGroup options={options} />);

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    expect(mockOnChange1).toHaveBeenCalledWith(true);
    expect(mockOnChange2).not.toHaveBeenCalled();
  });

  // Unified API mode tests
  describe("Unified API mode", () => {
    it("should render checkboxes with unified API", () => {
      const mockOnChange = vi.fn();
      const options = [
        { value: "option1", label: "Option 1", checked: false },
        { value: "option2", label: "Option 2", checked: true },
      ];

      render(<CheckboxGroup options={options} onChange={mockOnChange} />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(2);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
    });

    it("should call onChange with correct values when checking unchecked box", () => {
      const mockOnChange = vi.fn();
      const options = [
        { value: "option1", label: "Option 1", checked: false },
        { value: "option2", label: "Option 2", checked: false },
      ];

      render(<CheckboxGroup options={options} onChange={mockOnChange} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      expect(mockOnChange).toHaveBeenCalledWith(["option1"]);
    });

    it("should call onChange with correct values when unchecking checked box", () => {
      const mockOnChange = vi.fn();
      const options = [
        { value: "option1", label: "Option 1", checked: true },
        { value: "option2", label: "Option 2", checked: false },
      ];

      render(<CheckboxGroup options={options} onChange={mockOnChange} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it("should call onChange with multiple values when multiple boxes are checked", () => {
      const mockOnChange = vi.fn();
      const options = [
        { value: "option1", label: "Option 1", checked: true },
        { value: "option2", label: "Option 2", checked: false },
      ];

      render(<CheckboxGroup options={options} onChange={mockOnChange} />);

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      expect(mockOnChange).toHaveBeenCalledWith(["option1", "option2"]);
    });

    it("should handle multiple checkboxes being toggled in sequence", () => {
      const mockOnChange = vi.fn();
      const options = [
        { value: "option1", label: "Option 1", checked: false },
        { value: "option2", label: "Option 2", checked: false },
        { value: "option3", label: "Option 3", checked: false },
      ];

      const { rerender } = render(<CheckboxGroup options={options} onChange={mockOnChange} />);

      // Click first checkbox
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      expect(mockOnChange).toHaveBeenLastCalledWith(["option1"]);

      // Simulate state update and rerender
      const updatedOptions1 = [
        { value: "option1", label: "Option 1", checked: true },
        { value: "option2", label: "Option 2", checked: false },
        { value: "option3", label: "Option 3", checked: false },
      ];
      rerender(<CheckboxGroup options={updatedOptions1} onChange={mockOnChange} />);

      // Click second checkbox
      const checkboxes2 = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes2[1]);
      expect(mockOnChange).toHaveBeenLastCalledWith(["option1", "option2"]);

      // Simulate state update and rerender
      const updatedOptions2 = [
        { value: "option1", label: "Option 1", checked: true },
        { value: "option2", label: "Option 2", checked: true },
        { value: "option3", label: "Option 3", checked: false },
      ];
      rerender(<CheckboxGroup options={updatedOptions2} onChange={mockOnChange} />);

      // Click first checkbox to uncheck
      const checkboxes3 = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes3[0]);
      expect(mockOnChange).toHaveBeenLastCalledWith(["option2"]);
    });
  });
});
