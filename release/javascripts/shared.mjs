import * as d3 from "./d3.v7.js";
import * as DeltaE from "./deltae.global.min.js"

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

export {d3lab, findNearestColor};