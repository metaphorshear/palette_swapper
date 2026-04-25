var labmemo = {};
var nearestmemo = {};
var nearestmemoa = nearestmemo;
var currentPalette;
var skipFirstColor = true; //skip the first color in a palette, assuming it is a transparent color

var loading;
var dithering = false;

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

function buildPath(file) {
  var parts = document.location.href.split('/');
  parts[parts.length - 1] = file;
  return parts.join('/');
}

//this function runs inside the worker blob; it references findNearestColor, ditherHelper,
//and nearestmemo which are injected into the blob scope via .toString() serialization below
function workerImageProcess(e) {
    if (e.data.scriptUrls) {
        importScripts(...e.data.scriptUrls);
        return;
    }
    var data = new Uint8ClampedArray(e.data[0]);
    data.set(e.data[0]);
    var width = e.data[2];
    var dithering = e.data[3];
    for (var i = 0; i < data.length; i += 4) {
        var color = findNearestColor([data[i], data[i+1], data[i+2]], e.data[1]).color;
        var pixerror = {r: data[i]-color.r, g: data[i+1]-color.g, b: data[i+2]-color.b};
        data[i] = color.r;
        data[i+1] = color.g;
        data[i+2] = color.b;
        if (dithering) {
            if (Math.floor((i+4)/width) == Math.floor(i/width))
                ditherHelper(data, i+4, 7/16, pixerror);
            var below = i + width;
            ditherHelper(data, below, 5/16, pixerror);
            if (Math.floor(below/width) == Math.floor((below-4)/width))
                ditherHelper(data, below-4, 3/16, pixerror);
            if (Math.floor(below/width) == Math.floor((below+4)/width))
                ditherHelper(data, below+4, 1/16, pixerror);
        }
    }
    postMessage([data, nearestmemo]);
}

//this is a hack to let Web Workers run without needing a webserver
//https://gist.github.com/walfie/a80c4432bcff70fb826d5d28158e9cc4
//shared functions are serialized via .toString() so worker.js is no longer needed
var worker = (function() {
    var blobSrc = [
        '(function(){',
        'var labmemo={};',
        'var nearestmemo={};',
        d3lab.toString() + ';',
        findNearestColor.toString() + ';',
        ditherHelper.toString() + ';',
        'onmessage=' + workerImageProcess.toString() + ';',
        '})();'
    ].join('\n');
    var blob = new Blob([blobSrc], {type: 'application/javascript'});
    var blobUrl = URL.createObjectURL(blob);
    var w = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);
    return w;
})();

var includeUrl = buildPath('javascripts/deltae.global.min.js');
var d3colorUrl = buildPath('javascripts/d3-color.js');
var underscoreUrl = buildPath('javascripts/underscore-min.js');

worker.postMessage({ scriptUrls: [includeUrl, d3colorUrl, underscoreUrl] });
//end client-side Web Worker hack

function scaleImage(img) {
    let width = img.width;
    let height = img.height;
    let ratio;
    if (img.height > window.screen.availHeight) {
        height = window.screen.availHeight - (window.screen.availHeight*0.2);
        ratio = height / img.height;
        width = ratio * img.width;
    }
    else if (img.width > (window.screen.availWidth / 2)) {
        width = Math.floor(window.screen.availWidth / 2) - (window.screen.availWidth * 0.1);
        ratio = width / img.width;
        height = ratio * img.height;
    }
    return [width, height]
}

function drawImageFromFile() {
    //this is the original image
    let canvas = document.getElementById('image_before');
    //the modified image appears here
    let canvasB = document.getElementById('image_after');
    //normal Canvas setup
    let ctx = canvas.getContext('2d');
    let img = new Image();
    //this is the file, chosen by the user in the file selector
    let curFile = document.getElementById("uploadImage").files[0];
    let url = window.URL || window.webkitURL;
    let src = url.createObjectURL(curFile);
    img.src = src;
    img.onload = function () {
        let width;
        let height;
        [width, height] = scaleImage(img);
        [canvas.width, canvas.height, canvasB.width, canvasB.height] =
        [width, height, width, height]
        //draw
        ctx.drawImage(img, 0, 0, width, height);
        url.revokeObjectURL(src);
        canvasB.getContext('2d').drawImage(canvas, 0, 0); //this copies the image to the right before processing happens.  it's not necessary, but I kind of like it.
    }
}

function drawPalette() {
    //this should be called by paletteSetup
    //this sets up the canvas that displays the color swatches
    let canvas = document.getElementById('palette_display');
    let ctx = canvas.getContext('2d');
    let width = window.screen.availWidth * 0.75;
    canvas.width = width;
    //if the palette is small enough, it can be displayed with nice big squares
    let swatchSize = Math.ceil(width / currentPalette.length);
    let rows = 1;
    //20px is about the smallest I want one of the color-swatch squares to be
    if (swatchSize < 20) {
        swatchSize = 20;
        rows = (swatchSize * currentPalette.length) / width;
    }
    canvas.height = Math.ceil(rows) * swatchSize;
    //the actual drawing step
    _.each(currentPalette, function (swatch, index) {
        ctx.fillStyle = swatch.toString();
        ctx.fillRect((index * swatchSize) % width, Math.floor((index * swatchSize) / width)*swatchSize, swatchSize, swatchSize);
    })

}

