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
        const text = translations[key] || key;
        if (!params) return text;
        return text.replaceAll(/\{(\w+)\}/g, (_, token: string) => {
          const value = params[token];
          return value != null ? String(value) : `{${token}}`;
        });
      },
    }),
  };
};
