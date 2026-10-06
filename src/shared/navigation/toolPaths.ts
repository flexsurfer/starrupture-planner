import type { TabType } from '@/app/uklad/model';

export const toolPaths = {
    items: '/items/',
    recipes: '/recipes/',
    corporations: '/corporations/',
    planner: '/planner/',
    mybases: '/mybases/',
} as const satisfies Record<TabType, string>;

export const DEFAULT_TOOL_PATH = toolPaths.planner;
export const normalizePagePath = (pathname: string) => `${pathname.replace(/\/+$/, '')}/`;
export const findToolTab = (pathname: string): TabType | undefined =>
    (Object.keys(toolPaths) as TabType[]).find(tab => toolPaths[tab] === normalizePagePath(pathname));
