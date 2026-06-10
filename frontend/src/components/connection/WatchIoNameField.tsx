import { useEffect, useState } from 'react';
import { App, Button, Input, Space, Tooltip } from 'antd';

interface WatchIoNameFieldProps {
  appliedName: string;
  /** Return false when auto-reconnect fails (connected session). */
  onApply: (name: string) => void | Promise<boolean | void>;
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
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setDraft(appliedName);
  }, [appliedName]);

  const trimmed = draft.trim();
  const hasPending = trimmed !== appliedName;
  const canApply = trimmed.length > 0 && hasPending && !applying;

  const apply = async () => {
    if (!trimmed) {
      message.warning('WatchIO instance name cannot be empty');
      return;
    }
    if (!hasPending || applying) return;

    setApplying(true);
    try {
      const wasConnected = connected;
      const result = await onApply(trimmed);
      if (result === false) {
        message.error(
          `Could not connect to WatchIO instance "${trimmed}". Check the name and use Connect to retry.`,
        );
        return;
      }
      setDraft(trimmed);
      if (wasConnected) {
        message.success(`Connected to "${trimmed}"`);
      } else {
        message.success(`Instance "${trimmed}" applied`);
      }
    } catch {
      message.error(
        `Could not connect to WatchIO instance "${trimmed}". Check the name and use Connect to retry.`,
      );
    } finally {
      setApplying(false);
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
        onPressEnter={() => void apply()}
        placeholder={placeholder}
        status={hasPending ? 'warning' : undefined}
        disabled={applying}
      />
      <Tooltip
        title={
          applying
            ? 'Reconnecting…'
            : hasPending
              ? connected
                ? 'Apply and reconnect'
                : 'Apply instance name'
              : 'No changes'
        }
      >
        <Button
          type={hasPending ? 'primary' : 'default'}
          onClick={() => void apply()}
          disabled={!canApply}
          loading={applying}
        >
          Apply
        </Button>
      </Tooltip>
    </Space.Compact>
  );
}
