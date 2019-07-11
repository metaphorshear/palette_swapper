//importScripts(filename, 'https://d3js.org/d3-color.v1.min.js', 'https://underscorejs.org/underscore-min.js');

//so, I was having trouble loading main.js, and, well
//I guess I *could* put the functions I need in a module and just include it in both scripts
//maybe later

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


function findNearestColor(pixel, palette) {
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
            deltaE: DeltaE.getDeltaE00(
                { L: labSwatch.l, A: labSwatch.a, B: labSwatch.b }, { L: labPixel.l, A: labPixel.a, B: labPixel.b })
        };
        return obj;
    });
    let result = _.min(deltaEs, _.iteratee('deltaE'));
    nearestmemo[key] = result;
    return result;
}

onmessage = function (e) {
    let data = new Uint8ClampedArray(e.data[0]);
    data.set(e.data[0]);
    for (let i = 0; i < data.length; i += 4) {
        let color = findNearestColor([data[i], data[i + 1], data[i + 2]], e.data[1]).color;
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
    }
    postMessage([data, nearestmemo]);
}
