import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/features/app-shell/ui/AppProviders';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <AppProviders><App /></AppProviders>,
);