function paletteSetup() {
    currentPalette = AnyPalette.uniqueColors(currentPalette);
    //this removes black, which is often included at the beginning of palettes for some reason
    if (skipFirstColor) {
        currentPalette = _.rest(currentPalette);
    }
    //pre-calculate the Lab color for each (rgb) color in the palette
    for (var i = 0; i < currentPalette.length; ++i) {
        let colorString = currentPalette[i].toString();
        //this is added to fix long floating point stuff,
        //like "rgb(169.00000512599945, 59.00000028312206, 59.00000028312206)"
        const re = /\.[0-9]+/g;
        colorString = colorString.replaceAll(re, "")
        let swatch = d3.color(colorString);
        currentPalette[i].d3color = swatch;
        currentPalette[i].lab = d3.lab(swatch);
    }
    //empty the nearestmemo cache; it assumes the current palette
    nearestmemoa = {};
    nearestmemo = {};
    drawPalette();
}

function loadPaletteFromFile(file) {
    //only the file extension is checked; i.e., it might be a valid file but need renaming
    const supportedByAnypalette = ['pal', 'gpl', 'aco', 'ase',
         'txt','psppalette', 'hpl', 'cs', 'wpe', 'sketchpalette',
         'spl', 'soc', 'colors', 'theme', 'themepack',
         'css', 'scss', 'styl',
         'html', 'svg', 'js'
    ]; //I worry about supporting some of these.
    if (supportedByAnypalette.includes(_.last(file.name.split('.')))) {
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

const loadPalette = () => {
    loadPaletteFromFile(document.getElementById("uploadPalette").files[0]);
}

function swapColors() {
    document.getElementById("loading").style.display = "block";
    let canvasA = document.getElementById('image_before');
    let canvasB = document.getElementById('image_after');
	//we're always reading from the "before" image and writing to the "after" image
    let ctx = canvasA.getContext('2d');

    //ctx.drawImage(canvasA, 0, 0);  //not necessary, but a matter of taste.  displays the original image on both sides before processing is done
    let imageData = ctx.getImageData(0, 0, canvasA.width, canvasA.height);

    if (window.Worker) {
        //this is running in its own thread and won't hang the page (yay!)
        worker.postMessage([imageData.data, currentPalette, canvasA.width, dithering]);
        console.log("message posted to worker");
    }
    else {
        //it sucks if we get down here.  bigger image/palette combinations will take a while, and the browser will complain.
        let data = new Uint8ClampedArray(imageData.data);
        data.set(imageData.data); //real talk: I forget what this line does exactly.  it might be redundant.
        let t0 = performance.now();
        for (let i = 0; i < data.length; i += 4) {
            let color = findNearestColor([data[i], data[i + 1], data[i + 2]], currentPalette).color;
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
                //make sure this pixel is really on the right
                if ( Math.floor((i+4)/canvasA.width) == Math.floor(i/canvasA.width) ){
                    ditherHelper(data, i+4, 7/16, pixerror);
                }

                let below = i + canvasA.width;
                ditherHelper(data, below, 5/16, pixerror);

                if ( Math.floor(below/canvasA.width) == Math.floor((below-4)/canvasA.width) ){
                    ditherHelper(data, below-4, 3/16, pixerror);
                }

                if ( Math.floor(below/canvasA.width) == Math.floor((below+4)/canvasA.width) ){
                    ditherHelper(data, below+4, 1/16, pixerror);
                }
            }
        }
        document.getElementById("loading").style.display = "none";
        let t1 = performance.now();
        console.log(`Time to swap colors of whole image: ${t1 - t0} ms`); //probably a lot
        ctx = canvasB.getContext('2d');
        let imageDataB = ctx.getImageData(0, 0, canvasB.width, canvasB.height);
        imageDataB.data.set(data);
        ctx.putImageData(imageDataB, 0, 0);
    }
}

worker.onmessage = function (e) {
    let canvasB = document.getElementById('image_after');
    let ctx = canvasB.getContext('2d');
    let imageData = ctx.getImageData(0, 0, canvasB.width, canvasB.height);
    imageData.data.set(e.data[0]);
    ctx.putImageData(imageData, 0, 0);
     //since the Web Worker doesn't have access to nearestmemo, its copied back and forth between the threads
    nearestmemoa = e.data[1];
    console.log("message received from worker");
    document.getElementById("loading").style.display = "none";
}

window.onload = function () {
    document.getElementById("uploadImage").addEventListener("change", drawImageFromFile, false);
    document.getElementById("uploadPalette").addEventListener("change", loadPalette, false);
    document.getElementsByTagName("button")[0].addEventListener("click", swapColors, false);
}
