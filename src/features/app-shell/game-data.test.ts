import { describe, expect, it } from 'vitest';
import type { RawCorporationsData } from '@/app/uklad/model';
import { parseCorporations } from './game-data';

describe('corporation supply quantities', () => {
    it('requires enough whole items to meet the level target for every supply option', () => {
        const data: RawCorporationsData = {
            'Future Health Solutions': {
                id: 'future_health_solutions',
                levels: [{
                    level: 7,
                    xp: 69700,
                    components: [
                        { id: 'heat_sheet', points: 35 },
                        { id: 'applicator', points: 70 },
                        { id: 'bar_wolfram', points: 1 },
                    ],
                    rewards: [{ name: 'Inventory Upgrade (+8)' }],
                }],
            },
        };

        const [corporation] = parseCorporations(data);
        const [level] = corporation.levels;
        expect(level.components.map(component => component.cost)).toEqual([1992, 996, 69700]);
        for (const component of level.components) {
            expect(component.cost! * component.points).toBeGreaterThanOrEqual(level.xp!);
            expect((component.cost! - 1) * component.points).toBeLessThan(level.xp!);
        }
        expect(data['Future Health Solutions'].levels[0].components[0]).not.toHaveProperty('cost');
    });

    it('keeps quantities unavailable when the target or item value is missing', () => {
        const [corporation] = parseCorporations({
            Miners: {
                id: 'miners',
                levels: [
                    { level: 1, components: [{ id: 'ore', points: 1 }], rewards: [] },
                    { level: 2, xp: 100, components: [{ id: 'ore', points: 0 }], rewards: [] },
                ],
            },
        });

        expect(corporation.levels.map(level => level.components[0].cost)).toEqual([null, null]);
    });
});
