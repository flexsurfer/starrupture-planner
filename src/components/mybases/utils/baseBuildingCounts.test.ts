import { describe, expect, it } from 'vitest';
import type { Base, BaseBuilding, Production } from '../../../state/db';
import {
  getPreferredSectionTypeForBuildingType,
  reconcileBaseBuildingTypeCount,
  sanitizeBulkBuildingCount,
} from './baseBuildingCounts';

function createBaseBuilding(partial: Partial<BaseBuilding> & Pick<BaseBuilding, 'id' | 'buildingTypeId' | 'sectionType'>): BaseBuilding {
  return {
    id: partial.id,
    buildingTypeId: partial.buildingTypeId,
    sectionType: partial.sectionType,
    selectedItemId: partial.selectedItemId,
    ratePerMinute: partial.ratePerMinute,
    name: partial.name,
    description: partial.description,
  };
}

function createPlan(partial: Partial<Production> & Pick<Production, 'id' | 'name'>): Production {
  return {
    id: partial.id,
    name: partial.name,
    selectedItemId: partial.selectedItemId || 'target_item',
    targetAmount: partial.targetAmount || 60,
    active: partial.active ?? false,
    inputs: partial.inputs || [],
    requiredBuildings: partial.requiredBuildings || [],
    status: partial.status || 'inactive',
    corporationLevel: partial.corporationLevel || null,
  };
}

describe('baseBuildingCounts', () => {
  it('reuses the dominant existing section type when adding more buildings', () => {
    const base: Base = {
      id: 'base_1',
      name: 'Base',
      buildings: [
        createBaseBuilding({ id: 'storage_1', buildingTypeId: 'multistorage', sectionType: 'outputs' }),
        createBaseBuilding({ id: 'storage_2', buildingTypeId: 'multistorage', sectionType: 'outputs' }),
        createBaseBuilding({ id: 'storage_3', buildingTypeId: 'multistorage', sectionType: 'production' }),
      ],
      productions: [],
    };

    const preferredSectionType = getPreferredSectionTypeForBuildingType(base, 'multistorage', 'production');
    const nextBuildings = reconcileBaseBuildingTypeCount({
      base,
      buildingTypeId: 'multistorage',
      targetCount: 5,
      preferredSectionType,
      createId: (() => {
        let index = 0;
        return () => `new_${++index}`;
      })(),
    });

    expect(preferredSectionType).toBe('outputs');
    expect(nextBuildings.slice(-2)).toEqual([
      createBaseBuilding({ id: 'new_1', buildingTypeId: 'multistorage', sectionType: 'outputs' }),
      createBaseBuilding({ id: 'new_2', buildingTypeId: 'multistorage', sectionType: 'outputs' }),
    ]);
  });

  it('removes generic buildings before protected or configured ones', () => {
    const protectedInput = createBaseBuilding({
      id: 'receiver_protected',
      buildingTypeId: 'package_receiver',
      sectionType: 'inputs',
      selectedItemId: 'ore_titanium',
      ratePerMinute: 90,
    });
    const configuredInput = createBaseBuilding({
      id: 'receiver_configured',
      buildingTypeId: 'package_receiver',
      sectionType: 'inputs',
      selectedItemId: 'ore_calcium',
      ratePerMinute: 60,
    });
    const genericA = createBaseBuilding({
      id: 'receiver_generic_a',
      buildingTypeId: 'package_receiver',
      sectionType: 'inputs',
    });
    const genericB = createBaseBuilding({
      id: 'receiver_generic_b',
      buildingTypeId: 'package_receiver',
      sectionType: 'inputs',
    });

    const base: Base = {
      id: 'base_1',
      name: 'Base',
      buildings: [protectedInput, configuredInput, genericA, genericB],
      productions: [
        createPlan({
          id: 'plan_1',
          name: 'Plan 1',
          inputs: [{ ...protectedInput }],
        }),
      ],
    };

    const nextBuildings = reconcileBaseBuildingTypeCount({
      base,
      buildingTypeId: 'package_receiver',
      targetCount: 2,
      preferredSectionType: 'inputs',
      createId: () => 'unused',
    });

    expect(nextBuildings.map((building) => building.id)).toEqual([
      'receiver_protected',
      'receiver_configured',
    ]);
  });

  it('removes non-preferred section buildings before preferred ones', () => {
    const preferredBuilding = createBaseBuilding({
      id: 'factory_preferred',
      buildingTypeId: 'electronics_factory',
      sectionType: 'production',
    });
    const nonPreferredBuilding = createBaseBuilding({
      id: 'factory_non_preferred',
      buildingTypeId: 'electronics_factory',
      sectionType: 'outputs',
    });

    const base: Base = {
      id: 'base_1',
      name: 'Base',
      buildings: [preferredBuilding, nonPreferredBuilding],
      productions: [],
    };

    const nextBuildings = reconcileBaseBuildingTypeCount({
      base,
      buildingTypeId: 'electronics_factory',
      targetCount: 1,
      preferredSectionType: 'production',
      createId: () => 'unused',
    });

    expect(nextBuildings.map((building) => building.id)).toEqual(['factory_preferred']);
  });

  it('caps bulk building count sanitization to a safe upper bound', () => {
    expect(sanitizeBulkBuildingCount(Number.NaN)).toBe(1);
    expect(sanitizeBulkBuildingCount(-10)).toBe(1);
    expect(sanitizeBulkBuildingCount(12.8)).toBe(12);
    expect(sanitizeBulkBuildingCount(99999)).toBe(500);
  });
});
