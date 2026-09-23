import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import type { AddBuildingRequest } from '@/features/bases/types';
import { getRawResourceBuilding } from '@/features/bases/building-section';
import { AddBuildingCardModal } from '@/features/bases/ui/modals/AddBuildingCardModal';
import { ExternalInputModal } from '@/features/planner/ui/visualization/ExternalInputModal';
import { PACKAGE_RECEIVER_BUILDING_ID } from '@/constants/buildingIds';
import { LinkOutputSelector } from './LinkOutputSelector';

interface PlanInputModalProps {
    baseId: string | null;
    planId?: string;
    itemId: string;
    amount: number;
    onAdd: (request: AddBuildingRequest) => void;
    onClose: () => void;
}

export function PlanInputModal({ baseId, planId, itemId, amount, onAdd, onClose }: PlanInputModalProps) {
    const planning = useSubscription([appIds.subscriptions.BASES_MODE]) === 'planning';
    const items = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const buildings = useSubscription([appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'inputs']);
    const outputs = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, baseId, planId ?? null, itemId]);
    const [selectingTarget, setSelectingTarget] = useState(false);
    const item = items[itemId];
    const extractor = getRawResourceBuilding(buildings, itemId);
    const building = extractor ?? buildings.find(candidate => candidate.id === 'storage_depot_v1')
        ?? buildings.find(candidate => candidate.type === 'storage');

    if (!planning || !item || !building) {
        return <AddBuildingCardModal isOpen sectionType="inputs" baseId={baseId ?? undefined} planId={planId}
            initialItemId={itemId} initialRatePerMinute={amount} requireItemConfiguration onAdd={onAdd} onClose={onClose} />;
    }

    return <ExternalInputModal title="Add new input" item={item} building={selectingTarget ? undefined : building} initialAmount={amount}
        targetSelector={selectingTarget ? <LinkOutputSelector outputs={outputs} compact
            emptyMessage="No available targets found."
            onSelect={output => {
                onAdd({
                    buildingTypeId: PACKAGE_RECEIVER_BUILDING_ID, count: 1,
                    selectedItemId: output.item.id, ratePerMinute: output.ratePerMinute,
                    linkedOutput: { baseId: output.baseId, buildingId: output.baseBuildingId },
                });
                onClose();
            }} /> : undefined}
        onClose={onClose} onConfirm={ratePerMinute => {
            onAdd({ buildingTypeId: building.id, count: 1, selectedItemId: itemId, ratePerMinute });
            onClose();
        }}>
        {!extractor && (outputs.length > 0 || selectingTarget) && <div className="flex gap-2" role="group" aria-label="Input source">
            <button type="button" className={`btn btn-sm flex-1 ${selectingTarget ? 'btn-outline' : 'btn-primary'}`}
                aria-pressed={!selectingTarget} onClick={() => setSelectingTarget(false)}>Enter amount</button>
            <button type="button" className={`btn btn-sm flex-1 ${selectingTarget ? 'btn-primary' : 'btn-outline'}`}
                aria-pressed={selectingTarget} onClick={() => setSelectingTarget(true)}>Select target</button>
        </div>}
    </ExternalInputModal>;
}
