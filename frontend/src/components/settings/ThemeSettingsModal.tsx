/** Theme / appearance settings — separate from general Preferences. */
import { Checkbox, Divider, Form, Modal, Segmented, Typography } from 'antd';
import { COLOR_THEME_OPTIONS, type ColorThemeId } from '../../constants/colorTheme';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

const THEME_HINTS: Record<ColorThemeId, string> = {
  light: 'White panels on light gray — default daytime workspace.',
  dark: 'Neutral charcoal surfaces with light text.',
  navy: 'Deep navy workspace with cool accent highlights.',
};

interface ThemeSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeSettingsModal({ open, onClose }: ThemeSettingsModalProps) {
  const colorTheme = useUiPreferencesStore((s) => s.colorTheme);
  const highContrast = useUiPreferencesStore((s) => s.highContrast);
  const setColorTheme = useUiPreferencesStore((s) => s.setColorTheme);
  const setHighContrast = useUiPreferencesStore((s) => s.setHighContrast);

  return (
    <Modal title="Theme" open={open} onCancel={onClose} onOk={onClose} width={420}>
      <Form layout="vertical" size="small">
        <Form.Item label="Color theme" style={{ marginBottom: 8 }}>
          <Segmented
            block
            value={colorTheme}
            onChange={(value) => setColorTheme(value as ColorThemeId)}
            options={COLOR_THEME_OPTIONS}
          />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          {THEME_HINTS[colorTheme]}
        </Typography.Paragraph>

        <Divider style={{ margin: '14px 0 10px' }} />

        <Checkbox checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)}>
          High contrast
        </Checkbox>
        <Typography.Paragraph type="secondary" style={{ margin: '6px 0 0', fontSize: 12 }}>
          Stronger panel borders and higher text/background contrast for the active theme.
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}
