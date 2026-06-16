import { Modal, Typography } from 'antd';
import {
  PROJECT_AUTHOR,
  PROJECT_DESCRIPTION,
  PROJECT_NAME,
  PROJECT_VERSION,
} from '../../constants/projectInfo';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal title="About" open={open} onCancel={onClose} onOk={onClose} width={420} destroyOnHidden>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {PROJECT_NAME}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Version {PROJECT_VERSION}
      </Typography.Paragraph>
      <Typography.Paragraph>{PROJECT_DESCRIPTION}</Typography.Paragraph>
      <Typography.Text type="secondary">Author</Typography.Text>
      <Typography.Paragraph style={{ marginTop: 4 }}>{PROJECT_AUTHOR}</Typography.Paragraph>
    </Modal>
  );
}
