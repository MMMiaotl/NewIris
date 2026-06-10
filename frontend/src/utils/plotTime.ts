/** Format elapsed seconds as m:ss for plot X-axis labels. */
export function formatPlotAxisTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Compute fixed rolling window [min, max] on elapsed-time axis. */
export function plotXWindowRange(
  latestSec: number,
  windowSec: number,
): { min: number; max: number } {
  if (latestSec <= windowSec) {
    return { min: 0, max: windowSec };
  }
  return { min: latestSec - windowSec, max: latestSec };
}
