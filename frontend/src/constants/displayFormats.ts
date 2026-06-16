/** Client-side display style identifiers (format only, no unit conversion). */
export type FormatStyleId =
  | 'standard'
  | 'decimals:0'
  | 'decimals:1'
  | 'decimals:2'
  | 'decimals:3'
  | 'decimals:4'
  | 'decimals:5'
  | 'decimals:6'
  | 'scientific:3'
  | 'scientific:6'
  | 'truncate:0'
  | 'truncate:1'
  | 'truncate:2'
  | 'truncate:3'
  | 'angle180:0'
  | 'angle180:1'
  | 'degMinSec:0'
  | 'degMinSec:1'
  | 'latitude:0'
  | 'latitude:1'
  | 'longitude:0'
  | 'longitude:1'
  | 'time:s'
  | 'time:day'
  | 'utcClock'
  | 'localClock'
  | 'localClockDate'
  | 'localClockTime'
  | 'intHex'
  | 'intHexWord'
  | 'intHexByte'
  | 'intBit'
  | 'intBitWord'
  | 'intBitByte'
  | 'intChar'
  | 'arrayString'
  | 'lookup';

/** Per-variable client-side display preferences (not sent to server). */
export interface VariableDisplayOverride {
  useCustomName: boolean;
  customName: string;
  format: FormatStyleId;
  unit?: string;
  scaleConversion?: string;
  /** Lookup table: raw value string → display label (styleLookup parity). */
  lookupTable?: Record<string, string>;
  /** Wrap display numeric value to [wrapMin, wrapMax] when both set. */
  wrapMin?: number;
  wrapMax?: number;
}

/** @deprecated Legacy persisted field — read via mergeDisplayOverride. */
export type LegacyVariableDisplayOverride = Partial<VariableDisplayOverride> & {
  style?: FormatStyleId;
};

export interface FormatStyleOption {
  id: FormatStyleId;
  label: string;
}

export const FORMAT_STYLE_OPTIONS: readonly FormatStyleOption[] = [
  { id: 'standard', label: 'standard' },
  { id: 'decimals:0', label: '0 decimals' },
  { id: 'decimals:1', label: '1 decimals' },
  { id: 'decimals:2', label: '2 decimals' },
  { id: 'decimals:3', label: '3 decimals' },
  { id: 'decimals:4', label: '4 decimals' },
  { id: 'decimals:5', label: '5 decimals' },
  { id: 'decimals:6', label: '6 decimals' },
  { id: 'scientific:3', label: 'scientific 3 dec' },
  { id: 'scientific:6', label: 'scientific 6 dec' },
  { id: 'truncate:0', label: 'truncate 0 dec' },
  { id: 'truncate:1', label: 'truncate 1 dec' },
  { id: 'truncate:2', label: 'truncate 2 dec' },
  { id: 'truncate:3', label: 'truncate 3 dec' },
  { id: 'angle180:0', label: 'angle 180 0 dec' },
  { id: 'angle180:1', label: 'angle 180 1 dec' },
  { id: 'degMinSec:0', label: 'deg min sec 0 dec' },
  { id: 'degMinSec:1', label: 'deg min sec 1 dec' },
  { id: 'latitude:0', label: 'latitude 0 dec' },
  { id: 'latitude:1', label: 'latitude 1 dec' },
  { id: 'longitude:0', label: 'longitude 0 dec' },
  { id: 'longitude:1', label: 'longitude 1 dec' },
  { id: 'time:s', label: 'time (seconds)' },
  { id: 'time:day', label: 'time (days)' },
  { id: 'utcClock', label: 'UTC clock' },
  { id: 'localClock', label: 'local clock' },
  { id: 'localClockDate', label: 'local date' },
  { id: 'localClockTime', label: 'local time' },
  { id: 'intHex', label: 'hex (dword)' },
  { id: 'intHexWord', label: 'hex (word)' },
  { id: 'intHexByte', label: 'hex (byte)' },
  { id: 'intBit', label: 'bits (dword)' },
  { id: 'intBitWord', label: 'bits (word)' },
  { id: 'intBitByte', label: 'bits (byte)' },
  { id: 'intChar', label: 'char' },
  { id: 'arrayString', label: 'array string' },
  { id: 'lookup', label: 'lookup table' },
] as const;

