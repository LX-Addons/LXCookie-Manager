import { useState, ReactNode } from "react";
import { vi } from "vitest";

export const hasDomainInText = (
  textContent: string | null | undefined,
  domain: string
): boolean => {
  if (!textContent) return false;
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const domainPattern = new RegExp(
    String.raw`(^|[^a-zA-Z0-9.-])(?:[a-zA-Z0-9-]+\.)*${escapedDomain}(?=$|[^a-zA-Z0-9.-])`,
    "i"
  );
  return domainPattern.test(textContent);
};

export const createTranslationMock = (translations: Record<string, string>) => {
  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string | number>) => {
        const text = key in translations ? translations[key] : key;
        if (!params) return text;
        return text.replaceAll(/\{(\w+)\}/g, (_, token: string) => {
          const value = params[token];
          return value?.toString() || `{${token}}`;
        });
      },
    }),
  };
};

export const createConfirmDialogWrapperMock = () => {
  return {
    ConfirmDialogWrapper: ({
      children,
    }: {
      children: (
        showConfirm: (
          title: string,
          message: string,
          variant: string,
          onConfirm: () => void
        ) => ReactNode
      ) => ReactNode;
    }) => {
      const MockWrapper = () => {
        const [isOpen, setIsOpen] = useState(false);
        const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

        const showConfirm = (
          _title: string,
          _message: string,
          _variant: string,
          onConfirm: () => void
        ): ReactNode => {
          setConfirmCallback(() => onConfirm);
          setIsOpen(true);
          return null;
        };

        return (
          <>
            {children(showConfirm)}
            {isOpen && (
              <div className="confirm-dialog" data-testid="confirm-dialog">
                <button
                  data-testid="confirm-yes"
                  onClick={() => {
                    confirmCallback?.();
                    setIsOpen(false);
                  }}
                >
                  确定
                </button>
                <button data-testid="confirm-no" onClick={() => setIsOpen(false)}>
                  取消
                </button>
              </div>
            )}
          </>
        );
      };
      return <MockWrapper />;
    },
  };
};

export const createConfirmDialogWrapperMockWithCustomConfirmText = (confirmText: string) => {
  return {
    ConfirmDialogWrapper: ({
      children,
    }: {
      children: (
        showConfirm: (
          title: string,
          message: string,
          variant: string,
          onConfirm: () => void
        ) => ReactNode
      ) => ReactNode;
    }) => {
      const MockWrapper = () => {
        const [isOpen, setIsOpen] = useState(false);
        const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

        const showConfirm = (
          _title: string,
          _message: string,
          _variant: string,
          onConfirm: () => void
        ): ReactNode => {
          setConfirmCallback(() => onConfirm);
          setIsOpen(true);
          return null;
        };

        return (
          <>
            {children(showConfirm)}
            {isOpen && (
              <div className="confirm-dialog">
                <p>{confirmText}</p>
                <button
                  onClick={() => {
                    confirmCallback?.();
                    setIsOpen(false);
                  }}
                >
                  确定
                </button>
                <button onClick={() => setIsOpen(false)}>取消</button>
              </div>
            )}
          </>
        );
      };
      return <MockWrapper />;
    },
  };
};

export const createUseStorageMock = () => {
  const mockSetValue = vi.fn();
  let mockStorage: Record<string, unknown> = {};

  const useStorageMock = vi.fn((key: string, defaultValue: unknown) => {
    if (!(key in mockStorage)) {
      mockStorage[key] = defaultValue;
    }
    return [
      mockStorage[key],
      (newValue: unknown) => {
        if (typeof newValue === "function") {
          mockStorage[key] = (newValue as (prev: unknown) => unknown)(mockStorage[key]);
        } else {
          mockStorage[key] = newValue;
        }
        mockSetValue(newValue);
      },
    ];
  });

  const resetStorage = () => {
    mockStorage = {};
    mockSetValue.mockClear();
  };

  const setStorageValue = (key: string, value: unknown) => {
    mockStorage[key] = value;
  };

  return {
    useStorageMock,
    mockSetValue,
    resetStorage,
    setStorageValue,
  };
};
