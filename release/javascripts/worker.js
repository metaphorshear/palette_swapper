importScripts("https://d3js.org/d3-color.v1.min.js");
importScripts("https://underscorejs.org/underscore-min.js");
importScripts("deltae.global.min.js");
importScripts("color-processor.js"); // Import shared logic

var nearestmemo = {};
var labmemo = {};

self.onmessage = function (e) {
  let [imageData, palette, width, dithering] = e.data;
  let data = new Uint8ClampedArray(imageData);

  let t0 = performance.now();

  // Use shared processing function
  let result = processImageData(
    data,
    palette,
    width,
    dithering,
    nearestmemo,
    labmemo
  );

  let t1 = performance.now();
  console.log(`Worker processed image in ${t1 - t0} ms`);

  // Send back processed data and updated cache
  self.postMessage([result.data, result.nearestmemo]);

  // Update worker's cache for next run
  nearestmemo = result.nearestmemo;
};