export interface UnitOption {
  id: string;
  label: string;
}

export const UNIT_OPTIONS: readonly UnitOption[] = [
  { id: 'time_s', label: 'time s' },
  { id: 'm', label: 'm' },
  { id: 'km', label: 'km' },
  { id: 'naut_miles', label: 'naut miles NM' },
  { id: 'm_s', label: 'm/s' },
  { id: 'km_h', label: 'km/h' },
  { id: 'knots', label: 'knots kn' },
  { id: 'rad', label: 'rad' },
  { id: 'rad_s', label: 'rad/s' },
  { id: 'deg', label: 'degrees °' },
  { id: 'deg_s', label: 'deg/s °/s' },
  { id: 'deg_min', label: 'deg/min' },
  { id: 'hz', label: 'rot/s Hz' },
  { id: 'rpm', label: 'rot/min rpm' },
  { id: 'pa', label: 'Pa' },
  { id: 'bar', label: 'bar' },
  { id: 'mbar', label: 'mbar' },
] as const;

/** Sentinel for "no unit / no scale conversion" in modal lists. */
export const DISPLAY_NONE_ID = '';

export const DISPLAY_NONE_OPTION = { id: DISPLAY_NONE_ID, label: '-' } as const;

export type UnitListOption = UnitOption | typeof DISPLAY_NONE_OPTION;

export const UNIT_LIST_OPTIONS: readonly UnitListOption[] = [
  DISPLAY_NONE_OPTION,
  ...UNIT_OPTIONS,
];

export interface ScaleConversionOption {
  id: string;
  label: string;
  /** Multiply raw server value to get display value. */
  factor: number;
  fromUnit?: string;
  toUnit?: string;
}

export const SCALE_CONVERSION_OPTIONS: readonly ScaleConversionOption[] = [
  { id: 'm->km', label: 'm->km', factor: 0.001, fromUnit: 'm', toUnit: 'km' },
  { id: 'm->NM', label: 'm->NM', factor: 1 / 1852, fromUnit: 'm', toUnit: 'naut_miles' },
  { id: 'm/s->km/h', label: 'm/s->km/h', factor: 3.6, fromUnit: 'm_s', toUnit: 'km_h' },
  { id: 'm/s->kn', label: 'm/s->kn', factor: 1.9438444924406, fromUnit: 'm_s', toUnit: 'knots' },
  { id: 'rad->deg', label: 'rad->deg', factor: 180 / Math.PI, fromUnit: 'rad', toUnit: 'deg' },
  {
    id: 'rad/s->deg/min',
    label: 'rad/s->deg/min',
    factor: (180 / Math.PI) * 60,
    fromUnit: 'rad_s',
    toUnit: 'deg_min',
  },
  {
    id: 'rad/s->Hz',
    label: 'rad/s->Hz',
    factor: 1 / (2 * Math.PI),
    fromUnit: 'rad_s',
    toUnit: 'hz',
  },
  {
    id: 'rad/s->rpm',
    label: 'rad/s->rpm',
    factor: 60 / (2 * Math.PI),
    fromUnit: 'rad_s',
    toUnit: 'rpm',
  },
  { id: 'Pa->bar', label: 'Pa->bar', factor: 1e-5, fromUnit: 'pa', toUnit: 'bar' },
  { id: 'Pa->mbar', label: 'Pa->mbar', factor: 0.01, fromUnit: 'pa', toUnit: 'mbar' },
] as const;

export type ScaleListOption =
  | (ScaleConversionOption & { label: string })
  | typeof DISPLAY_NONE_OPTION;

export const SCALE_LIST_OPTIONS: readonly ScaleListOption[] = [
  DISPLAY_NONE_OPTION,
  ...SCALE_CONVERSION_OPTIONS,
];

const SCALE_BY_ID = new Map(SCALE_CONVERSION_OPTIONS.map((o) => [o.id, o]));
const UNIT_BY_ID = new Map(UNIT_OPTIONS.map((o) => [o.id, o]));

export function getScaleConversion(id: string | undefined): ScaleConversionOption | undefined {
  if (!id) return undefined;
  return SCALE_BY_ID.get(id);
}

export function getUnitLabel(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return UNIT_BY_ID.get(id)?.label;
}

export const DEFAULT_FORMAT_STYLE: FormatStyleId = 'standard';
