/** Show Options dialog — legacy Iris ShowOptionsDlg parity (subset for web). */
import { Checkbox, Divider, Modal, Space, Typography } from 'antd';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';
import type { TreeLabelMode } from '../../utils/preferencesPersistence';

interface ShowOptionsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShowOptionsModal({ open, onClose }: ShowOptionsModalProps) {
  const {
    treeLabelMode,
    directFilter,
    showFullNameInTable,
    showRegisColumn,
    showSourceColumn,
    treeSort,
    setTreeLabelMode,
    setDirectFilter,
    setShowFullNameInTable,
    setShowRegisColumn,
    setShowSourceColumn,
    setTreeSort,
  } = useUiPreferencesStore();

  const treeMode = (mode: TreeLabelMode, label: string) => (
    <Checkbox
      checked={treeLabelMode === mode}
      onChange={() => setTreeLabelMode(mode)}
    >
      {label}
    </Checkbox>
  );

  return (
    <Modal title="Show Options" open={open} onCancel={onClose} onOk={onClose} width={420}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Tree variable labels
      </Typography.Text>
      <Space direction="vertical" style={{ margin: '8px 0 12px' }}>
        {treeMode('name', 'Name (A–Z)')}
        {treeMode('alias', 'Alias')}
        {treeMode('custom', 'Custom display name')}
      </Space>

      <Divider style={{ margin: '8px 0' }} />

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Filter &amp; list
      </Typography.Text>
      <Space direction="vertical" style={{ margin: '8px 0 12px' }}>
        <Checkbox checked={directFilter} onChange={(e) => setDirectFilter(e.target.checked)}>
          Direct filter (prefix match)
        </Checkbox>
        <Checkbox checked={treeSort} onChange={(e) => setTreeSort(e.target.checked)}>
          Sort tree branches
        </Checkbox>
        <Checkbox
          checked={showFullNameInTable}
          onChange={(e) => setShowFullNameInTable(e.target.checked)}
        >
          Show full name in parameter table
        </Checkbox>
        <Checkbox checked={showRegisColumn} onChange={(e) => setShowRegisColumn(e.target.checked)}>
          Show registration column
        </Checkbox>
        <Checkbox checked={showSourceColumn} onChange={(e) => setShowSourceColumn(e.target.checked)}>
          Show source (var kind) column
        </Checkbox>
      </Space>
    </Modal>
  );
}
