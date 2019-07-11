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

function drawImageFromFile() {
    let canvas = document.getElementById('image_before');
    let canvasB = document.getElementById('image_after');
    let ctx = canvas.getContext('2d');
    let img = new Image();
    let curFile = document.getElementById("uploadImage").files[0];
    let url = window.URL || window.webkitURL;
    let src = url.createObjectURL(curFile);
    img.src = src;
    img.onload = function () {
        let width = this.width;
        let height = this.height;
        if (this.width > (window.screen.availWidth / 2)) {
            width = Math.floor(window.screen.availWidth / 2) - 50;
            ratio = width / this.width;
            height = ratio * this.height;
        }
        canvas.width = width;
        canvas.height = height;
        canvasB.width = width;
        canvasB.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        url.revokeObjectURL(src);
    }
}

function drawPalette() {
    //this should be called by paletteSetup
    let canvas = document.getElementById('palette_display');
    let ctx = canvas.getContext('2d');
    let width = window.screen.availWidth * 0.75;
    canvas.width = width;
    let swatchSize = Math.ceil(width / currentPalette.length);
    let rows = 1;
    if (swatchSize < 20) {
        swatchSize = 20;
        rows = (swatchSize * currentPalette.length) / width;
    }
    canvas.height = Math.ceil(rows) * swatchSize;
    _.each(currentPalette, function (swatch, index) {
        ctx.fillStyle = swatch.toString();
        ctx.fillRect((index * swatchSize) % width, Math.floor((index * swatchSize) / width)*swatchSize, swatchSize, swatchSize);
    })

}

function paletteSetup() {
    if (skipFirstColor) {
        currentPalette = _.rest(currentPalette);
    }
    for (var i = 0; i < currentPalette.length; ++i) {
        let swatch = d3.color(currentPalette[i].toString());
        currentPalette[i].d3color = swatch;
        currentPalette[i].lab = d3.lab(swatch);
    }
    //empty the nearestmemo cache; it assumes the current palette
    nearestmemo = {};
    drawPalette();
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
    let canvasA = document.getElementById('image_before');
    let canvasB = document.getElementById('image_after');
    let ctx = canvasB.getContext('2d');
    ctx.drawImage(canvasA, 0, 0);
    let imageData = ctx.getImageData(0, 0, canvasA.width, canvasA.height);
    let data = new Uint8ClampedArray(imageData.data);
    data.set(imageData.data);
    let t0 = performance.now();
    //the next step is to try putting this in another thread so it won't hang up the browser
    //also look into drawing the image a few times while it's working, so it will *seem* faster
    for (let i = 0; i < data.length; i += 4) {
        let color = findNearestColor([data[i], data[i + 1], data[i + 2]], currentPalette).color;
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        
    }
    let t1 = performance.now();
    console.log(`Time to swap colors of whole image: ${t1 - t0} ms`);
    
    ctx = canvasB.getContext('2d');
    let imageDataB = ctx.getImageData(0, 0, canvasB.width, canvasB.height);
    imageDataB.data.set(data);
    ctx.putImageData(imageDataB, 0, 0);
}


//not sure yet if these are the functions I want bound to these listeners.  but I guess that can wait.
window.onload = function () {
    document.getElementById("uploadImage").addEventListener("change", drawImageFromFile, false);
    document.getElementById("uploadPalette").addEventListener("change", loadPaletteFromFile, false);
    document.getElementsByTagName("button")[0].addEventListener("click", swapColors, false);
}