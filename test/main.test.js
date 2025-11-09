import {d3lab, findNearestColor} from '../release/javascripts/shared.mjs';

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

/* tests to add:
1. test that palette is loaded
2. test that palette images are loaded
3. test that images are loaded
4. test that image on the right changes
5. test that image on the left doesn't change
6. test that new image can be loaded
7. test that new palette can be loaded
*/