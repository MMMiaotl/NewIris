import { Input, Table } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { MAX_SELECTED_PARAMETERS, useVariableStore } from '../../stores/variableStore';
import { parentBranchFromVariableName, variableDisplayName } from '../../utils/buildVariableTree';
import { usePlotStore } from '../../stores/plotStore';

interface ParameterTableProps {
  onSetValue: (name: string, value: string) => void;
}

export function ParameterTable({ onSetValue }: ParameterTableProps) {
  const { searchQuery, appMode } = useConnectionStore();
  const { variables, selectedBranch, branchVarPrefix, selectedVariables } = useVariableStore();
  const { addPlotVariable } = usePlotStore();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(300);

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const update = () => setTableScrollY(Math.max(120, el.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const columns = [
    {
      title: 'name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: '40%',
      render: (name: string) => {
        const branch = selectedBranch ?? parentBranchFromVariableName(name);
        return variableDisplayName(name, branch, branchVarPrefix);
      },
    },
    {
      title: 'value',
      dataIndex: 'value',
      key: 'value',
      width: '15%',
      render: (val: string, row: { name: string }) => {
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
      width: '10%',
    },
    {
      title: 'description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: { showTitle: true },
    },
  ];

  const headerLabel =
    selectedVariables.length > 0
      ? `Parameters (${selectedVariables.length}/${MAX_SELECTED_PARAMETERS})`
      : 'Parameters';

  return (
    <div className="panel parameter-table-panel">
      <div className="panel-header">{headerLabel}</div>
      <div ref={tableBodyRef} className="parameter-table-body">
        <Table
          size="small"
          columns={columns}
          dataSource={filtered.map((v) => ({ ...v, key: v.name }))}
          pagination={false}
          scroll={{ y: tableScrollY }}
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
