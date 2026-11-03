const test = require('node:test');
const assert = require('node:assert/strict');
const { routeThrough } = require('../lib/shared');

test('routeThrough totals every ordered itinerary leg', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    const leg = calls.length;
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: leg * 10_000, duration: leg * 600 }] }) };
  };
  try {
    const points = [
      { id: 'a', name: 'A', address: 'A', lat: 10.1111, lng: 77.1111, type: 'other' },
      { id: 'b', name: 'B', address: 'B', lat: 10.2222, lng: 77.2222, type: 'other' },
      { id: 'c', name: 'C', address: 'C', lat: 10.3333, lng: 77.3333, type: 'other' },
    ];
    const route = await routeThrough(points);
    assert.equal(calls.length, 2);
    assert.equal(route.distanceKm, 30);
    assert.equal(route.durationMin, 30);
    assert.equal(route.estimated, false);
  } finally {
    global.fetch = originalFetch;
  }
});
