import { Agentation } from 'agentation';

/** Development-only visual annotation toolbar. Never renders in production. */
export function AgentationToolbar() {
   if (!import.meta.env.DEV) return null;
   return <Agentation endpoint='http://localhost:4747' />;
}
