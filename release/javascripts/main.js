//globals

var currentPalette;
var skipFirstColor = true; //skip the first color in a palette, assuming it is a transparent color
var labmemo = {};
//the following line is uncommented in the server-side version
//var worker = new Worker('worker.js');
var loading;
console.log(worker);
//var deltae00memo = {}; //might add a selector so that users can try the other delta E formulas
var nearestmemo = {};
var dithering = false;

//this is a hack to let Web Workers run without needing a webserver
//https://gist.github.com/walfie/a80c4432bcff70fb826d5d28158e9cc4
function createWebWorkerFromFunction(f) {
  var blobContents = ['(', f.toString(), ')();'];
  var blob = new Blob(blobContents, { type: 'application/javascript'});
  var blobUrl = URL.createObjectURL(blob);
  var worker = new Worker(blobUrl);
  URL.revokeObjectURL(blobUrl);
  return worker;
}

function buildPath(file) {
  var parts = document.location.href.split('/');
  parts[parts.length - 1] = file;
  return parts.join('/');
}

var worker = createWebWorkerFromFunction(function() {
  self.onmessage = function(e) {
    importScripts(...e.data.scriptUrls);
    importScripts('https://d3js.org/d3-color.v1.min.js', 'https://underscorejs.org/underscore-min.js');
  }
});

var workerUrl = buildPath('javascripts/worker.js');
var includeUrl = buildPath('javascripts/deltae.global.min.js');

worker.postMessage({ scriptUrls: [workerUrl, includeUrl] });
//end client-side Web Worker hack


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
        //scale the images so they don't go off the screen
        let width = this.width;
        let height = this.height;
        if (this.height > window.screen.availHeight) {
            height = window.screen.availHeight - (window.screen.availHeight*0.2);
            ratio = height / this.height;
            width = ratio * this.width;
        }
        else if (this.width > (window.screen.availWidth / 2)) {
            width = Math.floor(window.screen.availWidth / 2) - (window.screen.availWidth * 0.1);
            ratio = width / this.width;
            height = ratio * this.height;
        }
        canvas.width = width;
        canvas.height = height;
        canvasB.width = width;
        canvasB.height = height;
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
    //this removes black, which is often included at the beginning of palettes for some reason
    if (skipFirstColor) {
        currentPalette = _.rest(currentPalette);
    }
    //pre-calculate the Lab color for each (rgb) color in the palette
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
    //this is pretty similar to drawImageFromFile, but with palettes
    let file = document.getElementById("uploadPalette").files[0];
    //only the file extension is checked; i.e., it might be a valid file but need renaming
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
                //this would mean that AnyPalette didn't catch an error, but also didn't return a palette
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

function ditherHelper(img, startIdx, multiplier, error){
    //img: Uint8ClampedArray with imageData
    //startIdx: int, index of a red component in an image
    //multiplier: float
    //error: { r: int, g: int, b: int }
    if (startIdx < img.length){
        img[startIdx] += error.r * multiplier;
        img[startIdx+1] += error.g * multiplier;
        img[startIdx+2] += error.b * multiplier;
    }
}

function swapColors() {
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

        //I was experimenting with a loader image, but it hasn't worked out so far
        //document.getElementsByClassName('loader')[0].setAttribute("style", `display: block; position: absolute; left: 70%; top: 60%`)
    }
    else {
        //it sucks if we get down here.  bigger image/palette combinations will take a while, and the browser will complain.
        //this is mostly the same code as in the worker.  I could not figure out a solution besides copying it.
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
    nearestmemo = e.data[1];
    //document.getElementsByClassName('loader')[0].setAttribute("style", "display: none");
    console.log("message received from worker");
}

//not sure yet if these are the functions I want bound to these listeners.  but I guess that can wait.
window.onload = function () {
    document.getElementById("uploadImage").addEventListener("change", drawImageFromFile, false);
    document.getElementById("uploadPalette").addEventListener("change", loadPaletteFromFile, false);
    document.getElementsByTagName("button")[0].addEventListener("click", swapColors, false);
}
