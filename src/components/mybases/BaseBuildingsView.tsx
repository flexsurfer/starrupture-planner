import React, { useCallback, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';
import { SUB_IDS } from '../../state/sub-ids';
import type { Base } from '../../state/db';
import type { BuildingSectionType } from './types';
import {
  BuildingSection,
  AddBuildingCardModal,
} from './index';

export const BaseBuildingsView: React.FC = () => {
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [addBuildingSection, setAddBuildingSection] = useState<BuildingSectionType | null>(null);

  const selectedBase = useSubscription<Base | null>([SUB_IDS.SELECTED_BASE]);

  const handleAddBuilding = useCallback((buildingTypeId: string) => {
    if (selectedBase && addBuildingSection) {
      dispatch([EVENT_IDS.ADD_BUILDING_TO_BASE, selectedBase.id, buildingTypeId, addBuildingSection]);
      setAddBuildingSection(null);
    }
  }, [selectedBase, addBuildingSection]);

  const handleOpenAddModal = useCallback((sectionType: BuildingSectionType) => {
    setAddBuildingSection(sectionType);
    setShowAddBuildingModal(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setShowAddBuildingModal(false);
    setAddBuildingSection(null);
  }, []);

  if (!selectedBase) {
    return null;
  }

  return (
    <>
      <div className="space-y-4 lg:space-y-6">
        <BuildingSection
          title="Inputs"
          description="Buildings that extract resources or receive packages from other bases."
          baseId={selectedBase.id}
          sectionType="inputs"
          onAdd={() => handleOpenAddModal('inputs')}
        />

        <BuildingSection
          title="Energy"
          description="Generators that produce energy for your base, and amplifiers that increase core heat capacity."
          baseId={selectedBase.id}
          sectionType="energy"
          onAdd={() => handleOpenAddModal('energy')}
        />

        <BuildingSection
          title="Infrastructure"
          description="Habitat buildings for population and defense structures."
          baseId={selectedBase.id}
          sectionType="infrastructure"
          onAdd={() => handleOpenAddModal('infrastructure')}
        />

        <BuildingSection
          title="Production"
          description="Buildings that process materials and produce items."
          baseId={selectedBase.id}
          sectionType="production"
          onAdd={() => handleOpenAddModal('production')}
        />

        <BuildingSection
          title="Outputs"
          description="Buildings that send items to other bases or launch cargo to orbit."
          baseId={selectedBase.id}
          sectionType="outputs"
          onAdd={() => handleOpenAddModal('outputs')}
        />
      </div>

      {/* Modal */}
      {addBuildingSection && (
        <AddBuildingCardModal
          isOpen={showAddBuildingModal}
          sectionType={addBuildingSection}
          onClose={handleCloseAddModal}
          onAdd={handleAddBuilding}
        />
      )}
    </>
  );
};
