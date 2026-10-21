import type { ComponentChildren } from 'preact';

/** Minimal tooltip wrapper: exposes the label via the native `title` attribute. */
function Tooltip({ label, children }: { label: string; children: ComponentChildren }) {
   return <span title={label}>{children}</span>;
}

export { Tooltip };
