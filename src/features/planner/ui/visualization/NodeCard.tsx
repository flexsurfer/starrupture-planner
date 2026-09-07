import React from 'react';
import type { FlowNode, Item } from '@/features/planner/types';
import { getItemName } from '@/utils/itemUtils';
import { ItemImage, BuildingImage, RecipeTypeIcon } from '@/shared/ui';
import { NodeRecipeButton } from './NodeRecipeButton';

interface NodeCardProps {
    node: FlowNode;
    items: Item[];
    outputColor: string;
}

export const NodeCard: React.FC<NodeCardProps> = ({
    node,
    items,
    outputColor
}) => {
    const item = items.find(({ id }) => id === node.outputItem);
    return (
        <div className="flex h-full flex-col text-center">
            <div className="absolute top-[-8px] left-[-8px] flex items-center gap-1">
                {node.nodeType === 'input' && <div className="badge badge-sm badge-success">input</div>}
                {node.recipeType && <RecipeTypeIcon recipeType={node.recipeType} />}
            </div>

            {/* Item and final output are the primary information. */}
            <div className="p-2 space-y-2">
                <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1 text-base font-normal leading-tight break-words">
                        {getItemName(node.outputItem, items)}
                    </div>
                    {item && <NodeRecipeButton item={item} node={node} />}
                </div>
                <div className="flex items-center justify-center gap-1.5">
                    <div className="shrink-0">
                        <ItemImage itemId={node.outputItem} size="medium" />
                    </div>
                    <div className="min-w-0 text-xl font-semibold leading-tight break-words tabular-nums" style={{ color: outputColor }} aria-label="Total output per minute">
                        {(node.outputAmount * node.buildingCount).toFixed(1)}<span className="block text-xs font-normal">/min</span>
                    </div>
                </div>
            </div>

            {/* Building details stay secondary, below the item. */}
            <div className="mt-auto border-t border-base-content/10 bg-base-content/5 rounded-b p-2">
                <div className="mb-1 text-sm leading-tight text-base-content/60 break-words">{node.buildingName}</div>
                <div className="flex items-center gap-1.5">
                    <BuildingImage buildingId={node.buildingId} size="small" className="!w-8 !h-8 shrink-0" />
                    <div className="min-w-0 flex-1 text-left text-[10px] leading-tight break-words space-y-0.5">
                        <div className="text-xs text-base-content/55">{node.outputAmount.toFixed(1)}/min</div>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-sm font-semibold ${Math.ceil(node.buildingCount) > 1 ? 'border-secondary/40 bg-secondary/15 text-secondary' : 'border-base-content/15 text-base-content/75'}`} title={`${Math.ceil(node.buildingCount)} buildings required`}>
                        ×{Math.ceil(node.buildingCount)}
                    </span>
                </div>
            </div>
        </div>
    );
};
