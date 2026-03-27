import { memo } from "react";

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

  return (
    <div className="select-wrapper">
      {label && (
        <label htmlFor={id} className="select-label">
          {label}
        </label>
      )}
      {description && <p className="select-description">{description}</p>}
      <select
        id={id}
        name={name}
        className="select-input"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

SelectInner.displayName = "Select";

export const Select = memo(SelectInner) as typeof SelectInner;
