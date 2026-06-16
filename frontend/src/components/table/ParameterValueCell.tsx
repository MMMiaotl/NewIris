import { CheckOutlined } from '@ant-design/icons';
import { Button, Input, Space, Tooltip } from 'antd';
import { useDisplayStore } from '../../stores/displayStore';
import { formatDisplayValue, parseDisplayValueForWrite } from '../../utils/formatVariableValue';

interface ParameterValueCellProps {
  name: string;
  value: string;
  draft: string | undefined;
  onDraftChange: (name: string, value: string) => void;
  onClearDraft: (name: string) => void;
  onSetValue: (name: string, value: string) => void;
}

export function ParameterValueCell({
  name,
  value,
  draft,
  onDraftChange,
  onClearDraft,
  onSetValue,
}: ParameterValueCellProps) {
  const override = useDisplayStore((s) => s.overrides[name]);
  const formatted = formatDisplayValue(value, override);
  const display = draft !== undefined ? draft : formatted;
  const hasPending = draft !== undefined && draft !== formatted;

  const apply = () => {
    if (!hasPending || draft === undefined) return;
    const raw = parseDisplayValueForWrite(draft, override) ?? draft;
    onSetValue(name, raw);
    onClearDraft(name);
  };

  return (
    <Space.Compact className="parameter-value-field">
      <Input
        size="small"
        value={display}
        onChange={(e) => onDraftChange(name, e.target.value)}
        onPressEnter={apply}
        status={hasPending ? 'warning' : undefined}
      />
      <Tooltip title={hasPending ? 'Set value' : 'No changes'}>
        <Button
          size="small"
          type={hasPending ? 'primary' : 'default'}
          icon={<CheckOutlined />}
          aria-label="Set value"
          disabled={!hasPending}
          onClick={apply}
        />
      </Tooltip>
    </Space.Compact>
  );
}
