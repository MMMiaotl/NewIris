import { useEffect, useState } from 'react';
import { App, Button, Input, Space, Tooltip } from 'antd';

interface WatchIoNameFieldProps {
  appliedName: string;
  onApply: (name: string) => void;
  placeholder?: string;
  connected?: boolean;
  /** Fixed input width; omit for full-width (e.g. Settings drawer). */
  inputWidth?: number;
}

export function WatchIoNameField({
  appliedName,
  onApply,
  placeholder,
  connected = false,
  inputWidth = 140,
}: WatchIoNameFieldProps) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState(appliedName);

  useEffect(() => {
    setDraft(appliedName);
  }, [appliedName]);

  const trimmed = draft.trim();
  const hasPending = trimmed !== appliedName;
  const canApply = trimmed.length > 0 && hasPending;

  const apply = () => {
    if (!trimmed) {
      message.warning('WatchIO instance name cannot be empty');
      return;
    }
    if (!hasPending) return;
    onApply(trimmed);
    setDraft(trimmed);
    if (connected) {
      message.success(`Instance "${trimmed}" applied — reconnect to switch`);
    } else {
      message.success(`Instance "${trimmed}" applied`);
    }
  };

  return (
    <Space.Compact
      className={inputWidth ? 'watchio-name-field' : 'watchio-name-field watchio-name-compact-full'}
    >
      <Input
        style={inputWidth ? { width: inputWidth } : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={apply}
        placeholder={placeholder}
        status={hasPending ? 'warning' : undefined}
      />
      <Tooltip title={hasPending ? 'Apply instance name' : 'No changes'}>
        <Button type={hasPending ? 'primary' : 'default'} onClick={apply} disabled={!canApply}>
          Apply
        </Button>
      </Tooltip>
    </Space.Compact>
  );
}
