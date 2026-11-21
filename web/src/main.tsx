import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles/base.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/shop.css';
import './styles/panels.css';
import './styles/fx.css';
import './styles/extras.css';
import './styles/cartnote.css';
import './styles/scare.css';
import './styles/world.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
