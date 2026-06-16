import {
  DEFAULT_FORMAT_STYLE,
  getScaleConversion,
  getUnitLabel,
  type FormatStyleId,
  type LegacyVariableDisplayOverride,
  type VariableDisplayOverride,
} from '../constants/displayFormats';

export function createDefaultDisplayOverride(): VariableDisplayOverride {
  return {
    useCustomName: false,
    customName: '',
    format: DEFAULT_FORMAT_STYLE,
    unit: undefined,
    scaleConversion: undefined,
  };
}

export function mergeDisplayOverride(
  partial?: LegacyVariableDisplayOverride | null,
): VariableDisplayOverride {
  const defaults = createDefaultDisplayOverride();
  if (!partial) return defaults;
  return {
    useCustomName: partial.useCustomName ?? defaults.useCustomName,
    customName: partial.customName ?? defaults.customName,
    format: partial.format ?? partial.style ?? defaults.format,
    unit: partial.unit,
    scaleConversion: partial.scaleConversion,
    lookupTable: partial.lookupTable,
    wrapMin: partial.wrapMin,
    wrapMax: partial.wrapMax,
  };
}

export function hasActiveDisplayOverride(override: VariableDisplayOverride): boolean {
  const defaults = createDefaultDisplayOverride();
  return (
    override.useCustomName ||
    override.format !== defaults.format ||
    Boolean(override.unit) ||
    Boolean(override.scaleConversion)
  );
}

export function getDisplayLabel(
  sourceName: string,
  override?: Partial<VariableDisplayOverride> | null,
): string {
  const merged = mergeDisplayOverride(override);
  if (merged.useCustomName && merged.customName.trim()) {
    return merged.customName.trim();
  }
  return sourceName;
}

