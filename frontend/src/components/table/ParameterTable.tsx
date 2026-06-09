import { Input, Switch, Table } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useVariableStore } from '../../stores/variableStore';
import { filterVariablesByBranch, variableDisplayName, branchHasLoadedChildren } from '../../utils/buildVariableTree';
import { usePlotStore } from '../../stores/plotStore';

interface ParameterTableProps {
  onRegister: (name: string) => void;
  onUnregister: (name: string) => void;
  onSetValue: (name: string, value: string) => void;
}

export function ParameterTable({ onRegister, onUnregister, onSetValue }: ParameterTableProps) {
  const { searchQuery, appMode } = useConnectionStore();
  const { variables, selectedBranch, branchVarPrefix, selectedVariable, setSelectedVariable, treeNodes } =
    useVariableStore();
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

  const filtered = useMemo(() => {
    let list = filterVariablesByBranch(variables, selectedBranch, branchVarPrefix);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(q));
    }
    return list;
  }, [variables, selectedBranch, branchVarPrefix, searchQuery]);

  const columns = [
    {
      title: 'name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: '40%',
      render: (name: string) => variableDisplayName(name, selectedBranch, branchVarPrefix),
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
      title: 'registration',
      dataIndex: 'registered',
      key: 'registered',
      width: '12%',
      render: (on: boolean, row: { name: string }) => (
        <Switch
          size="small"
          checked={on}
          checkedChildren="on"
          unCheckedChildren="off"
          disabled={appMode !== 'live'}
          onChange={(checked) => (checked ? onRegister(row.name) : onUnregister(row.name))}
        />
      ),
    },
    {
      title: 'description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <div className="panel parameter-table-panel">
      <div className="panel-header">Parameters</div>
      <div ref={tableBodyRef} className="parameter-table-body">
        <Table
          size="small"
          columns={columns}
          dataSource={filtered.map((v) => ({ ...v, key: v.name }))}
          pagination={false}
          scroll={{ y: tableScrollY }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedVariable ? [selectedVariable] : [],
            onChange: (keys) => setSelectedVariable((keys[0] as string) ?? null),
          }}
          onRow={(row) => ({
            onDoubleClick: () => addPlotVariable(row.name),
          })}
          locale={{
            emptyText: selectedBranch
              ? branchHasLoadedChildren(treeNodes, selectedBranch)
                ? 'This branch has sub-branches only — select a deeper node (e.g. …Coefs)'
                : 'No variables at this branch'
              : 'Select a tree branch to load variables',
          }}
        />
      </div>
    </div>
  );
}
