import React, { useMemo } from 'react';
import type { FlowNode, FlowEdge, Item } from '../core/types';
import { BuildingImage } from '../../ui/BuildingImage';
import { ItemImage } from '../../ui/ItemImage';
import { getItemName } from '../core/productionFlowBuilder';
import { getCategoryBadgeClass, getCategoryDisplayName } from '../../items/useItemsData';

interface PlannerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: FlowNode[];
    edges: FlowEdge[];
    items: Item[];
}

interface BuildingStats {
    buildingId: string;
    buildingName: string;
    count: number;
    totalPower: number;
    totalHeat: number;
}

/**
 * Modal component that displays production flow statistics
 * Shows building counts, energy usage, and items used
 */
export const PlannerStatsModal: React.FC<PlannerStatsModalProps> = ({
    isOpen,
    onClose,
    nodes,
    edges,
    items
}) => {
    // Calculate statistics from flow data
    const stats = useMemo(() => {
        // Group buildings by type and sum counts
        const buildingMap = new Map<string, BuildingStats>();
        
        nodes.forEach(node => {
            const existing = buildingMap.get(node.buildingId);
            if (existing) {
                existing.count += Math.ceil(node.buildingCount);
                existing.totalPower += node.totalPower;
                existing.totalHeat += node.totalHeat;
            } else {
                buildingMap.set(node.buildingId, {
                    buildingId: node.buildingId,
                    buildingName: node.buildingName,
                    count: Math.ceil(node.buildingCount),
                    totalPower: node.totalPower,
                    totalHeat: node.totalHeat
                });
            }
        });

        // Convert map to sorted array
        const buildingStats = Array.from(buildingMap.values())
            .sort((a, b) => b.count - a.count);

        // Calculate total energy (sum of all totalPower)
        const totalEnergy = nodes.reduce((sum, node) => sum + node.totalPower, 0);

        // Calculate total hotness (sum of all totalHeat)
        const totalHotness = nodes.reduce((sum, node) => sum + node.totalHeat, 0);

        // Calculate total buildings (sum of all buildingCount, rounded up)
        const totalBuildings = nodes.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0);

        // Collect all unique items used
        const itemsUsed = new Set<string>();
        
        // Add items from nodes (output items)
        nodes.forEach(node => {
            itemsUsed.add(node.outputItem);
        });
        
        // Add items from edges (transferred items)
        edges.forEach(edge => {
            itemsUsed.add(edge.itemId);
        });

        // Convert to array with item data and group by type
        const itemsWithData = Array.from(itemsUsed)
            .map(itemId => {
                const item = items.find(i => i.id === itemId);
                return {
                    id: itemId,
                    name: getItemName(itemId, items),
                    type: item?.type || 'unknown'
                };
            });

        // Group items by type
        const itemsByType = new Map<string, typeof itemsWithData>();
        itemsWithData.forEach(item => {
            const type = item.type;
            if (!itemsByType.has(type)) {
                itemsByType.set(type, []);
            }
            itemsByType.get(type)!.push(item);
        });

        // Sort items within each type by name
        itemsByType.forEach((itemsList) => {
            itemsList.sort((a, b) => a.name.localeCompare(b.name));
        });

        // Sort types in a specific order
        const typeOrder = ['raw', 'processed', 'component', 'ammo', 'final'];
        const sortedTypes = Array.from(itemsByType.keys()).sort((a, b) => {
            const indexA = typeOrder.indexOf(a);
            const indexB = typeOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return {
            buildingStats,
            totalEnergy,
            totalHotness,
            totalBuildings,
            itemsByType,
            sortedTypes
        };
    }, [nodes, edges, items]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl max-h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                    <h3 className="text-lg lg:text-xl font-bold pr-4">Production Statistics</h3>
                    <button 
                        className="btn btn-sm btn-circle btn-ghost flex-shrink-0" 
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="flex items-center gap-4 mb-4 px-2 py-2 bg-base-200 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Buildings:</span>
                        <span className="text-base font-bold">{stats.totalBuildings}</span>
                    </div>
                    <div className="divider divider-horizontal"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Energy:</span>
                        <span className="text-base font-bold">⚡ {stats.totalEnergy.toFixed(0)}</span>
                        <span className="text-base font-bold">🔥 {stats.totalHotness.toFixed(0)}</span>
                    </div>
                </div>

                {/* Buildings by Type */}
                <div className="mb-6">
                    <div className="border border-base-300 rounded-lg overflow-hidden bg-base-100 shadow-sm">
                        <div className="overflow-y-scroll max-h-60 overflow-x-auto">
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
                <div className="mb-6">
                    <h4 className="text-md font-semibold mb-3">
                        Items Used ({stats.sortedTypes.reduce((sum, type) => sum + (stats.itemsByType.get(type)?.length || 0), 0)})
                    </h4>
                    <div className="border border-base-300 rounded-lg p-3 overflow-y-scroll max-h-40 space-y-4 bg-base-100 shadow-sm">
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
                                    <div className="flex flex-wrap gap-2 pl-2">
                                        {typeItems.map(item => (
                                            <div
                                                key={item.id}
                                                className={`badge badge-sm gap-1.5 px-2 py-1 ${getCategoryBadgeClass(item.type)}`}
                                            >
                                                <ItemImage
                                                    itemId={item.id}
                                                    size="small"
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-xs">{item.name}</span>
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
                    <button className="btn btn-primary btn-sm lg:btn-md" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
            {/* Backdrop */}
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
};
