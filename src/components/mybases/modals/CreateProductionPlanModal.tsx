import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import type { Item, Building } from '../../../state/db';
import type { ProductionPlanSection } from '../../../state/db';
import type { BaseInputItem } from '../types';
import { EmbeddedFlowDiagram } from '../components/EmbeddedFlowDiagram';
import { ItemImage } from '../../ui/ItemImage';
import { CorporationLevelSelector, type SelectedCorporationLevel } from '../../ui/CorporationLevelSelector';
import type { CorporationLevelInfo } from '../../planner';

// Workaround component for Reflex subscription bug - forces subscription recreation when selectedItemId changes
interface CorporationLevelsSubscriptionProps {
    selectedItemId: string;
    onLevelsChange: (levels: CorporationLevelInfo[]) => void;
}

const CorporationLevelsSubscription: React.FC<CorporationLevelsSubscriptionProps> = ({
    selectedItemId,
    onLevelsChange,
}) => {
    const corporationLevels = useSubscription<CorporationLevelInfo[]>([
        SUB_IDS.AVAILABLE_CORPORATION_LEVELS_FOR_ITEM,
        selectedItemId || ''
    ]);

    useEffect(() => {
        onLevelsChange(corporationLevels);
    }, [corporationLevels, onLevelsChange]);

    return null;
};

interface CreateProductionPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, selectedItemId: string, targetAmount: number, corporationLevel?: SelectedCorporationLevel | null) => void;
    onUpdate?: (sectionId: string, name: string, selectedItemId: string, targetAmount: number, corporationLevel?: SelectedCorporationLevel | null) => void;
    editSection?: ProductionPlanSection | null;
    baseId: string;
}

