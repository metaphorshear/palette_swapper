/**
 * @jest-environment jsdom
 */

import {d3lab, findNearestColor, loadPaletteFromFile} from '../release/javascripts/shared.mjs';
import 'cross-fetch/polyfill';

test('white in lab', ()=> {
    expect(d3lab(255, 255, 255).l).toBe(100)
});


//need to finish setting up this test; it needs slightly different parameters
test('nearest color equals self if in palette', ()=> {
    expect(findNearestColor([255, 255, 255],
 [{"r": "255",
   "g": "255",
   "b": "255", 
   "name": "white",
   "d3color": {
        "r": "255",
        "g": "255",
        "b": "255",
        "opacity": 1
    },
    "lab": {
        "l": 100,
        "a": 0,
        "b": 0,
        "opacity": 1
    }

 },]
)
).toMatchObject(
    {"color": {
        "r": "255",
        "g": "255",
        "b": "255",
        "opacity": 1
    },
    "deltaE": 0
    })
});
//https://openjavascript.info/2022/10/18/image-url-to-blob-in-javascript/
async function URLtoFile(url) {

  const res = await fetch(url, {mode: 'no-cors'});
  const blob = await res.blob();
  // Gets URL data and read to blob


  const mime = blob.type;
  const ext = url.slice(url.lastIndexOf(".") + 1, url.length);
  // Gets blob MIME type (e.g. image/png) and extracts extension
      
  const file = new File([blob], `filename.${ext}`, {
      type: mime,
  })
  // Creates new File object using blob data, extension and MIME type

  return file;
}

test('palette loaded from file', async ()=> {
    const file = await URLtoFile('https://lospec.com/palette-list/hou3-rejected-wOhr.ase');
    const palette = await new Promise((resolve, reject) => {
        loadPaletteFromFile(file, (error, palette) => {
            if (error) reject(error);
            else resolve(palette);
        });
    });
    expect(palette).toBeTruthy();
});

/* tests to add:
1. test that palette is loaded
2. test that palette images are loaded
3. test that images are loaded
4. test that image on the right changes
5. test that image on the left doesn't change
6. test that new image can be loaded
7. test that new palette can be loaded
*/
