import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import App from './App';
import { hydrateWorkspaceOnce } from './utils/workspacePersistence';
import './index.css';

hydrateWorkspaceOnce();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorBgLayout: '#f5f5f5',
          colorBgContainer: '#ffffff',
          colorBorder: '#e8e8e8',
          colorBorderSecondary: '#f0f0f0',
          borderRadius: 6,
          fontSize: 13,
        },
        components: {
          Tree: {
            titleHeight: 22,
          },
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
