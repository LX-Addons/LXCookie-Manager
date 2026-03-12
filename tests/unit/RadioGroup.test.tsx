import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RadioGroup } from "@/components/RadioGroup";

describe("RadioGroup", () => {
  it("should render all options", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ];

    render(<RadioGroup name="test" value="option1" onChange={vi.fn()} options={options} />);

    expect(screen.getByText("Option 1")).toBeTruthy();
    expect(screen.getByText("Option 2")).toBeTruthy();
  });

  it("should render radio with correct checked state", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ];

    render(<RadioGroup name="test" value="option1" onChange={vi.fn()} options={options} />);

    const radios = screen.getAllByRole("radio");
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect((radios[1] as HTMLInputElement).checked).toBe(false);
  });

  it("should call onChange when radio is clicked", () => {
    const mockOnChange = vi.fn();
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ];

    render(<RadioGroup name="test" value="option1" onChange={mockOnChange} options={options} />);

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);

    expect(mockOnChange).toHaveBeenCalledWith("option2");
  });

  it("should render with radiogroup role", () => {
    const options = [{ value: "option1", label: "Option 1" }];

    render(<RadioGroup name="test" value="option1" onChange={vi.fn()} options={options} />);

    const radiogroup = screen.getByRole("radiogroup");
    expect(radiogroup).toBeTruthy();
  });

  it("should render multiple radios", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
      { value: "option3", label: "Option 3" },
    ];

    render(<RadioGroup name="test" value="option1" onChange={vi.fn()} options={options} />);

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(3);
  });

  it("should have correct name attribute", () => {
    const options = [{ value: "option1", label: "Option 1" }];

    render(<RadioGroup name="test-group" value="option1" onChange={vi.fn()} options={options} />);

    const radio = screen.getByRole("radio");
    expect(radio.getAttribute("name")).toBe("test-group");
  });

  it("should handle value change correctly", () => {
    const mockOnChange = vi.fn();
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ];

    render(<RadioGroup name="test" value="a" onChange={mockOnChange} options={options} />);

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[2]);

    expect(mockOnChange).toHaveBeenCalledWith("c");
  });
});
