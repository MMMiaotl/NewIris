import type { RecordingFrame } from '../api/types';

export interface StatisticsOptions {
  startMs?: number | null;
  stopMs?: number | null;
  includeAverage: boolean;
  includeStdDev: boolean;
  includeMaxMin: boolean;
  includeDerivative: boolean;
  regisOnly: boolean;
}

export interface VariableStatistics {
  name: string;
  count: number;
  average?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  minTime?: number;
  maxTime?: number;
  derivativeAvg?: number;
}

function parseNum(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function filterFrames(
  frames: RecordingFrame[],
  options: StatisticsOptions,
): RecordingFrame[] {
  let out = frames;
  if (options.startMs != null) out = out.filter((f) => f.t >= options.startMs!);
  if (options.stopMs != null) out = out.filter((f) => f.t <= options.stopMs!);
  return out;
}

/** Compute per-variable statistics from recording frames (legacy Export Statistics parity). */
export function computeVariableStatistics(
  frames: RecordingFrame[],
  variables: string[],
  options: StatisticsOptions,
): VariableStatistics[] {
  const filtered = filterFrames(frames, options);
  const results: VariableStatistics[] = [];

  for (const name of variables) {
    const samples: { t: number; v: number }[] = [];
    for (const frame of filtered) {
      const raw = frame.values[name];
      if (raw === undefined) continue;
      const v = parseNum(raw);
      if (v === null) continue;
      samples.push({ t: frame.t, v });
    }
    if (samples.length === 0) {
      results.push({ name, count: 0 });
      continue;
    }

    const values = samples.map((s) => s.v);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const variance =
      count > 1
        ? values.reduce((acc, v) => acc + (v - average) ** 2, 0) / (count - 1)
        : 0;
    const stdDev = Math.sqrt(variance);

    let min = values[0];
    let max = values[0];
    let minTime = samples[0].t;
    let maxTime = samples[0].t;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].v < min) {
        min = samples[i].v;
        minTime = samples[i].t;
      }
      if (samples[i].v > max) {
        max = samples[i].v;
        maxTime = samples[i].t;
      }
    }

    let derivativeAvg: number | undefined;
    if (options.includeDerivative && samples.length >= 2) {
      let derivSum = 0;
      let derivCount = 0;
      for (let i = 1; i < samples.length; i++) {
        const dt = (samples[i].t - samples[i - 1].t) / 1000;
        if (dt <= 0) continue;
        derivSum += (samples[i].v - samples[i - 1].v) / dt;
        derivCount++;
      }
      if (derivCount > 0) derivativeAvg = derivSum / derivCount;
    }

    const row: VariableStatistics = { name, count };
    if (options.includeAverage) row.average = average;
    if (options.includeStdDev) row.stdDev = stdDev;
    if (options.includeMaxMin) {
      row.min = min;
      row.max = max;
      row.minTime = minTime;
      row.maxTime = maxTime;
    }
    if (options.includeDerivative) row.derivativeAvg = derivativeAvg;
    results.push(row);
  }

  return results;
}

export function statisticsToCsv(rows: VariableStatistics[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]).filter((k) => k !== 'name');
  const lines = ['name,' + headers.join(',')];
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = row[h as keyof VariableStatistics];
      return v === undefined ? '' : String(v);
    });
    lines.push(`${row.name},${vals.join(',')}`);
  }
  return lines.join('\n');
}
