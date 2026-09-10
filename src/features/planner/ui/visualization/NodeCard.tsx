import React from 'react';
import type { FlowNode, Item } from '@/features/planner/types';
import { getItemName } from '@/utils/itemUtils';
import { ItemImage, BuildingImage, RecipeTypeIcon } from '@/shared/ui';
import { NodeRecipeButton } from './NodeRecipeButton';

interface NodeCardProps {
    node: FlowNode;
    items: Item[];
    outputColor: string;
    compactOnMobile?: boolean;
    onSelectRecipe?: (itemId: string, recipeKey: string) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
    node,
    items,
    outputColor,
    compactOnMobile = false,
    onSelectRecipe,
}) => {
    const item = items.find(({ id }) => id === node.outputItem);
    const buildingCount = Math.ceil(node.buildingCount);
    const usedRate = node.outputAmount * node.buildingCount;
    // Input nodes expose their source's available rate; production uses whole buildings.
    const availableRate = node.outputAmount * (node.nodeType === 'input' ? 1 : buildingCount);
    const usagePercent = availableRate > 0 ? Math.min(100, Math.max(0, usedRate / availableRate * 100)) : 0;
    const usageLabel = `${Number(usagePercent.toFixed(1))}% used`;
    const usageDescription = `${usedRate.toFixed(1)} of ${availableRate.toFixed(1)}/min used`;

    return (
        <div className="flex h-full flex-col text-center">
            <div className="absolute top-[-8px] right-[-8px] flex items-center gap-1">
                {node.nodeType === 'input' && <div className="badge badge-sm badge-success">input</div>}
            </div>

            {/* Item and final output are the primary information. */}
            <div className={compactOnMobile ? 'p-1.5 space-y-1 sm:p-2 sm:space-y-2' : 'p-2 space-y-2'}>
                <div className="flex items-start justify-between gap-1.5">
                    <div className={`min-w-0 flex-1 font-normal leading-tight break-words ${compactOnMobile ? 'text-xs sm:text-base' : 'text-base'}`}>
                        {getItemName(node.outputItem, items)}
                    </div>
                    {item && <NodeRecipeButton item={item} node={node} onSelectRecipe={node.nodeType === 'input' ? undefined : onSelectRecipe} />}
                </div>
                <div className="relative flex items-center justify-center gap-1.5">
                    {node.recipeType && <RecipeTypeIcon recipeType={node.recipeType} className="absolute left-0 top-1/2 -translate-y-1/2 z-10" />}
                    <div className={`shrink-0 ${compactOnMobile ? 'max-sm:[&>div]:size-10 max-sm:[&_img]:size-10' : ''}`}>
                        <ItemImage itemId={node.outputItem} size="medium" />
                    </div>
                    <div className={`min-w-0 font-semibold leading-tight break-words tabular-nums ${compactOnMobile ? 'text-lg sm:text-xl' : 'text-xl'}`} style={{ color: outputColor }} aria-label="Total output per minute">
                        {usedRate.toFixed(1)}<span className="block text-xs font-normal">/min</span>
                    </div>
                </div>
            </div>

            <div
                className="mt-auto shrink-0"
                role="meter"
                aria-label="Resource capacity used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={usagePercent}
                aria-valuetext={`${usageLabel}: ${usageDescription}`}
                title={usageDescription}
            >
                <div className="flex items-center justify-between gap-1 px-2 pb-1 text-[10px] leading-tight text-base-content/60 tabular-nums">
                    <span>Capacity</span>
                    <span>{usageLabel}</span>
                </div>
                <div className="h-1 w-full overflow-hidden bg-base-content/10">
                    <div className="h-full" style={{ width: `${usagePercent}%`, backgroundColor: outputColor }} />
                </div>
            </div>

            {/* Building details stay secondary, below the item. */}
            <div className={`shrink-0 bg-base-content/5 rounded-b ${compactOnMobile ? 'p-1.5 sm:p-2' : 'p-2'}`}>
                <div className={`mb-1 leading-tight text-base-content/60 break-words ${compactOnMobile ? 'text-[11px] sm:text-sm' : 'text-sm'}`}>{node.buildingName}</div>
                <div className="flex items-center gap-1.5">
                    <BuildingImage buildingId={node.buildingId} size="small" className={`!w-8 !h-8 shrink-0 ${compactOnMobile ? 'max-sm:!w-6 max-sm:!h-6' : ''}`} />
                    <div className="min-w-0 flex-1 text-left text-[10px] leading-tight break-words space-y-0.5">
                        <div className={`${compactOnMobile ? 'text-[10px] sm:text-xs' : 'text-xs'} text-base-content/55`}>{node.outputAmount.toFixed(1)}/min</div>
                    </div>
                    <span className={`shrink-0 rounded border py-0.5 font-semibold ${compactOnMobile ? 'px-1 text-xs sm:px-1.5 sm:text-sm' : 'px-1.5 text-sm'} ${buildingCount > 1 ? 'border-secondary/40 bg-secondary/15 text-secondary' : 'border-base-content/15 text-base-content/75'}`} title={`${buildingCount} buildings required`}>
                        ×{buildingCount}
                    </span>
                </div>
            </div>
        </div>
    );
};
