import { render } from 'preact';

import { StudyWidget } from './widget';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

render(<StudyWidget />, root);
