import { Table } from 'antd';
import type { ColumnType, ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import type { WatchIoVariable } from '../../api/types';
import {
  createPlaceholderVariable,
  MAX_SELECTED_PARAMETERS,
  useVariableStore,
} from '../../stores/variableStore';
import { usePlotStore } from '../../stores/plotStore';
import { ParameterValueCell } from './ParameterValueCell';
import { ResizableTableHeaderCell } from './ResizableTableHeaderCell';
import {
  buildFixedParameterColumn,
  createDefaultFixedWidths,
  fixedCellStyle,
  HORIZONTAL_SCROLL_BUFFER,
  MIN_DESCRIPTION_WIDTH,
  PARAMETER_FIXED_COLUMN_SPECS,
  type ParameterFixedColumnKey,
  type ParameterFixedWidths,
} from './parameterTableLayout';

interface ParameterTableProps {
  onSetValue: (name: string, value: string) => void;
}

export function ParameterTable({ onSetValue }: ParameterTableProps) {
  const { searchQuery, appMode } = useConnectionStore();
  const {
    variables,
    selectedVariables,
    focusedVariable,
    setFocusedVariable,
  } = useVariableStore();
  const setPlotDrawerOpen = useConnectionStore((s) => s.setPlotDrawerOpen);
  const { addPlotVariable } = usePlotStore();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [fixedWidths, setFixedWidths] = useState<ParameterFixedWidths>(createDefaultFixedWidths);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(300);
  const [containerWidth, setContainerWidth] = useState(0);

  const openControlForVariable = useCallback(
    (name: string) => {
      setFocusedVariable(name);
      setPlotDrawerOpen(true);
    },
    [setFocusedVariable, setPlotDrawerOpen],
  );

  const setValueDraft = useCallback((name: string, value: string) => {
    setEditing((s) => ({ ...s, [name]: value }));
  }, []);

  const clearValueDraft = useCallback((name: string) => {
    setEditing((s) => {
      const { [name]: removed, ...rest } = s;
      void removed;
      return rest;
    });
  }, []);

  const handleResize = useCallback(
    (key: ParameterFixedColumnKey) => (width: number) => {
      setFixedWidths((prev) => ({ ...prev, [key]: width }));
    },
    [],
  );

  const variableMap = useMemo(() => new Map(variables.map((v) => [v.name, v])), [variables]);

  const tableRows = useMemo(() => {
    if (!selectedVariables.length) return [];
    const q = searchQuery?.toLowerCase();
    return selectedVariables
      .map((name) => variableMap.get(name) ?? createPlaceholderVariable(name))
      .filter((v) => !q || v.name.toLowerCase().includes(q));
  }, [selectedVariables, variableMap, searchQuery]);

  const showTypeColumn = useMemo(
    () => tableRows.some((row) => Boolean(row.varKind?.trim())),
    [tableRows],
  );

  const fixedSum = useMemo(
    () =>
      PARAMETER_FIXED_COLUMN_SPECS.filter(
        (spec) => showTypeColumn || spec.key !== 'type',
      ).reduce((sum, spec) => sum + fixedWidths[spec.key], 0),
    [fixedWidths, showTypeColumn],
  );

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
  }, [selectedVariables.length, fixedWidths, overflowX, showTypeColumn]);

  const columns: ColumnsType<WatchIoVariable> = useMemo(() => {
    const fixedColumns = PARAMETER_FIXED_COLUMN_SPECS.filter(
      (spec) => showTypeColumn || spec.key !== 'type',
    ).map((spec) => {
      const width = fixedWidths[spec.key];
      const onResize = handleResize(spec.key);

      if (spec.key === 'name') {
        return buildFixedParameterColumn(spec, width, onResize, {
          render: (name: string) => (
            <button
              type="button"
              className="parameter-name-link"
              onClick={() => openControlForVariable(name)}
            >
              {name}
            </button>
          ),
        });
      }

      if (spec.key === 'type') {
        return buildFixedParameterColumn(spec, width, onResize);
      }

      if (spec.key === 'value') {
        return buildFixedParameterColumn(spec, width, onResize, {
          ellipsis: false,
        render: (val: string, row) => {
          const isPlaceholder = !variableMap.has(row.name);
          if (isPlaceholder) return val || '—';
          if (appMode === 'replay') return val;
          return (
            <ParameterValueCell
              name={row.name}
              value={val}
              draft={editing[row.name]}
              onDraftChange={setValueDraft}
              onClearDraft={clearValueDraft}
              onSetValue={onSetValue}
            />
          );
          },
        });
      }

      return buildFixedParameterColumn(spec, width, onResize);
    });

    const descriptionColumn: ColumnType<WatchIoVariable> = {
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
    };

    return [...fixedColumns, descriptionColumn];
  }, [
    fixedWidths,
    handleResize,
    appMode,
    editing,
    onSetValue,
    descriptionWidth,
    overflowX,
    variableMap,
    openControlForVariable,
    showTypeColumn,
    setValueDraft,
    clearValueDraft,
  ]);

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
          dataSource={tableRows.map((v) => ({ ...v, key: v.name }))}
          pagination={false}
          scroll={scroll}
          onRow={(row) => ({
            className:
              row.name === focusedVariable ? 'parameter-row-focused' : undefined,
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
