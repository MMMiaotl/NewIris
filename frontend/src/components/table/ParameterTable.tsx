import { Table } from 'antd';
import type { ColumnType, ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import type { WatchIoVariable } from '../../api/types';
import {
  createPlaceholderVariable,
  MAX_SELECTED_PARAMETERS,
  useVariableStore,
} from '../../stores/variableStore';
import { variableNameMatchesSearch } from '../../utils/buildVariableTree';
import { usePlotStore } from '../../stores/plotStore';
import { ParameterValueCell } from './ParameterValueCell';
import { ResizableTableHeaderCell } from './ResizableTableHeaderCell';
import {
  buildFixedParameterColumn,
  createDefaultFixedWidths,
  fixedCellStyle,
  MIN_DESCRIPTION_WIDTH,
  PARAMETER_FIXED_COLUMN_SPECS,
  readPersistedParameterColumnWidths,
  writePersistedParameterColumnWidths,
  type ParameterFixedColumnKey,
  type ParameterFixedWidths,
} from './parameterTableLayout';

const COLUMN_WIDTH_SAVE_MS = 300;

interface ParameterTableProps {
  onSetValue: (name: string, value: string) => void;
}

function createInitialFixedWidths(): ParameterFixedWidths {
  return readPersistedParameterColumnWidths() ?? createDefaultFixedWidths();
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
  const [fixedWidths, setFixedWidths] = useState<ParameterFixedWidths>(createInitialFixedWidths);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(300);
  const [containerWidth, setContainerWidth] = useState(0);
  const columnWidthSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setFixedWidths((prev) => {
        const next = { ...prev, [key]: width };
        if (columnWidthSaveTimerRef.current) clearTimeout(columnWidthSaveTimerRef.current);
        columnWidthSaveTimerRef.current = setTimeout(() => {
          writePersistedParameterColumnWidths(next);
        }, COLUMN_WIDTH_SAVE_MS);
        return next;
      });
    },
    [],
  );

  useEffect(
    () => () => {
      if (columnWidthSaveTimerRef.current) clearTimeout(columnWidthSaveTimerRef.current);
    },
    [],
  );

  const variableMap = useMemo(() => new Map(variables.map((v) => [v.name, v])), [variables]);

  const tableRows = useMemo(() => {
    if (!selectedVariables.length) return [];
    const q = searchQuery?.toLowerCase();
    return selectedVariables
      .map((name) => variableMap.get(name) ?? createPlaceholderVariable(name))
      .filter((v) => !q || variableNameMatchesSearch(v.name, q));
  }, [selectedVariables, variableMap, searchQuery]);

  const showTypeColumn = useMemo(
    () => tableRows.some((row) => Boolean(row.varKind?.trim())),
    [tableRows],
  );

  const visibleFixedSpecs = useMemo(
    () =>
      showTypeColumn
        ? PARAMETER_FIXED_COLUMN_SPECS
        : PARAMETER_FIXED_COLUMN_SPECS.filter((spec) => spec.key !== 'type'),
    [showTypeColumn],
  );

  const fixedSum = useMemo(
    () => visibleFixedSpecs.reduce((sum, spec) => sum + fixedWidths[spec.key], 0),
    [fixedWidths, visibleFixedSpecs],
  );

  const descriptionWidth = useMemo(() => {
    if (containerWidth <= 0) return MIN_DESCRIPTION_WIDTH;
    return Math.max(MIN_DESCRIPTION_WIDTH, containerWidth - fixedSum);
  }, [containerWidth, fixedSum]);

  /** Sum of column widths — scroll.x keeps horizontal layout stable. */
  const tableWidth = fixedSum + descriptionWidth;
  const tableReady = containerWidth > 0;

  useLayoutEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const update = () => {
      setContainerWidth(Math.max(0, el.clientWidth));
      setTableScrollY(Math.max(80, el.clientHeight));
    };
    update();
    const observer = new ResizeObserver(() => requestAnimationFrame(update));
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedVariables.length, fixedWidths]);

  const columns: ColumnsType<WatchIoVariable> = useMemo(() => {
    const fixedColumns = visibleFixedSpecs.map((spec) => {
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
        style: fixedCellStyle(descriptionWidth),
      }),
      onCell: () => ({
        style: fixedCellStyle(descriptionWidth),
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
    variableMap,
    openControlForVariable,
    visibleFixedSpecs,
    setValueDraft,
    clearValueDraft,
  ]);

  const headerLabel =
    selectedVariables.length > 0
      ? `Parameters (${selectedVariables.length}/${MAX_SELECTED_PARAMETERS})`
      : 'Parameters';

  const scroll = useMemo(() => {
    if (tableWidth > containerWidth) return { x: tableWidth };
    return undefined;
  }, [tableWidth, containerWidth]);

  return (
    <div className="panel parameter-table-panel">
      <div className="panel-header">{headerLabel}</div>
      <div ref={tableBodyRef} className="parameter-table-body">
        <div
          className="parameter-table-scroll"
          style={tableReady ? { maxHeight: tableScrollY } : undefined}
        >
          {tableReady ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
