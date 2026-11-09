import '@/lib/settings.css';
import { mountPopup } from '@/lib/popup';

const root = document.querySelector<HTMLElement>('#app');
if (root) mountPopup(root);
