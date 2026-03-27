const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: Number.parseInt(result[1], 16),
      g: Number.parseInt(result[2], 16),
      b: Number.parseInt(result[3], 16),
    };
  }
  return null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

const getLuminance = (r: number, g: number, b: number): number => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const adjustColorBrightness = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
};

export const getHoverColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  const amount = luminance > 0.5 ? -20 : 20;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
};

export const getActiveColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  const amount = luminance > 0.5 ? -40 : 40;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
};

export const getLineSoftColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  const amount = luminance > 0.7 ? 60 : luminance > 0.5 ? 45 : luminance > 0.3 ? -45 : -60;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
};

export const getLineStrongColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  const amount = luminance > 0.7 ? 35 : luminance > 0.5 ? 25 : luminance > 0.3 ? -25 : -35;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
};

export const getLighterColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  if (luminance < 0.2) {
    return rgbToHex(
      clamp(lerp(rgb.r, 255, 0.35)),
      clamp(lerp(rgb.g, 255, 0.35)),
      clamp(lerp(rgb.b, 255, 0.35))
    );
  } else if (luminance < 0.5) {
    return rgbToHex(
      clamp(lerp(rgb.r, 255, 0.25)),
      clamp(lerp(rgb.g, 255, 0.25)),
      clamp(lerp(rgb.b, 255, 0.25))
    );
  } else if (luminance < 0.8) {
    return rgbToHex(
      clamp(lerp(rgb.r, 255, 0.2)),
      clamp(lerp(rgb.g, 255, 0.2)),
      clamp(lerp(rgb.b, 255, 0.2))
    );
  } else {
    return rgbToHex(
      clamp(lerp(rgb.r, 0, 0.15)),
      clamp(lerp(rgb.g, 0, 0.15)),
      clamp(lerp(rgb.b, 0, 0.15))
    );
  }
};

export const getContrastColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5 ? "#1a202c" : "#ffffff";
};

export const getMutedTextColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  if (luminance < 0.2) {
    return rgbToHex(
      clamp(lerp(rgb.r, 255, 0.5)),
      clamp(lerp(rgb.g, 255, 0.5)),
      clamp(lerp(rgb.b, 255, 0.5))
    );
  } else if (luminance < 0.5) {
    return rgbToHex(
      clamp(lerp(rgb.r, 255, 0.4)),
      clamp(lerp(rgb.g, 255, 0.4)),
      clamp(lerp(rgb.b, 255, 0.4))
    );
  } else if (luminance < 0.8) {
    return rgbToHex(
      clamp(lerp(rgb.r, 0, 0.45)),
      clamp(lerp(rgb.g, 0, 0.45)),
      clamp(lerp(rgb.b, 0, 0.45))
    );
  } else {
    return rgbToHex(
      clamp(lerp(rgb.r, 0, 0.55)),
      clamp(lerp(rgb.g, 0, 0.55)),
      clamp(lerp(rgb.b, 0, 0.55))
    );
  }
};
