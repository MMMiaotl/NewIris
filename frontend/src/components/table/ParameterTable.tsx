import { Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import type { WatchIoVariable } from '../../api/types';
import { MAX_SELECTED_PARAMETERS, useVariableStore } from '../../stores/variableStore';
import { usePlotStore } from '../../stores/plotStore';
import { ResizableTableHeaderCell } from './ResizableTableHeaderCell';

interface ParameterTableProps {
  onSetValue: (name: string, value: string) => void;
}

type FixedColumnKey = 'name' | 'value' | 'scale';

const MIN_DESCRIPTION_WIDTH = 80;
/** Show horizontal scroll before strict overflow so the bar appears earlier. */
const HORIZONTAL_SCROLL_BUFFER = 128;

function fixedCellStyle(width: number): CSSProperties {
  return {
    width,
    minWidth: width,
    maxWidth: width,
  };
}

const DEFAULT_FIXED_WIDTHS: Record<FixedColumnKey, number> = {
  name: 320,
  value: 120,
  scale: 80,
};

export function ParameterTable({ onSetValue }: ParameterTableProps) {
  const { searchQuery, appMode } = useConnectionStore();
  const { variables, selectedVariables } = useVariableStore();
  const { addPlotVariable } = usePlotStore();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [fixedWidths, setFixedWidths] = useState(DEFAULT_FIXED_WIDTHS);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(300);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleResize = useCallback(
    (key: FixedColumnKey) => (width: number) => {
      setFixedWidths((prev) => ({ ...prev, [key]: width }));
    },
    [],
  );

  const fixedSum = fixedWidths.name + fixedWidths.value + fixedWidths.scale;

  const descriptionWidth = useMemo(() => {
    if (containerWidth <= 0) return MIN_DESCRIPTION_WIDTH;
    return Math.max(MIN_DESCRIPTION_WIDTH, containerWidth - fixedSum);
  }, [containerWidth, fixedSum]);

  const minScrollableWidth = fixedSum + MIN_DESCRIPTION_WIDTH;
  const overflowX =
    containerWidth > 0 &&
    minScrollableWidth > containerWidth - HORIZONTAL_SCROLL_BUFFER;
  const scrollX = overflowX
    ? Math.max(minScrollableWidth, fixedSum + descriptionWidth, containerWidth + 1)
    : undefined;

  const variableMap = useMemo(() => new Map(variables.map((v) => [v.name, v])), [variables]);

  const filtered = useMemo(() => {
    if (!selectedVariables.length) return [];
    const q = searchQuery?.toLowerCase();
    return selectedVariables
      .map((name) => variableMap.get(name))
      .filter((v): v is NonNullable<typeof v> => {
        if (!v) return false;
        if (q && !v.name.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [selectedVariables, variableMap, searchQuery]);

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const update = () => {
      const header = el.querySelector<HTMLElement>('.ant-table-header');
      const headerHeight = header?.offsetHeight ?? 28;
      setTableScrollY(Math.max(80, el.clientHeight - headerHeight));
      const style = getComputedStyle(el);
      const paddingX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      setContainerWidth(Math.max(0, el.clientWidth - paddingX));
    };
    update();
    const observer = new ResizeObserver(() => requestAnimationFrame(update));
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedVariables.length, fixedWidths, overflowX]);

  const columns: ColumnsType<WatchIoVariable> = useMemo(
    () => [
      {
        title: 'name',
        dataIndex: 'name',
        key: 'name',
        ellipsis: { showTitle: true },
        width: fixedWidths.name,
        onHeaderCell: () => ({
          width: fixedWidths.name,
          onResize: handleResize('name'),
        }),
        onCell: () => ({ style: fixedCellStyle(fixedWidths.name) }),
      },
      {
        title: 'value',
        dataIndex: 'value',
        key: 'value',
        width: fixedWidths.value,
        onHeaderCell: () => ({
          width: fixedWidths.value,
          onResize: handleResize('value'),
        }),
        onCell: () => ({ style: fixedCellStyle(fixedWidths.value) }),
        render: (val: string, row) => {
          if (appMode === 'replay') return val;
          const draft = editing[row.name];
          return (
            <Input
              size="small"
              value={draft !== undefined ? draft : val}
              onChange={(e) => setEditing((s) => ({ ...s, [row.name]: e.target.value }))}
              onBlur={() => {
                const next = editing[row.name];
                if (next !== undefined && next !== val) onSetValue(row.name, next);
                setEditing((s) => {
                  const { [row.name]: _, ...rest } = s;
                  return rest;
                });
              }}
              onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
            />
          );
        },
      },
      {
        title: 'scale',
        dataIndex: 'scale',
        key: 'scale',
        width: fixedWidths.scale,
        ellipsis: { showTitle: true },
        onHeaderCell: () => ({
          width: fixedWidths.scale,
          onResize: handleResize('scale'),
        }),
        onCell: () => ({ style: fixedCellStyle(fixedWidths.scale) }),
      },
      {
        title: 'description',
        dataIndex: 'description',
        key: 'description',
        ellipsis: { showTitle: true },
        width: descriptionWidth,
        onHeaderCell: () => ({
          width: descriptionWidth,
        }),
        onCell: () => ({
          style: overflowX
            ? fixedCellStyle(descriptionWidth)
            : { minWidth: MIN_DESCRIPTION_WIDTH },
        }),
      },
    ],
    [
      fixedWidths,
      handleResize,
      appMode,
      editing,
      onSetValue,
      descriptionWidth,
      overflowX,
    ],
  );

  const headerLabel =
    selectedVariables.length > 0
      ? `Parameters (${selectedVariables.length}/${MAX_SELECTED_PARAMETERS})`
      : 'Parameters';

  const scroll = useMemo(
    () => (overflowX ? { x: scrollX, y: tableScrollY } : { y: tableScrollY }),
    [overflowX, scrollX, tableScrollY],
  );

  return (
    <div
      className={`panel parameter-table-panel${overflowX ? ' has-horizontal-scroll' : ''}`}
    >
      <div className="panel-header">{headerLabel}</div>
      <div
        ref={tableBodyRef}
        className="parameter-table-body"
        style={{ '--parameter-table-body-height': `${tableScrollY}px` } as CSSProperties}
      >
        <Table<WatchIoVariable>
          size="small"
          tableLayout="fixed"
          columns={columns}
          components={{
            header: { cell: ResizableTableHeaderCell },
          }}
          dataSource={filtered.map((v) => ({ ...v, key: v.name }))}
          pagination={false}
          scroll={scroll}
          onRow={(row) => ({
            onDoubleClick: () => addPlotVariable(row.name),
          })}
          locale={{
            emptyText:
              selectedVariables.length > 0
                ? 'Selected parameters are not loaded yet'
                : 'Select parameters in the tree (click circles; up to 100)',
          }}
        />
      </div>
    </div>
  );
}
