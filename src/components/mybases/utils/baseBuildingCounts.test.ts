import { describe, expect, it } from 'vitest';
import type { Base, BaseBuilding } from '../../../state/db';
import {
  reconcileBaseBuildingSectionTypeCount,
  sanitizeBuildingCount,
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

describe('baseBuildingCounts', () => {
  it('caps bulk building count sanitization to a safe upper bound', () => {
    expect(sanitizeBulkBuildingCount(Number.NaN)).toBe(1);
    expect(sanitizeBulkBuildingCount(-10)).toBe(1);
    expect(sanitizeBulkBuildingCount(12.8)).toBe(12);
    expect(sanitizeBulkBuildingCount(99999)).toBe(500);
  });

  it('caps editable building count sanitization to the shared upper bound', () => {
    expect(sanitizeBuildingCount(Number.NaN)).toBe(0);
    expect(sanitizeBuildingCount(-10)).toBe(0);
    expect(sanitizeBuildingCount(12.8)).toBe(12);
    expect(sanitizeBuildingCount(99999)).toBe(500);
  });

  it('reconciles a building type count only inside the requested section', () => {
    const base: Base = {
      id: 'base_1',
      name: 'Base',
      buildings: [
        createBaseBuilding({ id: 'storage_output', buildingTypeId: 'multistorage', sectionType: 'outputs' }),
        createBaseBuilding({ id: 'storage_production', buildingTypeId: 'multistorage', sectionType: 'production' }),
      ],
      productions: [],
    };

    const nextBuildings = reconcileBaseBuildingSectionTypeCount({
      base,
      buildingTypeId: 'multistorage',
      sectionType: 'production',
      targetCount: 2,
      createId: () => 'storage_production_new',
    });

    expect(nextBuildings).toEqual([
      createBaseBuilding({ id: 'storage_output', buildingTypeId: 'multistorage', sectionType: 'outputs' }),
      createBaseBuilding({ id: 'storage_production', buildingTypeId: 'multistorage', sectionType: 'production' }),
      createBaseBuilding({ id: 'storage_production_new', buildingTypeId: 'multistorage', sectionType: 'production' }),
    ]);
  });

  it('keeps the first matching buildings when reducing count inside the requested section', () => {
    const firstBuilding = createBaseBuilding({
      id: 'factory_first',
      buildingTypeId: 'electronics_factory',
      sectionType: 'production',
    });
    const secondBuilding = createBaseBuilding({
      id: 'factory_second',
      buildingTypeId: 'electronics_factory',
      sectionType: 'production',
    });

    const base: Base = {
      id: 'base_1',
      name: 'Base',
      buildings: [firstBuilding, secondBuilding],
      productions: [],
    };

    const nextBuildings = reconcileBaseBuildingSectionTypeCount({
      base,
      buildingTypeId: 'electronics_factory',
      sectionType: 'production',
      targetCount: 1,
      createId: () => 'unused',
    });

    expect(nextBuildings.map((building) => building.id)).toEqual(['factory_first']);
  });
});
