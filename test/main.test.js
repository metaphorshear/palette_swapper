import {d3lab, findNearestColor} from '../release/javascripts/shared.mjs';

test('white in lab', ()=> {
    expect(d3lab(255, 255, 255).l).toBe(100)
});


//need to finish setting up this test; it needs slightly different parameters
test('nearest color equals self if in palette', ()=> {
    expect(findNearestColor([255, 255, 255],
 [{"r": "255", "g": "255", "b": "255", "name": "white"},])).toBe(
    {
        "r": "255",
        "g": "255",
        "b": "255",
        "opacity": 1
    })
});