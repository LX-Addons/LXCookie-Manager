import { memo, useId } from "react";

interface OptionWithOnChange {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface OptionWithValue {
  value: string;
  label: string;
  description?: string;
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
  const isUnifiedApi = options.length > 0 && "value" in options[0];
  const groupId = useId();

  if (isUnifiedApi && onChange) {
    const unifiedOptions = options as OptionWithValue[];

    const handleChange = (value: string, checked: boolean, disabled: boolean) => {
      if (disabled) return;
      const currentValues = unifiedOptions.filter((opt) => opt.checked).map((opt) => opt.value);

      if (checked) {
        if (!currentValues.includes(value)) {
          onChange([...currentValues, value]);
        }
      } else {
        onChange(currentValues.filter((v) => v !== value));
      }
    };

    return (
      <fieldset className="checkbox-group">
        {unifiedOptions.map((option, index) => {
          const id = `${groupId}-${index}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`checkbox-control ${option.disabled ? "disabled" : ""}`}
            >
              <input
                id={id}
                type="checkbox"
                checked={option.checked}
                onChange={(e) => handleChange(option.value, e.target.checked, !!option.disabled)}
                disabled={option.disabled}
                aria-label={option.label}
              />
              <span className="checkbox-indicator" aria-hidden="true" />
              <span className="checkbox-content">
                <span className="checkbox-title">{option.label}</span>
                {option.description && (
                  <span className="checkbox-description">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  const individualOptions = options as OptionWithOnChange[];

  return (
    <fieldset className="checkbox-group">
      {individualOptions.map((option, index) => {
        const id = `${groupId}-${index}`;
        return (
          <label
            key={option.label}
            htmlFor={id}
            className={`checkbox-control ${option.disabled ? "disabled" : ""}`}
          >
            <input
              id={id}
              type="checkbox"
              checked={option.checked}
              onChange={(e) => !option.disabled && option.onChange(e.target.checked)}
              disabled={option.disabled}
              aria-label={option.label}
            />
            <span className="checkbox-indicator" aria-hidden="true" />
            <span className="checkbox-content">
              <span className="checkbox-title">{option.label}</span>
              {option.description && (
                <span className="checkbox-description">{option.description}</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
});

CheckboxGroup.displayName = "CheckboxGroup";
