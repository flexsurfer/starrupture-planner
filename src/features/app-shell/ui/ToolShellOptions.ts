import type { ReactNode } from 'react';

/** Optional presentation supplied by the application embedding the tools. */
export interface ToolShellOptions {
    homePath?: string;
    footer?: ReactNode;
}
