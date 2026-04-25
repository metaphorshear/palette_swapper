import * as d3 from "./d3.v7.js";

//conditionally load libraries, since they're needed for testing but break the browser app
var DeltaE;
var _;
var AnyPalette;
if (typeof process !== 'undefined' && process.env.NODE_ENV !== undefined){
    var tmp;
    tmp = await import("./deltae.global.min.js");
    DeltaE = tmp.default;
    tmp = await import("./underscore-min.js");
    _ = tmp.default;
    tmp = await import("./anypalette.js");
    AnyPalette = tmp.default;
}

var labmemo = {};
export var nearestmemo = {};

function d3lab(r, g, b) {
    //r,g,b are integers from 0 to 255, as from ImageData
    let color = r << 16 | g << 8 | b;
    if (labmemo[color]) {
        return labmemo[color];
    }
    else {
        labmemo[color] = d3.lab(d3.rgb(r, g, b));
        return labmemo[color];
    }
}

function findNearestColor(pixel, palette) {
    //pixel: an array with three components (representing the colors of a pixel)
    //palette: an array of objects
    //this assumes the anypalette format, where each object contains properties for r, g, and b
    //and also a toString method which returns a CSS Color Module Level 3 specifier string
    //e.g., "rgb(255, 255, 255)"

    let key = pixel[0] << 16 | pixel[1] << 8 | pixel[2];
    //this function is memoized, and its results are cached in nearestmemo
    if (nearestmemo[key]) {
        return nearestmemo[key];
    }
    let deltaEs = palette.map(function (color) {
        //color is a palette swatch object
        let swatch = color.d3color;
        let labSwatch = color.lab;
        let labPixel = d3lab(pixel[0], pixel[1], pixel[2]);
        let obj = {
            color: swatch,
            //this is the part of the code that takes the longest
            //it finds the distance between the color of this pixel and the color of the current palette swatch
            deltaE: DeltaE.getDeltaE00(
                { L: labSwatch.l, A: labSwatch.a, B: labSwatch.b }, { L: labPixel.l, A: labPixel.a, B: labPixel.b })
        };
        return obj;
    });
    //this part actually finds the nearest color, by finding the minimum distance
    let result = _.min(deltaEs, _.iteratee('deltaE'));
    nearestmemo[key] = result;
    return result;
}

function ditherHelper(img, startIdx, multiplier, error) {
    //img: Uint8ClampedArray with imageData
    //startIdx: int, index of a red component in an image
    //multiplier: float
    //error: { r: int, g: int, b: int }
    if (startIdx < img.length) {
        img[startIdx] += error.r * multiplier;
        img[startIdx+1] += error.g * multiplier;
        img[startIdx+2] += error.b * multiplier;
    }
}

function loadPaletteFromFile(file, onLoad) {
    //only the file extension is checked; i.e., it might be a valid file but need renaming
    const supportedByAnypalette = ['pal', 'gpl', 'aco', 'ase',
         'txt','psppalette', 'hpl', 'cs', 'wpe', 'sketchpalette',
         'spl', 'soc', 'colors', 'theme', 'themepack',
         'css', 'scss', 'styl',
         'html', 'svg', 'js'
    ]; //I worry about supporting some of these.
    if (supportedByAnypalette.includes(_.last(file.name.split('.')))) {
        AnyPalette.loadPalette(file, onLoad);
    }
    else {
        onLoad(new Error("The palette format is unsupported."), null);
    }
}

export {d3lab, findNearestColor, ditherHelper, loadPaletteFromFile};
