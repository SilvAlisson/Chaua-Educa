import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY } from '../Chaua-Educa-main/js/journey.mjs';
import { journeyRain } from '../Chaua-Educa-main/js/weather.mjs';

test('rain fades in and out within the ancient trees stretch', () => {
    const start = JOURNEY[1].start + 1500;
    const end = JOURNEY[2].start - 1000;
    const values = [start, start + 700, start + 1400, end - 1400, end - 700, end];
    assert.deepEqual(values.map(distance => journeyRain(distance)), [0, .5, 1, 1, .5, 0]);
    assert.equal(journeyRain(start + 1400, true), 0);
});
