/**
 * Color conversion utilities
 */

export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse hex values
  let r: number, g: number, b: number, a: number = 1.0;

  if (hex.length === 3) {
    // Short hex format: #RGB
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else if (hex.length === 6) {
    // Full hex format: #RRGGBB
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  } else if (hex.length === 8) {
    // Hex with alpha: #RRGGBBAA
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
    a = parseInt(hex.substring(6, 8), 16) / 255;
  } else {
    throw new Error('Invalid hex color format');
  }

  return { r, g, b, a };
}

export function colorStringToRgba(color: string): { r: number; g: number; b: number; a: number } {
  if (color.startsWith('#')) {
    return hexToRgba(color);
  }

  // Handle named colors
  const namedColors: Record<string, { r: number; g: number; b: number; a: number }> = {
    'black': { r: 0, g: 0, b: 0, a: 1 },
    'white': { r: 1, g: 1, b: 1, a: 1 },
    'red': { r: 1, g: 0, b: 0, a: 1 },
    'green': { r: 0, g: 1, b: 0, a: 1 },
    'blue': { r: 0, g: 0, b: 1, a: 1 },
    'transparent': { r: 0, g: 0, b: 0, a: 0 },
  };

  if (namedColors[color.toLowerCase()]) {
    return namedColors[color.toLowerCase()];
  }

  // Parse RGB/RGBA format
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  throw new Error(`Unsupported color format: ${color}`);
}

export function rgbaToFloat32Array(color: { r: number; g: number; b: number; a: number }): Float32Array {
  return new Float32Array([color.r, color.g, color.b, color.a]);
}
