import { appIds } from '@/app/uklad/catalog';
import React, { useMemo, useState } from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import type { Building, Item } from '@/app/uklad/model';
import type { AddBuildingRequest, BuildingSectionType, LinkableOutputItem, LinkedInputReference } from '@/features/bases/types';
import { BuildingImage, ClippedSelect, ItemImage } from '@/shared/ui';
import { isLogisticsExcludedOutputBuildingId, isRawExtractor } from '@/features/bases/building-section';
import { MAX_BULK_BUILDING_COUNT, sanitizeBulkBuildingCount } from '@/features/bases/building-counts';
import {
  DRONE_MERGER_3_TO_1_BUILDING_ID,
  ORBITAL_CARGO_LAUNCHER_BUILDING_ID,
  ORBITAL_CARGO_LAUNCHER_TIER_2_BUILDING_ID,
  PACKAGE_DISPATCHER_BUILDING_ID,
  PACKAGE_RECEIVER_BUILDING_ID,
} from '../../../constants/buildingIds';
import { getDefaultOutputCapacityPerMinute } from '../../../utils/planOutputAllocations';
import { SelectItemModal } from './SelectItemModal';
import { LinkOutputModal } from './LinkOutputModal';

interface AddBuildingCardModalProps {
  isOpen: boolean;
  sectionType: BuildingSectionType;
  baseId?: string;
  onClose: () => void;
  onAdd: (request: AddBuildingRequest) => void;
  requireItemConfiguration?: boolean;
}

type ConfigurationMode = 'manual' | 'linked' | 'plan';

interface ConfigurationModeOption {
  mode: ConfigurationMode;
  label: string;
  detail: string;
  isAvailable: boolean;
  onSelect: () => void;
}

interface LinkableInputTarget extends LinkedInputReference {
  key: string;
  baseName: string;
  building: Building;
  name: string;
  item?: Item;
  ratePerMinute?: number;
  linkedOutputLabel?: string;
}

type BuildingGroupId =
  | 'extractors'
  | 'launchers'
  | 'transport'
  | 'storage'
  | 'production'
  | 'generators'
  | 'amplifiers'
  | 'habitats'
  | 'defense'
  | 'other';

interface BuildingGroup {
  id: BuildingGroupId;
  label: string;
  buildings: Building[];
}

const BUILDING_GROUP_LABELS: Record<BuildingGroupId, string> = {
  extractors: 'Extractors',
  launchers: 'Launchers',
  transport: 'Transport',
  storage: 'Storage',
  production: 'Production',
  generators: 'Generators',
  amplifiers: 'Amplifiers',
  habitats: 'Habitats',
  defense: 'Defense',
  other: 'Other',
};

const SECTION_GROUP_ORDER: Record<BuildingSectionType, BuildingGroupId[]> = {
  inputs: ['extractors', 'transport', 'storage', 'other'],
  outputs: ['launchers', 'transport', 'storage', 'other'],
  production: ['production', 'storage', 'other'],
  energy: ['generators', 'amplifiers', 'other'],
  infrastructure: ['habitats', 'defense', 'transport', 'other'],
};

const LAUNCHER_BUILDING_IDS = new Set([
  ORBITAL_CARGO_LAUNCHER_BUILDING_ID,
  ORBITAL_CARGO_LAUNCHER_TIER_2_BUILDING_ID,
]);

const TRANSPORT_BUILDING_IDS = new Set([
  DRONE_MERGER_3_TO_1_BUILDING_ID,
  PACKAGE_DISPATCHER_BUILDING_ID,
  PACKAGE_RECEIVER_BUILDING_ID,
]);

