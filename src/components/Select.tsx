import { memo, useState, useRef, useEffect, useCallback } from "react";

interface Props<T extends string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{
    value: T;
    label: string;
  }>;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
}

const SelectInner = <T extends string>({
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  label,
  description,
}: Props<T>) => {
  const id = `${name}-select`;
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  }, [disabled, isOpen]);

  const handleOptionClick = useCallback(
    (optionValue: T) => {
      if (!disabled) {
        onChange(optionValue);
        setIsOpen(false);
      }
    },
    [disabled, onChange]
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [disabled]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  return (
    <div className="select-wrapper">
      {label && (
        <label htmlFor={id} className="select-label">
          {label}
        </label>
      )}
      {description && <p className="select-description">{description}</p>}
      <div ref={wrapperRef} className="custom-select-wrapper">
        <button
          id={id}
          name={name}
          type="button"
          className={`custom-select-trigger ${disabled ? "disabled" : ""} ${isOpen ? "open" : ""}`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="custom-select-value">{selectedOption?.label || placeholder || ""}</span>
          <span className="custom-select-arrow" aria-hidden="true"></span>
        </button>
        {isOpen && (
          <ul className="custom-select-dropdown" role="listbox" aria-label={label || name}>
            {placeholder && (
              <li className="custom-select-option disabled" role="option" aria-disabled="true">
                {placeholder}
              </li>
            )}
            {options.map((option) => (
              <li
                key={option.value}
                className={`custom-select-option ${option.value === value ? "selected" : ""}`}
                role="option"
                aria-selected={option.value === value}
                onClick={() => handleOptionClick(option.value)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

SelectInner.displayName = "Select";

export const Select = memo(SelectInner) as typeof SelectInner;
