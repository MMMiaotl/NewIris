import {
  DEFAULT_FORMAT_STYLE,
  getScaleConversion,
  getUnitLabel,
  type FormatStyleId,
  type VariableDisplayOverride,
} from '../constants/displayFormats';

export function createDefaultDisplayOverride(): VariableDisplayOverride {
  return {
    useCustomName: false,
    customName: '',
    style: DEFAULT_FORMAT_STYLE,
    unit: undefined,
    scaleConversion: undefined,
  };
}

export function mergeDisplayOverride(
  partial?: Partial<VariableDisplayOverride> | null,
): VariableDisplayOverride {
  const defaults = createDefaultDisplayOverride();
  if (!partial) return defaults;
  return {
    useCustomName: partial.useCustomName ?? defaults.useCustomName,
    customName: partial.customName ?? defaults.customName,
    style: partial.style ?? defaults.style,
    unit: partial.unit,
    scaleConversion: partial.scaleConversion,
  };
}

export function hasActiveDisplayOverride(override: VariableDisplayOverride): boolean {
  const defaults = createDefaultDisplayOverride();
  return (
    override.useCustomName ||
    override.style !== defaults.style ||
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

function applyFormatStyle(value: number, style: FormatStyleId): string {
  if (style === 'standard') return String(value);

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
  const num = parseNumeric(rawValue);
  if (num === null) return rawValue;

  const converted = applyScaleConversion(num, merged.scaleConversion);
  const formatted = applyFormatStyle(converted, merged.style);
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
  if (merged.style === 'standard') return String(raw);

  if (merged.style.startsWith('decimals:')) {
    const decimals = Number(merged.style.split(':')[1]);
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

/** Summary line for Control panel Style fieldset. */
export function summarizeDisplayOverride(
  override?: Partial<VariableDisplayOverride> | null,
): string {
  const merged = mergeDisplayOverride(override);
  const parts: string[] = [];
  const styleLabel =
    merged.style === 'standard' ? 'standard' : merged.style.replace(':', ' ');
  parts.push(styleLabel);
  if (merged.scaleConversion) parts.push(merged.scaleConversion);
  if (merged.unit) {
    const unitLabel = getUnitLabel(merged.unit);
    if (unitLabel) parts.push(unitLabel);
  }
  return parts.join(' · ');
}
