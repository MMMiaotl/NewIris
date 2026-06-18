import { Checkbox, Divider, Form, Modal, Segmented, Typography } from 'antd';
import { COLOR_THEME_HINTS, COLOR_THEME_OPTIONS, type ColorThemeId } from '../../constants/colorTheme';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

interface ThemeSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeSettingsModal({ open, onClose }: ThemeSettingsModalProps) {
  const { colorTheme, highContrast, setColorTheme, setHighContrast } = useUiPreferencesStore();

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
          {COLOR_THEME_HINTS[colorTheme]}
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