function parseNumeric(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function applyScaleConversion(value: number, scaleConversionId?: string): number {
  const scale = getScaleConversion(scaleConversionId);
  if (!scale) return value;
  return value * scale.factor;
}

function inverseScaleConversion(value: number, scaleConversionId?: string): number {
  const scale = getScaleConversion(scaleConversionId);
  if (!scale || scale.factor === 0) return value;
  return value / scale.factor;
}

function formatAngle180(value: number, decimals: number): string {
  const halfTurn = value / 180;
  const wrapped = halfTurn - Math.trunc(halfTurn);
  const angle = wrapped * 180;
  return angle.toFixed(decimals);
}

function wrapValue(value: number, min?: number, max?: number): number {
  if (min === undefined || max === undefined || min >= max) return value;
  const span = max - min;
  let v = value;
  while (v > max) v -= span;
  while (v < min) v += span;
  return v;
}

function formatDegMinSec(value: number, decimals: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${sign}${deg}°${min}'${sec.toFixed(decimals)}"`;
}

function formatLatitude(value: number, decimals: number): string {
  const hemi = value >= 0 ? 'N' : 'S';
  return `${formatDegMinSec(Math.abs(value), decimals)} ${hemi}`;
}

function formatLongitude(value: number, decimals: number): string {
  const hemi = value >= 0 ? 'E' : 'W';
  return `${formatDegMinSec(Math.abs(value), decimals)} ${hemi}`;
}

function formatTimeSeconds(value: number): string {
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

function formatTimeDays(value: number): string {
  const days = Math.floor(value);
  const frac = value - days;
  const sec = frac * 86400;
  return `day ${days} ${formatTimeSeconds(sec)}`;
}

function formatClockMs(ms: number, mode: 'utc' | 'local', part: 'full' | 'date' | 'time'): string {
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions =
    part === 'date'
      ? { year: 'numeric', month: '2-digit', day: '2-digit' }
      : part === 'time'
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        : {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          };
  const tz = mode === 'utc' ? 'UTC' : undefined;
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(d);
}

function formatHex(value: number, bits: 8 | 16 | 32): string {
  const mask = bits === 8 ? 0xff : bits === 16 ? 0xffff : 0xffffffff;
  const v = Math.trunc(value) & mask;
  const hexLen = bits / 4;
  return `0x${v.toString(16).toUpperCase().padStart(hexLen, '0')}`;
}

function formatBits(value: number, bits: 8 | 16 | 32): string {
  const mask = bits === 8 ? 0xff : bits === 16 ? 0xffff : 0xffffffff;
  const v = Math.trunc(value) & mask;
  return v.toString(2).padStart(bits, '0');
}

function formatIntChar(value: number): string {
  const code = Math.trunc(value) & 0xff;
  if (code >= 32 && code < 127) return `'${String.fromCharCode(code)}'`;
  return `\\x${code.toString(16).padStart(2, '0')}`;
}

function formatArrayString(raw: string): string {
  if (raw.includes(',')) return raw.split(',').map((s) => s.trim()).join(', ');
  return raw;
}

function formatLookup(value: number | string, table?: Record<string, string>): string {
  if (!table) return String(value);
  const key = String(value);
  return table[key] ?? key;
}

const STANDARD_DECIMALS = 3;

function applyFormatStyle(
  value: number,
  style: FormatStyleId,
  lookupTable?: Record<string, string>,
): string {
  if (style === 'standard') return value.toFixed(STANDARD_DECIMALS);

  if (style.startsWith('decimals:')) {
    const decimals = Number(style.split(':')[1]);
    return value.toFixed(decimals);
  }

  if (style.startsWith('scientific:')) {
    const decimals = Number(style.split(':')[1]);
    return value.toExponential(decimals);
  }

  if (style.startsWith('truncate:')) {
    const decimals = Number(style.split(':')[1]);
    const factor = 10 ** decimals;
    const truncated = Math.trunc(value * factor) / factor;
    return truncated.toFixed(decimals);
  }

  if (style.startsWith('angle180:')) {
    const decimals = Number(style.split(':')[1]);
    return formatAngle180(value, decimals);
  }

  if (style.startsWith('degMinSec:')) {
    return formatDegMinSec(value, Number(style.split(':')[1]));
  }

  if (style.startsWith('latitude:')) {
    return formatLatitude(value, Number(style.split(':')[1]));
  }

  if (style.startsWith('longitude:')) {
    return formatLongitude(value, Number(style.split(':')[1]));
  }

  if (style === 'time:s') return formatTimeSeconds(value);
  if (style === 'time:day') return formatTimeDays(value);
  if (style === 'utcClock') return formatClockMs(value * 1000, 'utc', 'full');
  if (style === 'localClock') return formatClockMs(value * 1000, 'local', 'full');
  if (style === 'localClockDate') return formatClockMs(value * 1000, 'local', 'date');
  if (style === 'localClockTime') return formatClockMs(value * 1000, 'local', 'time');

  if (style === 'intHex') return formatHex(value, 32);
  if (style === 'intHexWord') return formatHex(value, 16);
  if (style === 'intHexByte') return formatHex(value, 8);
  if (style === 'intBit') return formatBits(value, 32);
  if (style === 'intBitWord') return formatBits(value, 16);
  if (style === 'intBitByte') return formatBits(value, 8);
  if (style === 'intChar') return formatIntChar(value);
  if (style === 'lookup') return formatLookup(value, lookupTable);

  return String(value);
}

function appendUnitSuffix(text: string, unitId?: string): string {
  const label = getUnitLabel(unitId);
  if (!label) return text;
  return `${text} ${label}`;
}

/** Convert raw server string to display string (format + unit conversion). */
export function formatDisplayValue(
  rawValue: string,
  override?: Partial<VariableDisplayOverride> | null,
): string {
  const merged = mergeDisplayOverride(override);
  if (merged.format === 'arrayString') return formatArrayString(rawValue);
  if (merged.format === 'lookup') return formatLookup(rawValue.trim(), merged.lookupTable);

  const num = parseNumeric(rawValue);
  if (num === null) return rawValue;

  const converted = applyScaleConversion(num, merged.scaleConversion);
  const wrapped = wrapValue(converted, merged.wrapMin, merged.wrapMax);
  const formatted = applyFormatStyle(wrapped, merged.format, merged.lookupTable);
  return appendUnitSuffix(formatted, merged.unit);
}

/** Numeric value after scale conversion (for plots). */
export function convertRawToDisplayNumber(
  rawValue: string,
  override?: Partial<VariableDisplayOverride> | null,
): number | null {
  const num = parseNumeric(rawValue);
  if (num === null) return null;
  const merged = mergeDisplayOverride(override);
  return applyScaleConversion(num, merged.scaleConversion);
}

/** Convert user-edited display value back to raw server string. */
export function parseDisplayValueForWrite(
  displayValue: string,
  override?: Partial<VariableDisplayOverride> | null,
): string | null {
  const merged = mergeDisplayOverride(override);
  const stripped = displayValue.replace(/\s+[\w°/]+(?:\s[\w°/]+)*$/, '').trim();
  const num = parseNumeric(stripped || displayValue);
  if (num === null) return null;

  const raw = inverseScaleConversion(num, merged.scaleConversion);
  if (merged.format === 'standard') return String(raw);

  if (merged.format.startsWith('decimals:')) {
    const decimals = Number(merged.format.split(':')[1]);
    return raw.toFixed(decimals);
  }

  return String(raw);
}

export function getEffectiveScaleLabel(
  serverScale: string,
  override?: Partial<VariableDisplayOverride> | null,
): string {
  const merged = mergeDisplayOverride(override);
  const parts: string[] = [];
  if (merged.scaleConversion) {
    parts.push(merged.scaleConversion);
  }
  if (merged.unit) {
    const unitLabel = getUnitLabel(merged.unit);
    if (unitLabel) parts.push(unitLabel);
  }
  if (parts.length) return parts.join(' · ');
  return serverScale || '—';
}

/** Summary line for Control panel Format fieldset. */
export function summarizeDisplayOverride(
  override?: LegacyVariableDisplayOverride | null,
): string {
  const merged = mergeDisplayOverride(override);
  const parts: string[] = [];
  const formatLabel =
    merged.format === 'standard' ? 'standard' : merged.format.replace(':', ' ');
  parts.push(formatLabel);
  if (merged.scaleConversion) parts.push(merged.scaleConversion);
  if (merged.unit) {
    const unitLabel = getUnitLabel(merged.unit);
    if (unitLabel) parts.push(unitLabel);
  }
  return parts.join(' · ');
}
