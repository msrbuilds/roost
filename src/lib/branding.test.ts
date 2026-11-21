import { describe, expect, it } from 'vitest';
import { createPrimaryPalette } from './branding';

describe('brand color channels for Tailwind opacity utilities', () => {
  it.each(['#0ea5e9', '#ed2345', '#00ff00', '#000000', '#ffffff'])('preserves the exact brand color %s and generates valid shade channels', hex => {
    const palette = createPrimaryPalette(hex)!;
    expect(palette['500'].color).toBe(hex);
    expect(palette['500'].rgb).toBe([1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(' '));
    expect(Object.keys(palette)).toHaveLength(11);
    for (const { rgb } of Object.values(palette)) {
      expect(rgb).toMatch(/^\d+ \d+ \d+$/);
      expect(rgb.split(' ').every(channel => Number(channel) >= 0 && Number(channel) <= 255)).toBe(true);
    }
  });

  it('leaves the current theme unchanged for invalid saved colors', () => {
    expect(createPrimaryPalette('not-a-color')).toBeNull();
    expect(createPrimaryPalette('#fff')).toBeNull();
  });
});
