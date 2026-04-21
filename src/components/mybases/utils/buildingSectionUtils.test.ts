import { describe, expect, it } from 'vitest';
import type { Building } from '../../../state/db';
import { isBuildingCountAvailable } from './buildingSectionUtils';

function createBuilding(partial: Partial<Building> & Pick<Building, 'id' | 'name'>): Building {
  return {
    recipes: [],
    ...partial,
  };
}

describe('buildingSectionUtils', () => {
  it('allows count controls only for buildings available in energy or production', () => {
    expect(isBuildingCountAvailable(createBuilding({ id: 'generator', name: 'Generator', type: 'generator' }))).toBe(true);
    expect(isBuildingCountAvailable(createBuilding({ id: 'heater', name: 'Heater', type: 'temperature' }))).toBe(true);
    expect(isBuildingCountAvailable(createBuilding({ id: 'factory', name: 'Factory', type: 'production', recipes: [{ inputs: [{ id: 'ore', amount_per_minute: 60 }], output: { id: 'plate', amount_per_minute: 60 } }] }))).toBe(true);
    expect(isBuildingCountAvailable(createBuilding({ id: 'storage', name: 'Storage', type: 'storage' }))).toBe(true);
    expect(isBuildingCountAvailable(createBuilding({ id: 'miner', name: 'Miner', type: 'production', recipes: [{ inputs: [], output: { id: 'ore', amount_per_minute: 60 } }] }))).toBe(false);
    expect(isBuildingCountAvailable(createBuilding({ id: 'orbital_cargo_launcher', name: 'Launcher', type: 'transport' }))).toBe(false);
    expect(isBuildingCountAvailable(createBuilding({ id: 'habitat', name: 'Habitat', type: 'habitat' }))).toBe(false);
  });
});
