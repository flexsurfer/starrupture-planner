import React from 'react';
import type { FlowNode, Item } from '../core/types';
import { getItemName } from '../../../utils/itemUtils';
import { ItemImage, BuildingImage } from '../../ui';

interface NodeCardProps {
    node: FlowNode;
    items: Item[];
    getItemColor: (itemId: string) => string;
}

export const NodeCard: React.FC<NodeCardProps> = ({
    node,
    items,
    getItemColor
}) => {
    return (
        <div className="text-center p-2">
            {/* Custom input badge */}
            {node.isCustomInput && (
                <div className="text-xs font-semibold absolute top-[-8px] left-[-8px]">
                    <div className="badge badge-sm badge-success">
                        input
                    </div>
                </div>
            )}

            {/* Fractional count badge at bottom center */}
            {Math.ceil(node.buildingCount) > 1 && (
                <div className="text-xs font-semibold absolute top-[-8px] right-[-8px]">
                    <div className="badge badge-sm badge-secondary">
                        {Math.ceil(node.buildingCount)}
                    </div>
                </div>
            )}

            {/* Building information */}
            <div className="text-xs font-semibold mb-1">
                {node.buildingName}
            </div>

            {/* Building icon */}
            <div className="flex items-center gap-2 justify-center">
                <BuildingImage
                    buildingId={node.buildingId}
                    className="w-19 h-19 rounded-full object-cover"
                    size="medium"
                />
            </div>

            {/* Item image with per-building rate */}
            <div className="flex items-center gap-1.5 justify-center">
                <div className="relative flex-shrink-0">
                    <ItemImage
                        itemId={node.outputItem}
                        size="small"
                    />
                </div>
                <div className="text-left">
                    <div className="text-xs opacity-75 leading-tight">
                        {getItemName(node.outputItem, items)}
                    </div>
                    <div className="text-xs leading-tight">
                        {node.outputAmount.toFixed(1)}/min
                    </div>
                </div>
            </div>

            {/* Buildings count and total production */}
            <div className="text-xs mt-3 mb-2 leading-tight opacity-85">
                <span >&times;{(Math.floor(node.buildingCount * 10) / 10).toFixed(1)}</span>
                <span className="opacity-60 mx-0.5">=</span>
                <span className="font-xs font-medium" style={{ color: getItemColor(node.outputItem) }}>
                    {(node.outputAmount * node.buildingCount).toFixed(1)}/min
                </span>
            </div>

            <div className="text-xs absolute bottom-0.5 right-0.5">
                ⚡{node.powerPerBuilding}
                🔥{node.heatPerBuilding}
            </div>
        </div>
    );
};