import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import type { LinkableOutputItem } from '@/features/bases/types';
import { ConnectionPickerModal } from '@/features/bases/ui/modals/ConnectionPickerModal';
import { AdvancedModeSwitch } from '@/features/bases/ui/components/AdvancedModeSwitch';
import { areConnectionTypesCompatible } from '@/features/bases/connections';
import type { ConnectionCardData } from '@/features/bases/ui/components/ConnectionCard';

interface LinkOutputModalProps {
    isOpen: boolean;
    showModeSwitch?: boolean;
    baseId?: string;
    planId?: string;
    itemId?: string;
    inputBuildingTypeId?: string;
    title?: string;
    currentBuilding?: ConnectionCardData;
    onClose: () => void;
    onSelect: (output: LinkableOutputItem) => void;
}

const EMPTY_LINKABLE_OUTPUTS: LinkableOutputItem[] = [];

export const LinkOutputModal: React.FC<LinkOutputModalProps> = ({ isOpen, onClose, onSelect, showModeSwitch = false, baseId, planId, itemId, inputBuildingTypeId, title, currentBuilding }) => {
    const { t } = useTranslation();
    const planning = useSubscription([appIds.subscriptions.BASES_MODE]) === 'planning';
    const outputs = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, baseId ?? null, planId ?? null, itemId ?? null]) || EMPTY_LINKABLE_OUTPUTS;
    const buildings = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);
    const compatibleOutputs = inputBuildingTypeId ? outputs.filter(output => areConnectionTypesCompatible(output.building, buildings[inputBuildingTypeId])) : outputs;
    return <ConnectionPickerModal isOpen={isOpen} direction="output" entries={compatibleOutputs}
        currentBaseId={baseId} title={title ?? (planning ? t('Add external item') : t('Link Output'))}
        currentBuilding={currentBuilding}
        headerAction={showModeSwitch ? <AdvancedModeSwitch /> : undefined}
        onSelect={onSelect} onClose={onClose} />;
};
