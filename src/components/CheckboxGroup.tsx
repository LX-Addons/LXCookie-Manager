import { memo } from "react";

interface OptionWithOnChange {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface OptionWithValue {
  value: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
}

interface PropsWithIndividualOnChange {
  options: OptionWithOnChange[];
  onChange?: never;
}

interface PropsWithUnifiedOnChange {
  options: OptionWithValue[];
  onChange: (values: string[]) => void;
}

type Props = PropsWithIndividualOnChange | PropsWithUnifiedOnChange;

export const CheckboxGroup = memo(({ options, onChange }: Props) => {
  // Check if using unified onChange API (options have value property)
  const isUnifiedApi = options.length > 0 && "value" in options[0];

  if (isUnifiedApi && onChange) {
    // Unified API mode
    const unifiedOptions = options as OptionWithValue[];

    const handleChange = (value: string, checked: boolean, disabled: boolean) => {
      if (disabled) return;
      // Get currently checked values from props
      const currentValues = unifiedOptions.filter((opt) => opt.checked).map((opt) => opt.value);

      if (checked) {
        // Add the value if not already present
        if (!currentValues.includes(value)) {
          onChange([...currentValues, value]);
        }
      } else {
        // Remove the value
        onChange(currentValues.filter((v) => v !== value));
      }
    };

    return (
      <fieldset className="checkbox-group">
        {unifiedOptions.map((option) => (
          <label key={option.value} className="checkbox-label">
            <input
              type="checkbox"
              checked={option.checked}
              onChange={(e) => handleChange(option.value, e.target.checked, !!option.disabled)}
              disabled={option.disabled}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  // Individual onChange API mode
  const individualOptions = options as OptionWithOnChange[];

  return (
    <fieldset className="checkbox-group">
      {individualOptions.map((option) => (
        <label key={option.label} className="checkbox-label">
          <input
            type="checkbox"
            checked={option.checked}
            onChange={(e) => !option.disabled && option.onChange(e.target.checked)}
            disabled={option.disabled}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
});

CheckboxGroup.displayName = "CheckboxGroup";
