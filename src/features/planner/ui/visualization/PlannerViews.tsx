import { useId, useState, type ReactNode } from 'react';
import { PlannerFlowDiagram } from './PlannerFlowDiagram';
import { PlannerProductionTable } from './PlannerProductionTable';

const VIEWS = ['graph', 'table'] as const;

export const PlannerViews = ({ renderHeader }: { renderHeader?: (viewControl: ReactNode) => ReactNode }) => {
    const [activeView, setActiveView] = useState<typeof VIEWS[number]>(() => (
        typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches
            ? 'table'
            : 'graph'
    ));
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
            {renderHeader ? renderHeader(viewControl) : viewControl}
            <div className="relative isolate flex-1 min-h-0">
                {/* Keep both panels mounted and sized to preserve viewport and scroll state. */}
                {VIEWS.map(view => (
                    <div
                        key={view}
                        role="tabpanel"
                        id={`${id}-${view}-panel`}
                        aria-labelledby={`${id}-${view}-tab`}
                        aria-hidden={activeView !== view}
                        inert={activeView !== view}
                        className={`absolute inset-0 bg-base-100 ${activeView === view ? 'visible opacity-100 z-10' : 'invisible opacity-0 z-0 pointer-events-none'}`}
                    >
                        {view === 'graph' ? <PlannerFlowDiagram /> : <PlannerProductionTable />}
                    </div>
                ))}
            </div>
        </div>
    );
};
