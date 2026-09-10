import { createUkladInspector } from '@ukladjs/core/devtools';
import { enableDevtools } from '@ukladjs/devtools';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from '@/platform/headless/register';

/** The long-lived Node runtime used for browserless MCP inspection and automation. */
export const runtime = createAppRuntime({
    runtimeId: 'starrupture-planner.headless',
    name: 'StarRupture Planner (Headless)',
});

registerHeadlessApplication(runtime);

enableDevtools(createUkladInspector(runtime), {
    effectMode: 'safe',
    effects: {
        [appIds.effects.setTheme]: 'no-op',
        [appIds.effects.loadGameData]: 'bundled-filesystem',
    },
    operations: { evidence: { stateChanges: 'patches' } },
});

runtime.dispatch([appIds.events.APP_INIT]);
