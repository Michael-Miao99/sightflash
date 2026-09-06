import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { applyBootTheme } from './ui/themes';

applyBootTheme(); // 首帧底色（JS 先于首帧 → 无闪变）

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
