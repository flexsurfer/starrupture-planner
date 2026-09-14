import { appIds } from '@/app/uklad/catalog';
import { useCallback, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { AddBuildingRequest } from '@/features/bases/types';
import { AddBuildingCardModal } from '@/features/bases/ui/modals';
import { LinkOutputModal } from '@/features/production-plan-modal/ui/LinkOutputModal';

export const AddInputButton: React.FC = () => {
    const runtime = useRuntime();
    const planning = useSubscription([appIds.subscriptions.BASES_MODE]) === 'planning';
    const valid = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY]);
    const selectedBaseId = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_ID]);
    const [showAddInputModal, setShowAddInputModal] = useState(false);

    const handleAddInputBuildings = useCallback((request: AddBuildingRequest) => {
        if (!selectedBaseId) return;

        if (request.linkedOutput) {
            runtime.dispatch([
                appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
                request.linkedOutput.baseId,
                request.linkedOutput.buildingId,
                request.buildingTypeId,
                request.name,
                request.description,
            ]);
            setShowAddInputModal(false);
            return;
        }

        runtime.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            selectedBaseId,
            request.buildingTypeId,
            'inputs',
            request.count,
            request.name,
            request.description,
            request.selectedItemId ?? null,
            request.ratePerMinute ?? null,
            request.linkedOutput ?? null,
        ]);
        setShowAddInputModal(false);
    }, [runtime, selectedBaseId]);

    return <>
        <button
            type="button"
            className="btn btn-sm btn-primary btn-outline h-8 min-h-8 shrink-0 gap-1 px-2 text-xs"
            onClick={() => setShowAddInputModal(true)}
            disabled={planning && !valid}
            title={planning && !valid ? 'Choose a production item and enter a plan name first' : undefined}
        >
            <span aria-hidden="true">+</span>{planning ? 'Add external item' : 'Add input'}
        </button>
        {showAddInputModal && planning && <LinkOutputModal isOpen showModeSwitch onClose={() => setShowAddInputModal(false)} onSelect={output => {
            runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, output.baseId, output.baseBuildingId]);
            setShowAddInputModal(false);
        }} />}
        {showAddInputModal && !planning && (
            <AddBuildingCardModal
                isOpen={showAddInputModal}
                sectionType="inputs"
                baseId={selectedBaseId || undefined}
                onClose={() => setShowAddInputModal(false)}
                onAdd={handleAddInputBuildings}
                requireItemConfiguration
            />
        )}
    </>;
};
