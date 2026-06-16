import type { ColumnType } from 'antd/es/table';
import type { CSSProperties } from 'react';
import type { WatchIoVariable } from '../../api/types';
import type { ResizableHeaderCellProps } from './ResizableTableHeaderCell';

/** Fixed-width parameter columns — add new entries here to get resize + layout for free. */
export type ParameterFixedColumnKey = 'name' | 'type' | 'value' | 'scale';

export interface ParameterFixedColumnSpec {
  key: ParameterFixedColumnKey;
  title: string;
  dataIndex: keyof WatchIoVariable;
  defaultWidth: number;
  minWidth: number;
}

export const PARAMETER_FIXED_COLUMN_SPECS: readonly ParameterFixedColumnSpec[] = [
  { key: 'name', title: 'name', dataIndex: 'name', defaultWidth: 220, minWidth: 80 },
  { key: 'type', title: 'type', dataIndex: 'varKind', defaultWidth: 72, minWidth: 48 },
  { key: 'value', title: 'value', dataIndex: 'value', defaultWidth: 120, minWidth: 64 },
  { key: 'scale', title: 'scale', dataIndex: 'scale', defaultWidth: 80, minWidth: 48 },
] as const;

export const MIN_DESCRIPTION_WIDTH = 80;

/** Vertical padding inside parameter table cells (inline style beats antd CSS-in-js). */
export const PARAMETER_CELL_PADDING_BLOCK = 4;
export const PARAMETER_CELL_PADDING_INLINE = 6;
export const PARAMETER_CELL_LINE_HEIGHT = 18;

export const PARAMETER_CELL_PADDING = `${PARAMETER_CELL_PADDING_BLOCK}px ${PARAMETER_CELL_PADDING_INLINE}px`;

export function parameterCellStyle(width?: number): CSSProperties {
  const base: CSSProperties = {
    padding: PARAMETER_CELL_PADDING,
    lineHeight: `${PARAMETER_CELL_LINE_HEIGHT}px`,
  };
  if (width === undefined) return base;
  return {
    ...base,
    width,
    minWidth: width,
    maxWidth: width,
  };
}

/** Show horizontal scroll before strict overflow so the bar appears earlier. */
export const HORIZONTAL_SCROLL_BUFFER = 128;

export type ParameterFixedWidths = Record<ParameterFixedColumnKey, number>;

export function createDefaultFixedWidths(): ParameterFixedWidths {
  return Object.fromEntries(
    PARAMETER_FIXED_COLUMN_SPECS.map((spec) => [spec.key, spec.defaultWidth]),
  ) as ParameterFixedWidths;
}

const PERSISTED_COLUMN_WIDTHS_KEY = 'newiris-parameter-column-widths-v1';

function clampWidth(key: ParameterFixedColumnKey, width: number): number {
  const spec = PARAMETER_FIXED_COLUMN_SPECS.find((s) => s.key === key);
  if (!spec) return width;
  return Math.max(spec.minWidth, Math.round(width));
}

export function readPersistedParameterColumnWidths(): ParameterFixedWidths | null {
  try {
    const raw = sessionStorage.getItem(PERSISTED_COLUMN_WIDTHS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ParameterFixedWidths>;
    const defaults = createDefaultFixedWidths();
    const next = { ...defaults };
    for (const spec of PARAMETER_FIXED_COLUMN_SPECS) {
      const value = data[spec.key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        next[spec.key] = clampWidth(spec.key, value);
      }
    }
    return next;
  } catch {
    return null;
  }
}

export function writePersistedParameterColumnWidths(widths: ParameterFixedWidths): void {
  try {
    sessionStorage.setItem(PERSISTED_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
  } catch {
    // ignore quota / private mode
  }
}

export function fixedCellStyle(width: number): CSSProperties {
  return parameterCellStyle(width);
}

export function sumFixedWidths(widths: ParameterFixedWidths): number {
  return PARAMETER_FIXED_COLUMN_SPECS.reduce((sum, spec) => sum + widths[spec.key], 0);
}

export function resizableHeaderCellProps(
  width: number,
  minWidth: number,
  onResize: (width: number) => void,
): ResizableHeaderCellProps {
  return {
    width,
    minWidth,
    onResize,
    className: 'parameter-table-resizable-th',
    style: parameterCellStyle(width),
  };
}

type FixedColumnExtras = Pick<
  ColumnType<WatchIoVariable>,
  'render' | 'ellipsis' | 'onCell'
>;

/** Build one resizable fixed column — keeps header/body width wiring consistent. */
export function buildFixedParameterColumn(
  spec: ParameterFixedColumnSpec,
  width: number,
  onResize: (width: number) => void,
  extras?: FixedColumnExtras,
): ColumnType<WatchIoVariable> {
  return {
    title: spec.title,
    dataIndex: spec.dataIndex,
    key: spec.key,
    width,
    ellipsis: extras?.ellipsis ?? { showTitle: true },
    onHeaderCell: () => resizableHeaderCellProps(width, spec.minWidth, onResize),
    onCell:
      extras?.onCell ??
      (() => ({
        style: fixedCellStyle(width),
      })),
    render: extras?.render,
  };
}
