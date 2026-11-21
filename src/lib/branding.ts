// Generate CSS color shades from a hex color
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function createPrimaryPalette(hex: string): Record<string, { color: string; rgb: string }> | null {
  if (!hex || !hex.match(/^#[0-9a-fA-F]{6}$/)) return null;

  const { h, s } = hexToHSL(hex);


  // Generate Tailwind-like shade scale from the primary color's hue
  const shades: Record<string, string> = {
    '50':  `hsl(${h}, ${Math.min(s + 10, 100)}%, 97%)`,
    '100': `hsl(${h}, ${Math.min(s + 5, 100)}%, 93%)`,
    '200': `hsl(${h}, ${s}%, 85%)`,
    '300': `hsl(${h}, ${s}%, 73%)`,
    '400': `hsl(${h}, ${s}%, 58%)`,
    '500': hex,
    '600': `hsl(${h}, ${s}%, 42%)`,
    '700': `hsl(${h}, ${s}%, 35%)`,
    '800': `hsl(${h}, ${s}%, 28%)`,
    '900': `hsl(${h}, ${s}%, 20%)`,
    '950': `hsl(${h}, ${s}%, 12%)`,
  };

  return Object.fromEntries(Object.entries(shades).map(([shade, color]) => {
    let channels: number[];
    if (color.startsWith('#')) {
      channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
    } else {
      const [hue, saturation, lightness] = color.match(/[\d.]+/g)!.map(Number);
      const l = lightness / 100;
      const a = saturation / 100 * Math.min(l, 1 - l);
      const channel = (n: number) => {
        const k = (n + hue / 30) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
      };
      channels = [channel(0), channel(8), channel(4)];
    }
    return [shade, { color, rgb: channels.join(' ') }];
  }));
}
