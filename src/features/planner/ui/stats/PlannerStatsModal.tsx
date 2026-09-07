import { appIds } from '@/app/uklad/catalog';
import React, { useId, useState } from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import { BuildingImage, ItemImage } from '@/shared/ui';
import { getCategoryBadgeClass, getCategoryDisplayName } from '@/features/items/ui/hooks/useItemsData';

const STAT_TABS = ['buildings', 'items'] as const;

interface PlannerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Modal component that displays production flow statistics
 * Shows building counts, energy usage, and items used
 */
export const PlannerStatsModal: React.FC<PlannerStatsModalProps> = ({ isOpen, onClose }) => {
    // Get detailed stats from subscription
    const stats = useSubscription([appIds.subscriptions.PLANNER_STATS_DETAILED]);
    const [activeTab, setActiveTab] = useState<typeof STAT_TABS[number]>('buildings');
    const closeModal = () => {
        setActiveTab('buildings');
        onClose();
    };
    const tabId = useId();
    const itemCount = stats.sortedTypes.reduce((sum, type) => sum + (stats.itemsByType.get(type)?.length ?? 0), 0);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box w-[95vw] max-w-6xl max-h-[95vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                    <h3 className="text-lg lg:text-xl font-bold pr-4">Production Statistics</h3>
                    <button
                        className="btn btn-sm btn-circle btn-ghost flex-shrink-0"
                        onClick={closeModal}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>

                <div role="tablist" aria-label="Production statistics views" className="tabs tabs-border mb-4">
                    {STAT_TABS.map((tab, index) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            id={`${tabId}-${tab}-tab`}
                            aria-controls={`${tabId}-${tab}-panel`}
                            aria-selected={activeTab === tab}
                            tabIndex={activeTab === tab ? 0 : -1}
                            className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                            onKeyDown={(event) => {
                                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                                event.preventDefault();
                                const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? STAT_TABS.length - 1
                                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + STAT_TABS.length) % STAT_TABS.length;
                                setActiveTab(STAT_TABS[nextIndex]);
                                event.currentTarget.parentElement
                                    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
                            }}
                        >
                            {tab === 'buildings' ? `Buildings (${stats.totalBuildings})` : `Items (${itemCount})`}
                        </button>
                    ))}
                </div>


                {/* Buildings by Type */}
                <div
                    role="tabpanel"
                    id={`${tabId}-buildings-panel`}
                    aria-labelledby={`${tabId}-buildings-tab`}
                    hidden={activeTab !== 'buildings'}
                    tabIndex={0}
                    className="mb-6"
                >
                    <div className="flex flex-wrap items-center gap-2 mb-4 px-2 py-2 bg-base-200 rounded-lg">
                        <span className="text-sm font-semibold">Energy:</span>
                        <span className="text-base font-bold">⚡ {stats.totalEnergy.toFixed(0)}</span>
                        <span className="text-base font-bold">🔥 {stats.totalHotness.toFixed(0)}</span>
                    </div>
                    <div className="border border-base-300 rounded-lg overflow-hidden bg-base-100 shadow-sm">
                        <div className="overflow-y-auto max-h-[60vh] overflow-x-auto">
                            <table className="table table-zebra w-full">
                                <thead className="sticky top-0 bg-base-200 z-10">
                                    <tr>
                                        <th>Building</th>
                                        <th className="text-right">Count</th>
                                        <th className="text-right">Power</th>
                                        <th className="text-right">Heat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.buildingStats.map(building => (
                                        <tr key={building.buildingId}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <BuildingImage
                                                        buildingId={building.buildingId}
                                                        size="small"
                                                        className="w-8 h-8"
                                                    />
                                                    <span className="font-medium">{building.buildingName}</span>
                                                </div>
                                            </td>
                                            <td className="text-right font-semibold">
                                                {building.count}
                                            </td>
                                            <td className="text-right">
                                                ⚡ {building.totalPower.toFixed(0)}
                                            </td>
                                            <td className="text-right">
                                                🔥 {building.totalHeat.toFixed(0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Items Used */}
                <div
                    role="tabpanel"
                    id={`${tabId}-items-panel`}
                    aria-labelledby={`${tabId}-items-tab`}
                    hidden={activeTab !== 'items'}
                    tabIndex={0}
                    className="mb-6"
                >
                    <p className="mb-2 text-xs text-base-content/60">Required amounts per minute at the current production target.</p>
                    <div className="border border-base-300 rounded-lg p-3 overflow-y-auto max-h-[60vh] space-y-4 bg-base-100 shadow-sm">
                        {stats.sortedTypes.map(type => {
                            const typeItems = stats.itemsByType.get(type) || [];
                            if (typeItems.length === 0) return null;

                            return (
                                <div key={type} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`badge ${getCategoryBadgeClass(type)}`}>
                                            {getCategoryDisplayName(type)}
                                        </span>
                                        <span className="text-xs text-base-content/60">
                                            ({typeItems.length})
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 pl-2">
                                        {typeItems.map(item => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center max-w-full rounded-lg gap-3 px-3 py-2 ${getCategoryBadgeClass(item.type)}`}
                                            >
                                                <span className="shrink-0">
                                                    <ItemImage itemId={item.id} item={item} size="small" />
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">{item.name}</div>
                                                    <div className="text-sm font-semibold tabular-nums whitespace-nowrap">
                                                        {item.requiredRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/min
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="modal-action">
                    <button className="btn btn-primary btn-sm lg:btn-md" onClick={closeModal}>
                        Close
                    </button>
                </div>
            </div>
            {/* Backdrop */}
            <div className="modal-backdrop" onClick={closeModal}></div>
        </div>
    );
};
