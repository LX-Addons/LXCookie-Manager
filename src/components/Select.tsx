import { memo, useState, useRef, useEffect, useCallback } from "react";

type CloseReason = "escape" | "select" | "toggle" | "outside" | "tab";

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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [closeReason, setCloseReason] = useState<CloseReason | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedOption = options.find((opt) => opt.value === value);

  const closeSelect = useCallback((reason: CloseReason) => {
    setCloseReason(reason);
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      if (isOpen) {
        closeSelect("toggle");
      } else {
        setIsOpen(true);
        if (options.length > 0) {
          const selectedIndex = options.findIndex((opt) => opt.value === value);
          setFocusedIndex(selectedIndex === -1 ? 0 : selectedIndex);
        } else {
          setFocusedIndex(-1);
        }
      }
    }
  }, [disabled, isOpen, options, value, closeSelect]);

  const handleOptionClick = useCallback(
    (optionValue: T) => {
      if (!disabled) {
        onChange(optionValue);
        closeSelect("select");
      }
    },
    [disabled, onChange, closeSelect]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeSelect("outside");
      }
    },
    [closeSelect]
  );

  const handleClosedKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (options.length === 0) return;

      const openSelect = (startIndex: number) => {
        const selectedIndex = options.findIndex((opt) => opt.value === value);
        setFocusedIndex(selectedIndex === -1 ? startIndex : selectedIndex);
        setIsOpen(true);
      };

      switch (e.key) {
        case "Enter":
        case " ":
        case "ArrowDown":
          e.preventDefault();
          openSelect(0);
          break;
        case "ArrowUp":
          e.preventDefault();
          openSelect(options.length - 1);
          break;
      }
    },
    [options, value]
  );

  const handleOpenKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (options.length === 0) {
        closeSelect("escape");
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % options.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onChange(options[focusedIndex].value);
            closeSelect("select");
          }
          break;
        case "Escape":
          e.preventDefault();
          closeSelect("escape");
          break;
        case "Tab":
          closeSelect("tab");
          break;
      }
    },
    [options, onChange, focusedIndex, closeSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (isOpen) {
        handleOpenKeyDown(e);
      } else {
        handleClosedKeyDown(e);
      }
    },
    [disabled, isOpen, handleClosedKeyDown, handleOpenKeyDown]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen && closeReason) {
      switch (closeReason) {
        case "escape":
        case "select":
        case "toggle":
          setTimeout(() => triggerRef.current?.focus(), 0);
          break;
        case "outside":
        case "tab":
          break;
      }
      setCloseReason(null);
    }
  }, [isOpen, closeReason]);

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
          ref={triggerRef}
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
          <div
            ref={dropdownRef}
            className="custom-select-dropdown"
            role="listbox"
            aria-label={label || name}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {placeholder && (
              <div
                className="custom-select-option disabled"
                role="option"
                aria-disabled="true"
                aria-selected="false"
              >
                {placeholder}
              </div>
            )}
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                className={`custom-select-option ${option.value === value ? "selected" : ""} ${focusedIndex === index ? "focused" : ""}`}
                role="option"
                aria-selected={option.value === value}
                tabIndex={focusedIndex === index ? 0 : -1}
                onClick={() => handleOptionClick(option.value)}
                onMouseEnter={() => setFocusedIndex(index)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

SelectInner.displayName = "Select";

export const Select = memo(SelectInner) as typeof SelectInner;
