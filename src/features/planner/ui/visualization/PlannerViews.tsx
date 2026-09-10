import { useId, type ReactNode } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { PlannerFlowDiagram } from './PlannerFlowDiagram';
import { PlannerProductionTable } from './PlannerProductionTable';

const VIEWS = ['graph', 'table'] as const;

export const PlannerViews = ({ renderHeader }: { renderHeader?: () => ReactNode }) => {
    const mode = useSubscription([appIds.subscriptions.PLANNER_MODE]);
    const warning = useSubscription([appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING]);
    const calculationPaused = mode === 'multi' && warning !== null;
    const runtime = useRuntime();
    const activeView = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_VIEW]);
    const setActiveView = (view: typeof VIEWS[number]) => runtime.dispatch([appIds.events.PLANNER_SET_ACTIVE_VIEW, view]);
    const id = useId();

    const viewControl = (
            <div role="tablist" aria-label="Planner views" className="join inline-flex w-fit shrink-0 rounded-md border border-base-300 bg-base-100">
                {VIEWS.map((view, index) => (
                    <button
                        key={view}
                        type="button"
                        role="tab"
                        id={`${id}-${view}-tab`}
                        aria-controls={`${id}-${view}-panel`}
                        aria-selected={activeView === view}
                        tabIndex={activeView === view ? 0 : -1}
                        className={`join-item btn btn-sm border-0 px-3 text-xs ${activeView === view ? 'bg-base-300 text-base-content' : 'btn-ghost text-base-content/60'}`}
                        onClick={() => setActiveView(view)}
                        onKeyDown={(event) => {
                            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                            event.preventDefault();
                            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
                            setActiveView(VIEWS[next]);
                            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                        }}
                    >
                        {view === 'graph' ? 'Graph' : 'Table'}
                    </button>
                ))}
            </div>
    );

    return (
        <div className="h-full min-h-0 flex flex-col">
            {renderHeader?.()}
            <div className="relative isolate flex-1 min-h-0">
                <div className="absolute left-2 top-2 z-20 shadow">{viewControl}</div>
                {/* Keep both panels mounted and sized to preserve viewport and scroll state. */}
                {VIEWS.map(view => (
                    <div
                        key={view}
                        role="tabpanel"
                        id={`${id}-${view}-panel`}
                        aria-labelledby={`${id}-${view}-tab`}
                        aria-hidden={activeView !== view}
                        inert={activeView !== view}
                        className={`absolute inset-0 bg-base-100 ${view === 'table' ? 'pt-14' : ''} ${activeView === view ? 'visible opacity-100 z-10' : 'invisible opacity-0 z-0 pointer-events-none'}`}
                    >
                        {calculationPaused ? <div className="flex h-full items-center justify-center p-4 text-base-content/70">
                            Resolve the target warning to calculate production.
                        </div> : view === 'graph' ? <PlannerFlowDiagram /> : <PlannerProductionTable />}
                    </div>
                ))}
            </div>
        </div>
    );
};
