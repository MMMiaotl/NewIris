/**
 * Collapsible wrapper for ConnectionBar — collapsed state persisted in UI preferences.
 */
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

interface ConnectionBarSectionProps {
  children: ReactNode;
}

export function ConnectionBarSection({ children }: ConnectionBarSectionProps) {
  const collapsed = useUiPreferencesStore((s) => s.connectionBarCollapsed);
  const setCollapsed = useUiPreferencesStore((s) => s.setConnectionBarCollapsed);

  return (
    <div className={`connection-bar-section${collapsed ? ' connection-bar-section--collapsed' : ''}`}>
      <button
        type="button"
        className="connection-bar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="connection-bar-panel"
      >
        {collapsed ? <RightOutlined /> : <DownOutlined />}
        <span>Connection</span>
      </button>
      {!collapsed && (
        <div id="connection-bar-panel" className="connection-bar-panel">
          {children}
        </div>
      )}
    </div>
  );
}
