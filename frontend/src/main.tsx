import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorBgLayout: '#f0f0f0' },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);