export const CreateProductionPlanModal: React.FC<CreateProductionPlanModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    onUpdate,
    editSection,
    baseId,
}) => {
    const [name, setName] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [targetAmount, setTargetAmount] = useState<number>(60);
    const [selectedCorporationLevel, setSelectedCorporationLevel] = useState<SelectedCorporationLevel | null>(null);
    const [corporationLevels, setCorporationLevels] = useState<CorporationLevelInfo[]>([]);

    // Get selectable items (non-raw items)
    const selectableItems = useSubscription<Item[]>([SUB_IDS.PLANNER_SELECTABLE_ITEMS]);
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
    const inputItems = useSubscription<BaseInputItem[]>([SUB_IDS.BASE_INPUT_ITEMS, baseId]);

    // Determine if we're in edit mode
    const isEditMode = !!editSection;

    // Initialize form when editing
    useEffect(() => {
        if (editSection) {
            setName(editSection.name);
            setSelectedItemId(editSection.selectedItemId);
            setTargetAmount(editSection.targetAmount);
            setSelectedCorporationLevel(editSection.corporationLevel || null);
        } else {
            setName('');
            setSelectedItemId('');
            setTargetAmount(60);
            setSelectedCorporationLevel(null);
        }
    }, [editSection, isOpen]);

    // Get default output rate for selected item
    const getDefaultOutputRate = useCallback((itemId: string): number => {
        for (const building of buildings) {
            for (const recipe of building.recipes || []) {
                if (recipe.output.id === itemId) {
                    return recipe.output.amount_per_minute;
                }
            }
        }
        return 60;
    }, [buildings]);

    // Handle item selection and set default target amount
    const handleItemSelect = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        // Reset corporation level when item changes
        setSelectedCorporationLevel(null);
        if (itemId) {
            const defaultRate = getDefaultOutputRate(itemId);
            setTargetAmount(defaultRate);
            
            // Auto-set plan name if empty
            if (!name.trim()) {
                const item = selectableItems.find(i => i.id === itemId);
                if (item) {
                    setName(`${item.name} Production`);
                }
            }
        }
    }, [getDefaultOutputRate, name, selectableItems]);

    // Get the selected item name for the title suggestion
    const selectedItemName = useMemo(() => {
        if (!selectedItemId) return '';
        const item = selectableItems.find(i => i.id === selectedItemId);
        return item?.name || '';
    }, [selectedItemId, selectableItems]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && selectedItemId && targetAmount > 0) {
            if (isEditMode && onUpdate && editSection) {
                onUpdate(editSection.id, name.trim(), selectedItemId, targetAmount, selectedCorporationLevel);
            } else {
                onCreate(name.trim(), selectedItemId, targetAmount, selectedCorporationLevel);
            }
            resetForm();
            onClose();
        }
    };

    const resetForm = () => {
        setName('');
        setSelectedItemId('');
        setTargetAmount(60);
        setSelectedCorporationLevel(null);
    };

    const handleCancel = () => {
        resetForm();
        onClose();
    };

    const isFormValid = name.trim() && selectedItemId && targetAmount > 0;

    return (
        <div className="modal modal-open">
            {/* Workaround component for subscription recreation */}
            <CorporationLevelsSubscription
                key={selectedItemId}
                selectedItemId={selectedItemId}
                onLevelsChange={setCorporationLevels}
            />
            <div className="fixed inset-0 flex flex-col bg-base-100 z-50">
                {/* Header with title and close button */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 flex-shrink-0">
                    <h3 className="font-bold text-base lg:text-lg">
                        {isEditMode ? 'Edit Production Plan' : 'Create Production Plan'}
                    </h3>
                    <button
                        type="button"
                        className="btn btn-xs btn-circle btn-ghost"
                        onClick={handleCancel}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Available Inputs section */}
                {inputItems.length > 0 && (
                    <div className="px-4 py-2 border-b border-base-300 flex-shrink-0 bg-base-200/50">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-base-content/70">Available Inputs:</span>
                            {inputItems.map(({ item, ratePerMinute }) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-1.5 bg-base-300 rounded-lg px-2 py-1"
                                    title={`${item.name} - ${ratePerMinute}/min`}
                                >
                                    <ItemImage
                                        itemId={item.id}
                                        item={item}
                                        size="small"
                                        className="w-4 h-4"
                                    />
                                    <span className="text-xs font-medium">{item.name}</span>
                                    <span className="text-xs text-base-content/60">{ratePerMinute}/min</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Controls section */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="px-4 py-2 border-b border-base-300 flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Plan Name */}
                            <div className="form-control flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    className="input input-bordered input-sm w-full"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={selectedItemName ? `${selectedItemName} Production` : 'Enter plan name'}
                                    required
                                />
                            </div>

                            {/* Item Selector */}
                            <div className="form-control flex-1 min-w-[200px]">
                                <select
                                    className="select select-bordered select-sm w-full"
                                    value={selectedItemId}
                                    onChange={(e) => handleItemSelect(e.target.value)}
                                    required
                                >
                                    <option value="">Choose an item to produce</option>
                                    {selectableItems.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Target Amount */}
                            <div className="form-control flex items-center gap-2 min-w-[120px]">
                                <input
                                    type="number"
                                    className="input input-bordered input-sm w-20"
                                    value={targetAmount}
                                    onChange={(e) => setTargetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                                    min={1}
                                    required
                                />
                                <span className="text-xs text-base-content/70 whitespace-nowrap">/min</span>
                            </div>

                            {/* Corporation Level Selector */}
                            <CorporationLevelSelector
                                corporationLevels={corporationLevels}
                                selectedLevel={selectedCorporationLevel}
                                onChange={setSelectedCorporationLevel}
                                targetAmount={targetAmount}
                                className="min-w-[200px]"
                            />
                        </div>
                    </div>

                    {/* Diagram section - takes all remaining space */}
                    <div className="flex-1 overflow-hidden relative min-h-0">
                        {selectedItemId ? (
                            <EmbeddedFlowDiagram
                                selectedItemId={selectedItemId}
                                targetAmount={targetAmount}
                                className="w-full h-full"
                                includeLauncher={selectedCorporationLevel !== null}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-base-content/50">
                                <div className="text-center">
                                    <div className="text-4xl mb-2">📐</div>
                                    <p>Select an item to preview the production flow</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action buttons at bottom */}
                    <div className="flex-shrink-0 p-4 border-t border-base-300 flex justify-end gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-sm btn-primary"
                            disabled={!isFormValid}
                        >
                            {isEditMode ? 'Save Changes' : 'Create Plan'}
                        </button>
                    </div>
                </form>

            </div>
            <div className="modal-backdrop" onClick={handleCancel}></div>
        </div>
    );
};
