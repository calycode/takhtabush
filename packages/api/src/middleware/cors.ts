import { createCors } from '@caly/worker-kit';

/** Origins allowed to call the API from a browser during development. */
export const corsMiddleware = createCors(['http://localhost:5173', 'http://127.0.0.1:5173']);
