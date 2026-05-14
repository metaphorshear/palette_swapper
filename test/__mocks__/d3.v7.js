export const rgb = (r, g, b) => ({ r, g, b });

export const lab = (color) => {
  // Simple RGB to LAB conversion for testing
  // White (255, 255, 255) should have L=100
  if (color.r === 255 && color.g === 255 && color.b === 255) {
    return { l: 100, a: 0, b: 0, opacity: 1 };
  }
  // Basic approximation for other colors
  const r = color.r / 255;
  const g = color.g / 255;
  const bl = color.b / 255;
  const l = (r * 0.2126 + g * 0.7152 + bl * 0.0722) * 100;
  return { l, a: 0, b: 0, opacity: 1 };
};

export default { rgb, lab };
