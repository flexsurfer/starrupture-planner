import { describe, expect, it } from 'vitest';
import type { Base, BuildingsByIdMap, Item } from '@/state/db';
import {
  buildAllBaseLogisticsViewModels,
  buildBaseLogisticsViewModel,
  PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE,
} from './logistics';

const buildingsById: BuildingsByIdMap = {
  package_dispatcher: {
    id: 'package_dispatcher',
    name: 'Cargo Dispatcher',
    type: 'transport',
  },
  package_receiver: {
    id: 'package_receiver',
    name: 'Cargo Receiver',
    type: 'transport',
  },
  multistorage: {
    id: 'multistorage',
    name: 'Storage',
    type: 'storage',
  },
};

const itemsById: Record<string, Item> = {
  titanium_rod: {
    id: 'titanium_rod',
    name: 'Titanium Rod',
    type: 'component',
  },
};

describe('logistics view model', () => {
  it('summarizes output assignments and linked inputs', () => {
    const sourceBase: Base = {
      id: 'base_source',
      name: 'Source Base',
      buildings: [
        {
          id: 'dispatcher_1',
          buildingTypeId: 'package_dispatcher',
          sectionType: 'outputs',
          selectedItemId: 'titanium_rod',
          ratePerMinute: 200,
        },
      ],
      productions: [
        {
          id: 'plan_rods',
          name: 'Rods',
          selectedItemId: 'titanium_rod',
          targetAmount: 450,
          status: 'active',
        },
      ],
    };
    const targetBase: Base = {
      id: 'base_target',
      name: 'Target Base',
      buildings: [
        {
          id: 'receiver_1',
          buildingTypeId: 'package_receiver',
          sectionType: 'inputs',
          selectedItemId: 'titanium_rod',
          ratePerMinute: 200,
          linkedOutput: {
            baseId: 'base_source',
            buildingId: 'dispatcher_1',
            itemIdSnapshot: 'titanium_rod',
            ratePerMinuteSnapshot: 200,
          },
        },
      ],
      productions: [],
    };

    const model = buildBaseLogisticsViewModel({
      selectedBaseId: 'base_source',
      bases: [sourceBase, targetBase],
      buildingsById,
      itemsById,
    });

    expect(model?.outputs[0]).toMatchObject({
      baseBuildingId: 'dispatcher_1',
      ratePerMinute: 200,
      capacityPerMinute: PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE,
      availableCapacityPerMinute: 0,
    });
    expect(model?.outputs[0].linkedInputs[0]).toMatchObject({
      baseId: 'base_target',
      baseBuildingId: 'receiver_1',
      itemName: 'Titanium Rod',
      ratePerMinute: 200,
      linkedOutputStatus: 'ok',
    });
  });

  it('lists generic linked inputs on the selected base as incoming logistics', () => {
    const sourceBase: Base = {
      id: 'base_source',
      name: 'Source Base',
      buildings: [
        {
          id: 'storage_output_1',
          buildingTypeId: 'multistorage',
          sectionType: 'outputs',
          selectedItemId: 'titanium_rod',
          ratePerMinute: 120,
        },
      ],
      productions: [],
    };
    const targetBase: Base = {
      id: 'base_target',
      name: 'Target Base',
      buildings: [
        {
          id: 'storage_input_1',
          buildingTypeId: 'multistorage',
          sectionType: 'inputs',
          selectedItemId: 'titanium_rod',
          ratePerMinute: 120,
          linkedOutput: {
            baseId: 'base_source',
            buildingId: 'storage_output_1',
          },
        },
      ],
      productions: [],
    };

    const model = buildBaseLogisticsViewModel({
      selectedBaseId: 'base_target',
      bases: [sourceBase, targetBase],
      buildingsById,
      itemsById,
    });

    expect(model?.incomingInputs).toHaveLength(1);
    expect(model?.incomingInputs[0]).toMatchObject({
      baseBuildingId: 'storage_input_1',
      sourceBaseName: 'Source Base',
      sourceOutputName: 'Storage',
      itemName: 'Titanium Rod',
      ratePerMinute: 120,
      linkedOutputStatus: 'ok',
    });
  });

  it('builds logistics models for all bases', () => {
    const bases: Base[] = [
      {
        id: 'base_b',
        name: 'Beta',
        buildings: [],
        productions: [],
      },
      {
        id: 'base_a',
        name: 'Alpha',
        buildings: [],
        productions: [],
      },
    ];

    const models = buildAllBaseLogisticsViewModels({
      bases,
      buildingsById,
      itemsById,
    });

    expect(models.map((model) => model.baseName)).toEqual(['Alpha', 'Beta']);
  });
});
