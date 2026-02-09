import React, { useCallback } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import { EVENT_IDS } from '../../../../../state/event-ids';
import type { BaseInputItem } from '../../../types';
import { ItemImage } from '../../../../ui/ItemImage';
import { BuildingImage } from '../../../../ui/BuildingImage';

interface InputsSelectorData {
    inputItems: BaseInputItem[];
    selectedInputIds: string[];
}

export const InputsSelector: React.FC = () => {
    const { inputItems, selectedInputIds } = useSubscription<InputsSelectorData>([SUB_IDS.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA]);

    const handleInputToggle = useCallback((baseBuildingId: string) => {
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, baseBuildingId]);
    }, []);

    return (
        <div className="px-4 py-2 border-b border-base-300 flex-shrink-0 bg-base-200/50">
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-base-content/70">Select inputs</label>
                {inputItems.length === 0 ? (
                    <div className="alert alert-warning py-2 px-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs font-medium">
                            Add buildings to the Inputs section to provide materials for production
                        </span>
                    </div>
                ) : (
                    <div className="flex items-stretch gap-2 flex-wrap max-h-32 overflow-y-auto">
                        {inputItems.map((inputItem) => {
                            const isSelected = selectedInputIds.includes(inputItem.baseBuildingId);
                            const hasNameOrDescription = inputItem.name || inputItem.description;
                            return (
                                <div
                                    key={inputItem.baseBuildingId}
                                    onClick={() => handleInputToggle(inputItem.baseBuildingId)}
                                    className={`flex flex-col gap-1 border rounded-lg px-2 py-1 cursor-pointer transition-colors ${
                                        isSelected
                                            ? 'bg-primary/20 border-primary'
                                            : 'border-base-300 hover:bg-base-300/50'
                                    }`}
                                    title={`${inputItem.building.name}: ${inputItem.item.name} - ${inputItem.ratePerMinute}/min`}
                                >
                                    {hasNameOrDescription && (
                                        <div className="flex gap-2">
                                            <span className="text-xs font-semibold text-base-content w-1/2">{inputItem.name || ''}</span>
                                            <span className="text-xs text-base-content/70 w-1/2">{inputItem.description || ''}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-auto">
                                        <BuildingImage
                                            buildingId={inputItem.building.id}
                                            building={inputItem.building}
                                            size="small"
                                            className="w-4 h-4"
                                        />
                                        <ItemImage
                                            itemId={inputItem.item.id}
                                            item={inputItem.item}
                                            size="small"
                                            className="w-4 h-4"
                                        />
                                        <span className="text-xs font-medium">{inputItem.item.name}</span>
                                        <span className="text-xs text-base-content/60">{inputItem.ratePerMinute}/min</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
