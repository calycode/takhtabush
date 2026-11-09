import '@/lib/settings.css';
import { mountSettings } from '@/lib/settings';

const root = document.querySelector<HTMLElement>('#app');
if (root) mountSettings(root);
