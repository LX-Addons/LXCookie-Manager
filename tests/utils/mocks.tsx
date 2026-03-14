export const hasDomainInText = (
  textContent: string | null | undefined,
  domain: string
): boolean => {
  if (!textContent) return false;
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const domainPattern = new RegExp(`\\b${escapedDomain}\\b`);
  return domainPattern.test(textContent);
};

export const createTranslationMock = (translations: Record<string, string>) => {
  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string | number>) => {
        let text = translations[key] || key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, String(v));
          });
        }
        return text;
      },
    }),
  };
};
