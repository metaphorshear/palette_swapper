/**
 * Shared color processing logic used by both main thread and worker
 */

function ditherHelper(img, startIdx, multiplier, error) {
  if (startIdx < img.length) {
    img[startIdx] += error.r * multiplier;
    img[startIdx + 1] += error.g * multiplier;
    img[startIdx + 2] += error.b * multiplier;
  }
}

function d3lab(r, g, b, labmemo) {
  let color = (r << 16) | (g << 8) | b;
  if (labmemo[color]) {
    return labmemo[color];
  } else {
    labmemo[color] = d3.lab(d3.rgb(r, g, b));
    return labmemo[color];
  }
}

function findNearestColor(pixel, palette, nearestmemo, labmemo) {
  let key = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
  if (nearestmemo[key]) {
    return nearestmemo[key];
  }

  let deltaEs = palette.map(function (color) {
    let swatch = color.d3color;
    let labSwatch = color.lab;
    let labPixel = d3lab(pixel[0], pixel[1], pixel[2], labmemo);
    let obj = {
      color: swatch,
      deltaE: DeltaE.getDeltaE00(
        { L: labSwatch.l, A: labSwatch.a, B: labSwatch.b },
        { L: labPixel.l, A: labPixel.a, B: labPixel.b }
      ),
    };
    return obj;
  });

  let result = _.min(deltaEs, _.iteratee("deltaE"));
  nearestmemo[key] = result;
  return result;
}

/**
 * Core processing function used by both main thread and worker
 * @param {Uint8ClampedArray} data - Image pixel data
 * @param {Array} palette - Color palette
 * @param {number} width - Image width in pixels (for dithering)
 * @param {boolean} dithering - Whether to apply Floyd-Steinberg dithering
 * @param {Object} nearestmemo - Memoization cache for nearest colors
 * @param {Object} labmemo - Memoization cache for Lab conversions
 * @returns {Object} { data, nearestmemo } - Processed data and updated cache
 */
function processImageData(
  data,
  palette,
  width,
  dithering,
  nearestmemo,
  labmemo
) {
  nearestmemo = nearestmemo || {};
  labmemo = labmemo || {};

  let widthBytes = width * 4; // 4 bytes per pixel (RGBA)

  for (let i = 0; i < data.length; i += 4) {
    let color = findNearestColor(
      [data[i], data[i + 1], data[i + 2]],
      palette,
      nearestmemo,
      labmemo
    ).color;

    // Store quantization error for dithering
    let pixerror = {
      r: data[i] - color.r,
      g: data[i + 1] - color.g,
      b: data[i + 2] - color.b,
    };

    // Set pixel to palette color
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;

    if (dithering) {
      // Floyd-Steinberg dithering
      // Distribute error to neighboring pixels:
      //   * 7/16
      // 3/16 5/16 1/16

      let currentRow = Math.floor(i / widthBytes);

      // Right pixel (7/16)
      if (Math.floor((i + 4) / widthBytes) === currentRow) {
        ditherHelper(data, i + 4, 7 / 16, pixerror);
      }

      // Below pixels
      let below = i + widthBytes;
      let belowRow = Math.floor(below / widthBytes);

      ditherHelper(data, below, 5 / 16, pixerror); // Below (5/16)

      if (Math.floor((below - 4) / widthBytes) === belowRow) {
        ditherHelper(data, below - 4, 3 / 16, pixerror); // Below-left (3/16)
      }

      if (Math.floor((below + 4) / widthBytes) === belowRow) {
        ditherHelper(data, below + 4, 1 / 16, pixerror); // Below-right (1/16)
      }
    }
  }

  return { data, nearestmemo };
}

// Export for both environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = { processImageData, ditherHelper, d3lab, findNearestColor };
}
