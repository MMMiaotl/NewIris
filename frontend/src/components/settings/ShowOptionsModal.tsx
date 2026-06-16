/** Show Options dialog — legacy Iris ShowOptionsDlg parity (subset for web). */
import { Checkbox, Divider, Modal, Radio, Space, Typography } from 'antd';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

interface ShowOptionsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShowOptionsModal({ open, onClose }: ShowOptionsModalProps) {
  const s = useUiPreferencesStore();

  return (
    <Modal title="Show Options" open={open} onCancel={onClose} onOk={onClose} width={420}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Tree variable labels
      </Typography.Text>
      <Radio.Group
        value={s.treeLabelMode}
        onChange={(e) => s.setTreeLabelMode(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0 12px' }}
      >
        <Radio value="name">Name (A–Z)</Radio>
        <Radio value="alias">Alias</Radio>
        <Radio value="custom">Custom display name</Radio>
      </Radio.Group>

      <Divider style={{ margin: '8px 0' }} />

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Filter &amp; list
      </Typography.Text>
      <Space direction="vertical" style={{ margin: '8px 0' }}>
        <Checkbox checked={s.directFilter} onChange={(e) => s.setDirectFilter(e.target.checked)}>
          Direct filter (prefix match)
        </Checkbox>
        <Checkbox checked={s.treeSort} onChange={(e) => s.setTreeSort(e.target.checked)}>
          Sort tree branches
        </Checkbox>
        <Checkbox
          checked={s.showFullNameInTable}
          onChange={(e) => s.setShowFullNameInTable(e.target.checked)}
        >
          Show full name in parameter table
        </Checkbox>
        <Checkbox
          checked={s.showRegisColumn}
          onChange={(e) => s.setShowRegisColumn(e.target.checked)}
        >
          Show registration column
        </Checkbox>
        <Checkbox
          checked={s.showSourceColumn}
          onChange={(e) => s.setShowSourceColumn(e.target.checked)}
        >
          Show source (var kind) column
        </Checkbox>
      </Space>
    </Modal>
  );
}
