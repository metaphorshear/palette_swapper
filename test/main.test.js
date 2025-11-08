import {d3lab} from '../release/javascripts/shared.mjs';

test('white in lab', ()=> {
    expect(d3lab(255, 255, 255).l).toBe(100)
});
