//globals

var currentPalette;
var skipFirstColor = true; //skip the first color in a palette, assuming it is a transparent color
var labmemo = {};

//var deltae00memo = {}; //might add a selector so that users can try the other delta E formulas
var nearestmemo = {};

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

/*
function deltae00(rgb1, rgb2) {
    //accepts d3.rgb objects
    //apparently integers are faster than strings for this?
    //I couldn't quite figure out how to make a Lab value into a single integer w/o error
    //so here we are
    let args = rgb1.r << 40 | rgb1.g << 32 | rgb1.b << 24 | rgb2.r << 16 | rgb2.g << 8 | rgb2.b
    if (deltae00memo[args]) {
        return deltae00memo[args];
    }
    else {
        //as you might've guessed, this function originally took Lab colors
        let lab1 = d3lab(rgb1.r, rgb1.g, rgb1.b);
        let lab2 = d3lab(rgb2.r, rgb2.g, rgb2.b);
        deltae00memo[args] = DeltaE.getDeltaE00(
            { L: lab1.l, A: lab1.a, B: lab1.b }, { L: lab2.l, A: lab2.a, B: lab2.b });
        return deltae00memo[args];
    }
}
*/

function drawImageFromFile() {
    let canvas = document.getElementById('image_window');
    let ctx = canvas.getContext('2d');
    let img = new Image();
    let curFile = document.getElementById("uploadImage").files[0];
    let url = window.URL || window.webkitURL;
    let src = url.createObjectURL(curFile);
    img.src = src;
    img.onload = function () {
        canvas.width = this.width;
        canvas.height = this.height;
        ctx.drawImage(img, 0, 0);
        //url.revokeObjectURL(src);
    }
}

function paletteSetup() {
    if (skipFirstColor) {
        currentPalette = _.rest(currentPalette);
    }
    //calculating this here speeds up the findNearestColor function considerably
    for (var i = 0; i < currentPalette.length; ++i) {
        let swatch = d3.color(currentPalette[i].toString());
        currentPalette[i].d3color = swatch;
        currentPalette[i].lab = d3.lab(swatch);
    }
    //empty the nearestmemo cache; it assumes the current palette
    nearestmemo = {};
}

function loadPaletteFromFile() {
    let file = document.getElementById("uploadPalette").files[0];
    let supportedByAnypalette = ['pal', 'gpl', 'txt', 'psppalette', 'hpl', 'cs', 'wpe'];
    if (file.name.endsWith('ase')) {
        alert("No ASE support yet, sorry.");
    }
    else if (supportedByAnypalette.includes(_.last(file.name.split('.')))) {
        AnyPalette.loadPalette(file, function (error, palette) {
            if (palette) {
                currentPalette = palette;
                paletteSetup();
            }
            else if (error) {
                alert(error);
            }
            else {
                alert("Something has gone horribly wrong.");
            }
        });
    }
    else {
        alert("The palette format is unsupported.");
    }
}
/*
function findNearestColor(pixel, palette) {
    //pixel: an array with three components
    //palette: an array of objects
    //this assumes the anypalette format, where each object contains properties for r, g, and b
    //and also a toString method which returns a CSS Color Module Level 3 specifier string
    //e.g., "rgb(255, 255, 255)"

    let deltaEs = palette.map(function (color) {
        //color is the object
        let swatch = color.d3color;
        //let labSwatch = color.lab;
        //let labPixel = d3lab(pixel[0], pixel[1], pixel[2]);
        let obj = {
            color: swatch,
            //deltaE: DeltaE.getDeltaE00( //bottleneck 2
            //    { L: labSwatch.l, A: labSwatch.a, B: labSwatch.b }, { L: labPixel.l, A: labPixel.a, B: labPixel.b })
            deltaE: deltae00(swatch, d3.rgb(pixel[0], pixel[1], pixel[2]))
        };
        return obj;
    });
    let result = _.min(deltaEs, _.iteratee('deltaE'));
    return result;
}
*/
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

function swapColors() {
    let canvas = document.getElementById('image_window');
    let ctx = canvas.getContext('2d');
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = new Uint8ClampedArray(imageData.data);
    data.set(imageData.data);
    let t0 = performance.now();
    for (let i = 0; i < data.length; i += 4) {
        let color = findNearestColor([data[i], data[i + 1], data[i + 2]], currentPalette).color;
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        
    }
    let t1 = performance.now();
    console.log(`Time to swap colors of whole image: ${t1 - t0} ms`);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
}


//not sure yet if these are the functions I want bound to these listeners.  but I guess that can wait.
window.onload = function () {
    document.getElementById("uploadImage").addEventListener("change", drawImageFromFile, false);
    document.getElementById("uploadPalette").addEventListener("change", loadPaletteFromFile, false);
    document.getElementsByTagName("button")[0].addEventListener("click", swapColors, false);
}