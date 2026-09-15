import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { AddInputButton } from './AddInputButton';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { AdvancedModeSwitch } from '@/features/bases/ui/components/AdvancedModeSwitch';
import { NavigationHeader } from '@/shared/ui/NavigationHeader';
import type { BaseDetailTab } from '@/features/bases/types';

export const ModalHeader: React.FC = () => {
    const runtime = useRuntime();
    const { isEditMode } = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA]);
    const base = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE]);
    const selectedTab = useSubscription([appIds.subscriptions.BASES_SELECTED_DETAIL_TAB]);
    const advanced = useSubscription([appIds.subscriptions.BASES_MODE]) !== 'planning';

    const { defaultName } = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES]);

    const handleClose = () => {
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
    };
    const goToBase = (tab: BaseDetailTab) => {
        handleClose();
        runtime.dispatch([appIds.events.BASES_SET_DETAIL_TAB, tab]);
    };
    const returnLabel = selectedTab === 'plans' ? 'Plans' : selectedTab === 'buildings' && advanced ? 'Buildings' : 'Production';

    return (
        <NavigationHeader title={isEditMode ? 'Edit Plan' : 'New Plan'}
            breadcrumbs={[
                { label: 'My Bases', onClick: () => {
                    handleClose();
                    runtime.dispatch([appIds.events.BASES_SET_SELECTED_BASE, null]);
                } },
                { label: base?.name || 'Base', onClick: () => goToBase('base') },
                { label: 'Plans', onClick: () => goToBase('plans') },
                { label: defaultName || 'New Plan' },
            ]}
            back={{ label: `Back to ${returnLabel}`, onClick: handleClose }}
            actions={<AdvancedModeSwitch />}>
            <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 sm:max-w-80">
                <input
                type="text"
                aria-label="Plan name"
                className="input input-bordered input-sm w-full text-base-content"
                value={defaultName}
                onChange={(event) => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, event.target.value])}
                placeholder="Enter plan name"
            />
            </div>
            <div className="ml-auto shrink-0">
                <AddInputButton />
            </div>
            </div>
        </NavigationHeader>
    );
};