function getBuildingGroupId(building: Building, sectionType: BuildingSectionType): BuildingGroupId {
  if (sectionType === 'inputs') {
    if (isRawExtractor(building)) return 'extractors';
    if (building.type === 'storage') return 'storage';
    if (building.type === 'transport' || TRANSPORT_BUILDING_IDS.has(building.id)) return 'transport';
    return 'other';
  }

  if (sectionType === 'outputs') {
    if (LAUNCHER_BUILDING_IDS.has(building.id)) return 'launchers';
    if (building.type === 'storage') return 'storage';
    if (building.type === 'transport' || TRANSPORT_BUILDING_IDS.has(building.id)) return 'transport';
    return 'other';
  }

  if (sectionType === 'production') {
    if (building.type === 'storage') return 'storage';
    if (building.type === 'production') return 'production';
    return 'other';
  }

  if (sectionType === 'energy') {
    if (building.type === 'generator') return 'generators';
    if (building.type === 'temperature') return 'amplifiers';
    return 'other';
  }

  if (sectionType === 'infrastructure') {
    if (building.type === 'habitat') return 'habitats';
    if (building.type === 'defense') return 'defense';
    if (building.type === 'transport') return 'transport';
    return 'other';
  }

  return 'other';
}

function groupBuildingsForSection(buildings: Building[], sectionType: BuildingSectionType): BuildingGroup[] {
  const groups = new Map<BuildingGroupId, Building[]>();

  for (const building of buildings) {
    const groupId = getBuildingGroupId(building, sectionType);
    const groupBuildings = groups.get(groupId) || [];
    groupBuildings.push(building);
    groups.set(groupId, groupBuildings);
  }

  return SECTION_GROUP_ORDER[sectionType]
    .filter((groupId) => groups.has(groupId))
    .map((groupId) => ({
      id: groupId,
      label: BUILDING_GROUP_LABELS[groupId],
      buildings: groups.get(groupId) || [],
    }));
}

