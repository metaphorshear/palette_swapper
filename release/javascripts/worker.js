//importScripts('https://d3js.org/d3-color.v1.min.js', 'https://underscorejs.org/underscore-min.js');

//still trying to figure out how to replace code with a module

//import("./shared.mjs");
var nearestmemo = {};
var labmemo = {};

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

function findNearestColor(pixel, palette, formula=DeltaE.getDeltaE00) {
    //pixel: an array with three components
    //palette: an array of objects
    //this assumes the anypalette format, where each object contains properties for r, g, and b
    //and also a toString method which returns a CSS Color Module Level 3 specifier string
    //e.g., "rgb(255, 255, 255)"
    let key = pixel[0] << 16 | pixel[1] << 8 | pixel[2];
    if (nearestmemo[key]) {
        return nearestmemo[key];
    }
    let deltaEs = palette.map(function (color) {
        //color is the object
        let swatch = color.d3color;
        let labSwatch = color.lab;
        let labPixel = d3lab(pixel[0], pixel[1], pixel[2]);
        let obj = {
            color: swatch,
            deltaE: formula(
                { L: labSwatch.l, A: labSwatch.a, B: labSwatch.b }, { L: labPixel.l, A: labPixel.a, B: labPixel.b })
        };
        return obj;
    });
    let result = _.min(deltaEs, _.iteratee('deltaE'));
    nearestmemo[key] = result;
    return result;
}


function ditherHelper(img, startIdx, multiplier, error){
    //img: Uint8ClampedArray with imageData
    //startIdx: int, index of a red component in an image
    //multiplier: float
    //error: { r: int, g: int, b: int }
    if (startIdx < img.length){
        img[startIdx] += (error.r * multiplier);
        img[startIdx+1] += (error.g * multiplier);
        img[startIdx+2] += (error.b * multiplier);
    }
}

onmessage = function (e) {
    let data = new Uint8ClampedArray(e.data[0]);
    data.set(e.data[0]);
    let width = e.data[2];
    let dithering = e.data[3];
    for (let i = 0; i < data.length; i += 4) {
        let color = findNearestColor([data[i], data[i + 1], data[i + 2]], e.data[1]).color;
        //store the error so we can dither
        let pixerror = {};
        pixerror.r = data[i] - color.r;
        pixerror.g = data[i + 1] - color.g;
        pixerror.b = data[i + 2] - color.b;

        //this is just setting the pixel to whatever color
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        

        if (dithering){
            //need to adjust the pixel to the right of this one, and the three pixels below it
            //(* is pixel to change, . is this pixel)
            //  . *
            //* * *

            //check if this pixel is really on the right
            if ( Math.floor((i+4)/width) == Math.floor(i/width ) ){
                ditherHelper(data, i+4, 7/16, pixerror);
            }

            let below = i + width;
            ditherHelper(data, below, 5/16, pixerror);

            if ( Math.floor(below/width) == Math.floor((below-4)/width) ){
                ditherHelper(data, below-4, 3/16, pixerror);
            }
            
            if ( Math.floor(below/width) == Math.floor((below+4)/width) ){
                ditherHelper(data, below+4, 1/16, pixerror);
            }
        }
    }
    postMessage([data, nearestmemo]);
}
