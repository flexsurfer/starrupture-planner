import React from 'react';
import type { FlowNode, Item } from '../core/types';
import { getItemName } from '../core/productionFlowBuilder';
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
            {/* Fractional count badge at bottom center */}
            {Math.ceil(node.buildingCount) > 1 && (
                <div className="text-xs font-semibold absolute top-[-8px] right-[-8px]">
                    <div className="badge badge-sm badge-secondary">
                        {Math.ceil(node.buildingCount)}
                    </div>
                </div>
            )}

            {/* Building count badge in center-right (link connection area) */}
            <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 z-50">
                <div className="badge badge-sm badge-primary">
                    x{node.buildingCount.toFixed(2)}
                </div>
            </div>

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

            {/* Item image and info inline */}
            <div className="flex items-center gap-2 justify-center mb-2">
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
                    <div className="text-xs leading-tight"
                        style={{ color: getItemColor(node.outputItem) }}>
                        {node.outputAmount.toFixed(1)}/min
                    </div>
                </div>
            </div>
            <div className="text-xs absolute bottom-0.5 right-0.5">
                ⚡{node.powerPerBuilding}
                🔥{node.heatPerBuilding}
            </div>
        </div>
    );
};