import type { Item, TargetFlowNode } from '@/features/planner/types';
import { ItemImage } from '@/shared/ui';
import { getItemName } from '@/utils/itemUtils';

export function TargetNodeCard({ node, items, outputColor, compactOnMobile = false }: {
    node: TargetFlowNode;
    items: Item[];
    outputColor: string;
    compactOnMobile?: boolean;
}) {
    return <div className={`relative text-center ${compactOnMobile ? 'p-1.5 pt-4 space-y-1 sm:p-2 sm:pt-4 sm:space-y-2' : 'p-2 pt-4 space-y-2'}`}>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded border border-primary/40 bg-base-200 px-1.5 text-[10px] leading-4 text-primary">Target</div>
        <div className={`font-normal leading-tight break-words ${compactOnMobile ? 'text-xs sm:text-base' : 'text-base'}`}>
            {getItemName(node.outputItem, items)}
        </div>
        <div className="flex items-center justify-center gap-1.5">
            <div className={`shrink-0 ${compactOnMobile ? 'max-sm:[&>div]:size-10 max-sm:[&_img]:size-10' : ''}`}>
                <ItemImage itemId={node.outputItem} size="medium" />
            </div>
            <div className={`min-w-0 font-semibold leading-tight break-words tabular-nums ${compactOnMobile ? 'text-lg sm:text-xl' : 'text-xl'}`} style={{ color: outputColor }} aria-label="Target amount per minute">
                {node.amount.toFixed(1)}<span className="block text-xs font-normal">/min</span>
            </div>
        </div>
    </div>;
}
