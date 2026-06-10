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
  { key: 'name', title: 'name', dataIndex: 'name', defaultWidth: 320, minWidth: 80 },
  { key: 'type', title: 'type', dataIndex: 'varKind', defaultWidth: 72, minWidth: 48 },
  { key: 'value', title: 'value', dataIndex: 'value', defaultWidth: 120, minWidth: 64 },
  { key: 'scale', title: 'scale', dataIndex: 'scale', defaultWidth: 80, minWidth: 48 },
] as const;

export const MIN_DESCRIPTION_WIDTH = 80;

/** Show horizontal scroll before strict overflow so the bar appears earlier. */
export const HORIZONTAL_SCROLL_BUFFER = 128;

export type ParameterFixedWidths = Record<ParameterFixedColumnKey, number>;

export function createDefaultFixedWidths(): ParameterFixedWidths {
  return Object.fromEntries(
    PARAMETER_FIXED_COLUMN_SPECS.map((spec) => [spec.key, spec.defaultWidth]),
  ) as ParameterFixedWidths;
}

export function fixedCellStyle(width: number): CSSProperties {
  return {
    width,
    minWidth: width,
    maxWidth: width,
  };
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
