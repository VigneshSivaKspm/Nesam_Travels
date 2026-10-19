export interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** When the device took the reading (ms since epoch). The server refuses a position older than its limit, and one with no time. */
  capturedAt: number | null;
}

/** One position reading, or null when permission is denied or unavailable (the trip step still works, without a location). */
export function getFirebaseLocation(timeoutMs = 10000): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null, capturedAt: Number.isFinite(pos.timestamp) ? pos.timestamp : Date.now() }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}
