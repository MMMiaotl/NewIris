import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Space, Tooltip } from 'antd';

interface WatchIoNameFieldProps {
  appliedName: string;
  /** Return false on connect failure; 'saved' when only the name was stored (offline). */
  onApply: (name: string) => void | Promise<boolean | 'saved' | void>;
  placeholder?: string;
  connected?: boolean;
  /** Fixed input width; omit for full-width (e.g. Connection modal). */
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
  const skipDraftSyncRef = useRef(false);

  useEffect(() => {
    if (skipDraftSyncRef.current) {
      skipDraftSyncRef.current = false;
      return;
    }
    setDraft(appliedName);
  }, [appliedName]);

  const trimmed = draft.trim();
  /** Disconnected = no live session; same name as config still needs Apply to connect. */
  const hasPending = !connected || trimmed !== appliedName;
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
        skipDraftSyncRef.current = true;
        setDraft(trimmed);
        message.error(
          wasConnected
            ? `Could not connect to "${trimmed}". Fix the name and Apply again, or use Connect.`
            : `Could not connect to WatchIO instance "${trimmed}". Check the name and use Connect to retry.`,
        );
        return;
      }
      setDraft(trimmed);
      if (result === 'saved') {
        message.success(`Instance "${trimmed}" applied`);
      } else {
        message.success(`Connected to "${trimmed}"`);
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
                : 'Connect to instance'
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