export const AddBuildingCardModal: React.FC<AddBuildingCardModalProps> = ({
  isOpen,
  sectionType,
  baseId,
  onClose,
  onAdd,
  requireItemConfiguration = false,
}) => {
  const buildings = useSubscription([appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, sectionType]);
  const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const buildingsById = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);
  const subscribedBases = useSubscription([appIds.subscriptions.BASES_LIST]);
  const selectedBase = useSubscription(
    baseId ? [appIds.subscriptions.BASES_BASE_BY_ID, baseId] : [appIds.subscriptions.BASES_SELECTED_BASE]
  );
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [count, setCount] = useState('1');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [ratePerMinute, setRatePerMinute] = useState('');
  const [selectedLinkedOutput, setSelectedLinkedOutput] = useState<LinkableOutputItem | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [capacityPerMinute, setCapacityPerMinute] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedLinkedInputKey, setSelectedLinkedInputKey] = useState('');
  const [configurationMode, setConfigurationMode] = useState<ConfigurationMode>('manual');
  const [showSelectItemModal, setShowSelectItemModal] = useState(false);
  const [showLinkOutputModal, setShowLinkOutputModal] = useState(false);

  const plans = selectedBase?.productions || [];
  const supportsItemConfiguration = sectionType === 'inputs' || sectionType === 'outputs';
  const mustConfigureItem = supportsItemConfiguration && requireItemConfiguration;
  const selectedItem = selectedItemId ? itemsById[selectedItemId] || null : null;
  const selectedPlan = selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) || null : null;
  const supportsCount = sectionType === 'production' || sectionType === 'energy';
  const selectedBuildingSupportsCount = !!selectedBuilding && supportsCount;
  const selectedBuildingSupportsLinking = !!selectedBuilding && sectionType === 'inputs' && !isRawExtractor(selectedBuilding);
  const selectedBuildingSupportsPlanLinking = !!selectedBuilding && sectionType === 'outputs' && plans.length > 0;
  const selectedBuildingSupportsInputTargets = !!selectedBuilding &&
    sectionType === 'outputs' &&
    !isLogisticsExcludedOutputBuildingId(selectedBuilding.id);
  const linkableInputTargets = useMemo<LinkableInputTarget[]>(() => {
    const allBases = subscribedBases || [];
    const targets: LinkableInputTarget[] = [];

    for (const base of allBases) {
      for (const input of base.buildings) {
        if (input.sectionType !== 'inputs') continue;

        const inputBuilding = buildingsById[input.buildingTypeId];
        if (!inputBuilding || isRawExtractor(inputBuilding)) continue;

        const itemId = input.selectedItemId || input.linkedOutput?.itemIdSnapshot;
        const item = itemId ? itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' } : undefined;
        const linkedBase = input.linkedOutput
          ? allBases.find((candidate) => candidate.id === input.linkedOutput?.baseId)
          : undefined;
        const linkedOutput = linkedBase && input.linkedOutput
          ? linkedBase.buildings.find((candidate) => candidate.id === input.linkedOutput?.buildingId)
          : undefined;
        const linkedOutputBuilding = linkedOutput
          ? buildingsById[linkedOutput.buildingTypeId]
          : undefined;
        const linkedOutputLabel = input.linkedOutput
          ? `${linkedBase?.name || 'Missing base'} / ${linkedOutput?.name || linkedOutputBuilding?.name || input.linkedOutput.buildingId}`
          : undefined;

        targets.push({
          key: `${base.id}:${input.id}`,
          baseId: base.id,
          buildingId: input.id,
          baseName: base.name,
          building: inputBuilding,
          name: input.name || inputBuilding.name,
          item,
          ratePerMinute: input.ratePerMinute || input.linkedOutput?.ratePerMinuteSnapshot,
          linkedOutputLabel,
        });
      }
    }

    return targets.sort((left, right) => {
      const currentBaseDelta = Number(right.baseId === selectedBase?.id) - Number(left.baseId === selectedBase?.id);
      if (currentBaseDelta !== 0) return currentBaseDelta;
      const baseDelta = left.baseName.localeCompare(right.baseName);
      if (baseDelta !== 0) return baseDelta;
      return left.name.localeCompare(right.name);
    });
  }, [subscribedBases, buildingsById, itemsById, selectedBase?.id]);
  const selectedLinkedInputTarget = selectedLinkedInputKey
    ? linkableInputTargets.find((target) => target.key === selectedLinkedInputKey) || null
    : null;
  const selectedPlanLabel = selectedPlan?.name || 'Select plan';
  const selectedLinkedInputLabel = selectedLinkedInputTarget
    ? `${selectedLinkedInputTarget.baseName} / ${selectedLinkedInputTarget.name}`
    : 'No target';
  const buildingGroups = useMemo(
    () => groupBuildingsForSection(buildings, sectionType),
    [buildings, sectionType]
  );

  if (!isOpen) {
    return null;
  }

  const resetItemAndLinkState = () => {
    setSelectedItemId('');
    setRatePerMinute('');
    setSelectedLinkedOutput(null);
    setSelectedPlanId('');
    setCapacityPerMinute('');
    setPriority('');
    setSelectedLinkedInputKey('');
    setConfigurationMode('manual');
  };

  const getDefaultPriorityForPlan = (planId: string): number => {
    if (!selectedBase || !planId) return 0;
    return selectedBase.buildings.filter((building) =>
      building.sectionType === 'outputs' &&
      building.sourceProductionId === planId
    ).length;
  };

  const getDefaultCapacityForSelectedBuilding = (): string => {
    if (!selectedBuilding) return '';
    const defaultCapacity = getDefaultOutputCapacityPerMinute(selectedBuilding.id);
    return defaultCapacity ? String(defaultCapacity) : '';
  };

  const handleBuildingClick = (building: Building) => {
    if (selectedBuilding?.id === building.id) {
      setSelectedBuilding(null);
      resetItemAndLinkState();
    } else {
      setSelectedBuilding(building);
      resetItemAndLinkState();
      if (!supportsCount) {
        setCount('1');
      }
    }
  };

  const handleItemConfigured = (itemId: string, configuredRatePerMinute: number) => {
    setSelectedItemId(itemId);
    setRatePerMinute(String(configuredRatePerMinute));
    setSelectedLinkedOutput(null);
    setConfigurationMode('manual');
  };

  const handleLinkedOutputConfigured = (output: LinkableOutputItem) => {
    setSelectedLinkedOutput(output);
    setSelectedItemId(output.item.id);
    setRatePerMinute(String(output.ratePerMinute));
    setSelectedPlanId('');
    setCapacityPerMinute('');
    setPriority('');
    setConfigurationMode('linked');
  };

  const handlePlanModeClick = () => {
    setSelectedLinkedOutput(null);
    setSelectedItemId(selectedPlan?.selectedItemId || '');
    setRatePerMinute('');
    setCapacityPerMinute((current) => current || getDefaultCapacityForSelectedBuilding());
    setPriority((current) => current || (selectedPlanId ? String(getDefaultPriorityForPlan(selectedPlanId)) : ''));
    setConfigurationMode('plan');
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find((candidate) => candidate.id === planId);
    setSelectedPlanId(planId);
    setSelectedLinkedOutput(null);
    setSelectedItemId(plan?.selectedItemId || '');
    setRatePerMinute('');
    setCapacityPerMinute(getDefaultCapacityForSelectedBuilding());
    setPriority(planId ? String(getDefaultPriorityForPlan(planId)) : '');
    setConfigurationMode('plan');
  };

  const handleLinkedInputTargetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLinkedInputKey(event.target.value);
  };

  const handleLinkedModeClick = () => {
    setSelectedLinkedOutput(null);
    setSelectedPlanId('');
    setCapacityPerMinute('');
    setPriority('');
    setConfigurationMode('linked');
  };

  const handleCountChange = (nextValue: string) => {
    if (!/^\d*$/.test(nextValue)) return;

    if (nextValue === '') {
      setCount('');
      return;
    }

    setCount(String(sanitizeBulkBuildingCount(Number(nextValue))));
  };

  const allConfigurationModeOptions: ConfigurationModeOption[] = [
    {
      mode: 'manual',
      label: 'Manual',
      detail: 'Item + rate',
      isAvailable: selectedBuildingSupportsLinking || selectedBuildingSupportsPlanLinking,
      onSelect: resetItemAndLinkState,
    },
    {
      mode: 'linked',
      label: 'Linked output',
      detail: 'Existing output',
      isAvailable: selectedBuildingSupportsLinking,
      onSelect: handleLinkedModeClick,
    },
    {
      mode: 'plan',
      label: 'Plan',
      detail: 'Production plan',
      isAvailable: selectedBuildingSupportsPlanLinking,
      onSelect: handlePlanModeClick,
    },
  ];
  const configurationModeOptions = allConfigurationModeOptions.filter((option) => option.isAvailable);

  const handleConfirm = () => {
    if (!selectedBuilding) return;

    const normalizedCount = selectedBuildingSupportsCount
      ? sanitizeBulkBuildingCount(Number(count))
      : 1;
    const normalizedRate = Number(ratePerMinute);
    const hasLinkedOutput = configurationMode === 'linked' && selectedLinkedOutput !== null;
    const hasPlanLinkedOutput = configurationMode === 'plan' && selectedPlan !== null;
    const hasConfiguredItem = configurationMode === 'manual' && !!selectedItemId && normalizedRate > 0;
    const hasLinkedOutputItem = hasLinkedOutput && !!selectedItemId && normalizedRate > 0;
    const normalizedCapacity = Number(capacityPerMinute);
    const normalizedPriority = Number(priority);

    if (mustConfigureItem && !hasConfiguredItem && !hasLinkedOutputItem && !hasPlanLinkedOutput) {
      return;
    }

    onAdd({
      buildingTypeId: selectedBuilding.id,
      count: normalizedCount,
      name: customName.trim() || undefined,
      description: customDescription.trim() || undefined,
      selectedItemId: hasConfiguredItem || hasLinkedOutputItem || hasPlanLinkedOutput ? selectedItemId : undefined,
      ratePerMinute: hasConfiguredItem || hasLinkedOutputItem ? normalizedRate : undefined,
      linkedOutput: hasLinkedOutput
        ? {
            baseId: selectedLinkedOutput.baseId,
            buildingId: selectedLinkedOutput.baseBuildingId,
            itemIdSnapshot: selectedLinkedOutput.item.id,
            ratePerMinuteSnapshot: selectedLinkedOutput.ratePerMinute,
          }
        : undefined,
      sourceProductionId: hasPlanLinkedOutput ? selectedPlan.id : undefined,
      allocationMode: hasPlanLinkedOutput ? 'auto' : undefined,
      capacityPerMinute: hasPlanLinkedOutput && normalizedCapacity > 0 ? normalizedCapacity : undefined,
      priority: hasPlanLinkedOutput && Number.isFinite(normalizedPriority) && normalizedPriority >= 0
        ? normalizedPriority
        : undefined,
      linkedInputRef: selectedBuildingSupportsInputTargets && selectedLinkedInputTarget
        ? {
            baseId: selectedLinkedInputTarget.baseId,
            buildingId: selectedLinkedInputTarget.buildingId,
          }
        : undefined,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedBuilding(null);
    setCustomName('');
    setCustomDescription('');
    setCount('1');
    resetItemAndLinkState();
    setShowSelectItemModal(false);
    setShowLinkOutputModal(false);
    onClose();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        {/* Header - fixed */}
        <div className="px-6 pt-6 pb-3 flex-shrink-0">
          <h3 className="font-bold text-lg">Select Building</h3>
        </div>

        {/* Buildings grid - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <div className="space-y-4 pb-3">
            {buildingGroups.map((group) => (
              <section key={group.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-base-content/55">
                    {group.label}
                  </h4>
                  <span className="rounded border border-base-300/70 px-1.5 py-0.5 font-mono text-[10px] text-base-content/45">
                    {group.buildings.length}
                  </span>
                  <div className="h-px flex-1 bg-base-300/55" />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.buildings.map((building) => {
                    const isSelected = selectedBuilding?.id === building.id;
                    return (
                      <button
                        key={building.id}
                        type="button"
                        className={`group flex min-h-28 cursor-pointer flex-col gap-1.5 rounded-md border p-2.5 text-left shadow-sm transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-base-300 bg-base-100 hover:border-primary/70 hover:bg-base-100/80'
                        }`}
                        onClick={() => handleBuildingClick(building)}
                        title={building.name}
                      >
                        <div className="text-xs font-semibold leading-tight text-base-content/90">
                          {building.name}
                        </div>
                        <div className="flex items-center gap-3">
                          <BuildingImage
                            buildingId={building.id}
                            building={building}
                            className="h-20 w-20 shrink-0 rounded-md bg-base-200/60 object-contain p-0.5"
                            size="medium"
                          />
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            <span className="inline-flex h-6 items-center gap-1 rounded border border-base-300/70 bg-base-200/60 px-2 font-mono text-[11px] text-base-content/75">
                              <span aria-hidden="true">⚡</span>
                              <span>{building.power || 0}</span>
                            </span>
                            {building.heat !== undefined && (
                              <span className="inline-flex h-6 items-center gap-1 rounded border border-base-300/70 bg-base-200/60 px-2 font-mono text-[11px] text-base-content/75">
                                <span aria-hidden="true">🔥</span>
                                <span>{building.heat}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Bottom section - fixed */}
        <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-base-300 bg-base-100">
          {selectedBuildingSupportsCount && (
            <div className="flex gap-3 mb-4">
              <div className="form-control w-28">
                <label className="label py-1">
                  <span className="label-text text-xs">Count</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  max={MAX_BULK_BUILDING_COUNT}
                  step="1"
                  className="input input-bordered input-sm w-full"
                  value={count}
                  onChange={(e) => handleCountChange(e.target.value)}
                  onBlur={() => setCount(String(sanitizeBulkBuildingCount(Number(count))))}
                />
              </div>
            </div>
          )}

          {supportsItemConfiguration && selectedBuilding && (
            <div className="mb-4 rounded-lg border border-base-300 bg-base-200/30 p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    Item configuration {!mustConfigureItem && <span className="text-base-content/50">(optional)</span>}
                  </div>
                </div>

                {configurationModeOptions.length > 1 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                      Source mode
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {configurationModeOptions.map((option) => {
                        const isActive = configurationMode === option.mode;
                        return (
                          <label
                            key={option.mode}
                            className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                              isActive
                                ? 'border-primary bg-primary/10 text-base-content ring-1 ring-primary/25'
                                : 'border-base-300 bg-base-100/70 hover:border-primary/60 hover:bg-base-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`item-configuration-mode-${selectedBuilding.id}`}
                              className="radio radio-primary radio-xs mt-0.5 shrink-0"
                              checked={isActive}
                              onChange={() => option.onSelect()}
                            />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold">{option.label}</span>
                              <span className="block truncate text-[10px] text-base-content/55">{option.detail}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-base-300/70 bg-base-100/70 p-3">
                  {configurationMode === 'linked' && selectedBuildingSupportsLinking ? (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                          Source output
                        </div>
                        <div className="mt-1 flex min-h-10 min-w-0 items-center rounded-md border border-base-300 bg-base-200/45 px-3">
                          {selectedLinkedOutput ? (
                            <div className="min-w-0 text-xs">
                              <div className="truncate font-medium text-base-content/85">
                                {selectedLinkedOutput.baseName} / {selectedLinkedOutput.item.name}
                              </div>
                              <div className="font-mono text-[11px] text-base-content/55">
                                {selectedLinkedOutput.ratePerMinute}/min
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-base-content/50">No linked output</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm min-w-36 ${selectedLinkedOutput ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => setShowLinkOutputModal(true)}
                      >
                        {selectedLinkedOutput ? 'Change output' : 'Link output'}
                      </button>
                    </div>
                  ) : configurationMode === 'plan' && selectedBuildingSupportsPlanLinking ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_7rem] md:items-end">
                        <label className="form-control min-w-0">
                          <span className="label-text mb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                            Source plan
                          </span>
                          <div className="flex min-w-0">
                            <ClippedSelect
                              size="sm"
                              value={selectedPlanId}
                              onChange={(event) => handlePlanChange(event.target.value)}
                              displayValue={selectedPlanLabel}
                              title={selectedPlanLabel}
                            >
                              <option className="text-base-content bg-base-100" value="">Select plan</option>
                              {plans.map((plan) => (
                                <option className="text-base-content bg-base-100" key={plan.id} value={plan.id}>
                                  {plan.name}
                                </option>
                              ))}
                            </ClippedSelect>
                          </div>
                        </label>
                        {selectedPlan && (
                          <>
                            <label className="form-control">
                              <span className="label-text mb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                                Capacity/min
                              </span>
                              <input
                                type="number"
                                min={1}
                                className="input input-bordered input-sm h-8"
                                value={capacityPerMinute}
                                onChange={(event) => setCapacityPerMinute(event.target.value)}
                                placeholder="Auto"
                              />
                            </label>
                            <label className="form-control">
                              <span className="label-text mb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                                Priority
                              </span>
                              <input
                                type="number"
                                min={0}
                                className="input input-bordered input-sm h-8"
                                value={priority}
                                onChange={(event) => setPriority(event.target.value)}
                              />
                            </label>
                          </>
                        )}
                      </div>
                      {selectedItem && (
                        <div className="flex min-w-0 items-center gap-2 rounded-md border border-base-300/70 bg-base-200/45 px-3 py-2">
                          <ItemImage
                            itemId={selectedItem.id}
                            item={selectedItem}
                            size="small"
                            className="h-5 w-5 shrink-0"
                          />
                          <span className="truncate text-xs font-medium text-base-content/80">{selectedItem.name}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                          Material
                        </div>
                        <div className="mt-1 flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-base-300 bg-base-200/45 px-3">
                          {selectedItem ? (
                            <>
                              <ItemImage
                                itemId={selectedItem.id}
                                item={selectedItem}
                                size="small"
                                className="h-5 w-5 shrink-0"
                              />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-base-content/85">
                                {selectedItem.name}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-base-content/55">
                                {ratePerMinute}/min
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-base-content/50">No material configured</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm h-10 min-h-10 min-w-36 self-end ${selectedItem ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => setShowSelectItemModal(true)}
                      >
                        {selectedItem ? 'Change material' : 'Select material'}
                      </button>
                    </div>
                  )}
                </div>

                {selectedBuildingSupportsInputTargets && (
                  <div className="rounded-md border border-base-300/70 bg-base-100/70 p-3">
                    <div className="grid gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                        Target
                      </span>
                      <div className="flex min-w-0">
                        <ClippedSelect
                          size="sm"
                          value={selectedLinkedInputKey}
                          onChange={handleLinkedInputTargetChange}
                          displayValue={selectedLinkedInputLabel}
                          title={selectedLinkedInputTarget
                            ? `${selectedLinkedInputTarget.baseName} / ${selectedLinkedInputTarget.name}`
                            : 'No target'}
                        >
                          <option className="text-base-content bg-base-100" value="">No target</option>
                          {linkableInputTargets.map((target) => (
                            <option className="text-base-content bg-base-100" key={target.key} value={target.key}>
                              {target.baseName} / {target.name}
                              {target.item ? ` · ${target.item.name}` : ''}
                              {target.linkedOutputLabel ? ` · linked to ${target.linkedOutputLabel}` : ''}
                            </option>
                          ))}
                        </ClippedSelect>
                      </div>
                    </div>
                  </div>
                )}

                {isRawExtractor(selectedBuilding) && (
                  <p className="text-xs text-base-content/55">
                    Output depends on node purity and extractor tier. Enter your in-game value.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Name & Description inputs */}
          <div className="flex gap-3 mb-4">
            <div className="form-control flex-1">
              <label className="label py-1">
                <span className="label-text text-xs">Name <span className="text-base-content/50">(optional, applies to all)</span></span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder={selectedBuilding?.name ?? 'Custom name'}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="form-control flex-1">
              <label className="label py-1">
                <span className="label-text text-xs">Description <span className="text-base-content/50">(optional)</span></span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="Add a note..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetAndClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={
                !selectedBuilding ||
                (
                  mustConfigureItem &&
                  !(
                    (configurationMode === 'manual' && selectedItemId && Number(ratePerMinute) > 0) ||
                    (configurationMode === 'linked' && selectedLinkedOutput) ||
                    (configurationMode === 'plan' && selectedPlan)
                  )
                )
              }
              onClick={handleConfirm}
            >
              Add
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={resetAndClose}></div>
      {selectedBuilding && supportsItemConfiguration && (
        <SelectItemModal
          key={selectedBuilding.id}
          isOpen={showSelectItemModal}
          building={selectedBuilding}
          currentItemId={selectedItemId || undefined}
          currentRatePerMinute={Number(ratePerMinute) > 0 ? Number(ratePerMinute) : undefined}
          onClose={() => setShowSelectItemModal(false)}
          onConfirm={(itemId, configuredRatePerMinute) => {
            handleItemConfigured(itemId, configuredRatePerMinute);
            setShowSelectItemModal(false);
          }}
        />
      )}
      {selectedBuildingSupportsLinking && (
        <LinkOutputModal
          isOpen={showLinkOutputModal}
          onClose={() => setShowLinkOutputModal(false)}
          onSelect={(output) => {
            handleLinkedOutputConfigured(output);
            setShowLinkOutputModal(false);
          }}
        />
      )}
    </div>
  );
};
