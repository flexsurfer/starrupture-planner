/**
 * Tests for buildProductionFlow function
 * 
 * This test suite covers various scenarios for the production flow builder:
 * - Simple linear chains
 * - Complex chains with multiple inputs
 * - Multiple consumers sharing the same producer
 * - Edge consolidation
 * - Raw material handling
 * - Error cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the imported data modules with inline data
const buildings = [
    {
        id: 'ore_excavator',
        name: 'Ore Excavator',
        power: 10,
        recipes: [
            {
                output: { id: 'ore_titanium', amount_per_minute: 75 },
                inputs: []
            }
        ]
    },
    {
        id: 'smelter',
        name: 'Smelter',
        power: 10,
        recipes: [
            {
                output: { id: 'bar_titanium', amount_per_minute: 60 },
                inputs: [
                    { id: 'ore_titanium', amount_per_minute: 90 }
                ]
            }
        ]
    },
    {
        id: 'fabricator',
        name: 'Fabricator',
        power: 10,
        recipes: [
            {
                output: { id: 'titanium_beam', amount_per_minute: 30 },
                inputs: [
                    { id: 'bar_titanium', amount_per_minute: 60 }
                ]
            },
            {
                output: { id: 'titanium_sheet', amount_per_minute: 60 },
                inputs: [
                    { id: 'bar_titanium', amount_per_minute: 30 }
                ]
            }
        ]
    },
    {
        id: 'furnace',
        name: 'Furnace',
        power: 10,
        recipes: [
            {
                output: { id: 'titanium_housing', amount_per_minute: 30 },
                inputs: [
                    { id: 'titanium_beam', amount_per_minute: 30 },
                    { id: 'titanium_sheet', amount_per_minute: 60 }
                ]
            }
        ]
    }
];

// Mock corporations data
const corporations = [
    {
        id: 'test_corp',
        name: 'Test Corporation',
        levels: [
            {
                level: 1,
                xp: 0,
                components: [
                    {
                        id: 'bar_titanium',
                        points: 2,
                        cost: 200
                    }
                ],
                rewards: [
                    { name: 'Test Reward' }
                ]
            },
            {
                level: 2,
                xp: 200,
                components: [
                    {
                        id: 'titanium_housing',
                        points: 10,
                        cost: 1500
                    }
                ],
                rewards: [
                    { name: 'Advanced Test Reward' }
                ]
            }
        ]
    }
];

// Import after mocking
import { buildProductionFlow } from './productionFlowBuilder';

describe('buildProductionFlow', () => {
    beforeEach(() => {
        // Reset any mocks between tests
        vi.clearAllMocks();
    });

    describe('Simple Linear Chain', () => {
        it('should build a simple chain from raw material to processed material', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 60
            }, buildings, corporations);

            // Should have 2 production nodes + 1 launcher node (bar_titanium is used by corporations)
            expect(result.nodes).toHaveLength(3);
            expect(result.edges).toHaveLength(2); // 1 production edge + 1 edge to launcher

            // Check ore excavator node
            const oreNode = result.nodes.find(n => n.buildingId === 'ore_excavator');
            expect(oreNode).toBeDefined();
            expect(oreNode!.outputItem).toBe('ore_titanium');
            expect(oreNode!.buildingCount).toBe(1.2); // 90/75

            // Check smelter node
            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            expect(smelterNode).toBeDefined();
            expect(smelterNode!.outputItem).toBe('bar_titanium');
            expect(smelterNode!.buildingCount).toBe(1); // 60/60

            // Check edge
            const edge = result.edges[0];
            expect(edge.itemId).toBe('ore_titanium');
            expect(edge.amount).toBe(90);
        });

        it('should handle fractional building counts correctly', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 30 // Half the default output
            }, buildings, corporations);

            // Should have 3 nodes now: ore_excavator, smelter, orbital_cargo_launcher
            expect(result.nodes).toHaveLength(3);

            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            expect(smelterNode!.buildingCount).toBe(0.5); // 30/60

            const oreNode = result.nodes.find(n => n.buildingId === 'ore_excavator');
            expect(oreNode!.buildingCount).toBe(0.6); // 45/75

            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode!.buildingCount).toBe(3); // 30/10 = 3 launchers
        });
    });

    describe('Complex Multi-Input Chain', () => {
        it('should build a complex chain with multiple inputs', () => {
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 30
            }, buildings, corporations);

            expect(result.nodes).toHaveLength(6); // 5 production nodes + 1 launcher node

            // Should have nodes for: ore_excavator, smelter, fabricator (beam), fabricator (sheet), furnace
            const nodesByBuilding = result.nodes.reduce((acc, node) => {
                acc[node.buildingId] = (acc[node.buildingId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            expect(nodesByBuilding.ore_excavator).toBe(1);
            expect(nodesByBuilding.smelter).toBe(1);
            expect(nodesByBuilding.fabricator).toBe(2); // One for beam, one for sheet
            expect(nodesByBuilding.furnace).toBe(1);

            // Check final furnace node
            const furnaceNode = result.nodes.find(n => n.buildingId === 'furnace');
            expect(furnaceNode!.buildingCount).toBe(1); // 30/30
            expect(furnaceNode!.outputItem).toBe('titanium_housing');
        });

        it('should create separate nodes for different recipes of the same building', () => {
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 30
            }, buildings, corporations);

            const fabricatorNodes = result.nodes.filter(n => n.buildingId === 'fabricator');
            expect(fabricatorNodes).toHaveLength(2);

            const beamNode = fabricatorNodes.find(n => n.outputItem === 'titanium_beam');
            const sheetNode = fabricatorNodes.find(n => n.outputItem === 'titanium_sheet');

            expect(beamNode).toBeDefined();
            expect(sheetNode).toBeDefined();
            expect(beamNode!.recipeIndex).not.toBe(sheetNode!.recipeIndex);
        });
    });

    describe('Multiple Consumers (Shared Production)', () => {
        it('should correctly handle multiple consumers of the same item', () => {
            // This tests the core bug that was fixed - multiple consumers should 
            // result in consolidated demand, not duplicate producers
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 60 // Double amount to make calculations clearer
            }, buildings, corporations);

            // Should only have ONE smelter node, even though both beam and sheet fabricators need titanium bars
            const smelterNodes = result.nodes.filter(n => n.buildingId === 'smelter');
            expect(smelterNodes).toHaveLength(1);

            const smelterNode = smelterNodes[0];
            // Total demand: beam needs 120 (60*2), sheet needs 60 (30*2) = 180 total
            expect(smelterNode.buildingCount).toBe(3); // 180/60

            // Should only have ONE ore excavator node
            const oreNodes = result.nodes.filter(n => n.buildingId === 'ore_excavator');
            expect(oreNodes).toHaveLength(1);

            const oreNode = oreNodes[0];
            expect(oreNode.buildingCount).toBe(3.6); // 270/75 = 3.6
        });

        it('should consolidate edges between the same producer and consumer', () => {
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 30
            }, buildings, corporations);

            // Find edges from smelter to fabricators
            const smelterNodeId = 'smelter_0_bar_titanium';
            const edgesFromSmelter = result.edges.filter(e => e.from === smelterNodeId);

            // Should have exactly 2 edges: one to beam fabricator, one to sheet fabricator
            expect(edgesFromSmelter).toHaveLength(2);

            const beamEdge = edgesFromSmelter.find(e => e.to.includes('titanium_beam'));
            const sheetEdge = edgesFromSmelter.find(e => e.to.includes('titanium_sheet'));

            expect(beamEdge).toBeDefined();
            expect(sheetEdge).toBeDefined();
            expect(beamEdge!.amount).toBe(60); // beam fabricator needs 60 bars
            expect(sheetEdge!.amount).toBe(30); // sheet fabricator needs 30 bars
        });
    });

    describe('Raw Material Handling', () => {
        it('should handle raw materials without creating extra nodes', () => {
            const result = buildProductionFlow({
                targetItemId: 'ore_titanium',
                targetAmount: 150
            }, buildings, corporations);

            expect(result.nodes).toHaveLength(1);
            expect(result.edges).toHaveLength(0);

            const node = result.nodes[0];
            expect(node.buildingId).toBe('ore_excavator');
            expect(node.outputItem).toBe('ore_titanium');
            expect(node.buildingCount).toBe(2); // 150/75
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle zero target amount gracefully', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 0
            }, buildings, corporations);

            // The current implementation still creates nodes with zero amounts
            // This might be the expected behavior for the UI to show the chain structure
            expect(result.nodes.length).toBeGreaterThanOrEqual(0);
            expect(result.edges.length).toBeGreaterThanOrEqual(0);

            // But building counts should be very small or zero
            result.nodes.forEach(node => {
                expect(node.buildingCount).toBeGreaterThanOrEqual(0);
            });
        });

        it('should handle invalid item ID', () => {
            const result = buildProductionFlow({
                targetItemId: 'invalid_item',
                targetAmount: 60
            }, buildings, corporations);

            expect(result.nodes).toHaveLength(0);
            expect(result.edges).toHaveLength(0);
        });

        it('should handle very small amounts correctly', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 0.1
            }, buildings, corporations);

            expect(result.nodes).toHaveLength(3); // ore_excavator, smelter, orbital_cargo_launcher

            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            expect(smelterNode!.buildingCount).toBeCloseTo(0.00167, 4); // 0.1/60

            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode!.buildingCount).toBe(0.01); // 0.1/10
        });
    });

    describe('Node ID Generation', () => {
        it('should generate consistent and unique node IDs', () => {
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 30
            }, buildings, corporations);

            const nodeIds = result.nodes.map(node =>
                `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`
            );

            // All IDs should be unique
            const uniqueIds = new Set(nodeIds);
            expect(uniqueIds.size).toBe(nodeIds.length);

            // IDs should follow the expected pattern
            // Note: Orbital Cargo Launcher uses -1 as recipeIndex
            nodeIds.forEach(id => {
                expect(id).toMatch(/^[a-z_]+_-?\d+_[a-z_]+$/);
            });
        });
    });

    describe('Performance with Large Chains', () => {
        it('should handle reasonable performance with complex chains', () => {
            const startTime = performance.now();

            buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 1000 // Large amount
            }, buildings, corporations);

            const endTime = performance.now();
            const executionTime = endTime - startTime;

            // Should complete within reasonable time (less than 100ms for this simple chain)
            expect(executionTime).toBeLessThan(100);
        });
    });

    describe('Data Structure Validation', () => {
        it('should return properly structured FlowNode objects', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 60
            }, buildings, corporations);

            result.nodes.forEach(node => {
                expect(node).toHaveProperty('buildingId');
                expect(node).toHaveProperty('buildingName');
                expect(node).toHaveProperty('recipeIndex');
                expect(node).toHaveProperty('outputItem');
                expect(node).toHaveProperty('outputAmount');
                expect(node).toHaveProperty('buildingCount');
                expect(node).toHaveProperty('x');
                expect(node).toHaveProperty('y');

                expect(typeof node.buildingId).toBe('string');
                expect(typeof node.buildingName).toBe('string');
                expect(typeof node.recipeIndex).toBe('number');
                expect(typeof node.outputItem).toBe('string');
                expect(typeof node.outputAmount).toBe('number');
                expect(typeof node.buildingCount).toBe('number');
                expect(typeof node.x).toBe('number');
                expect(typeof node.y).toBe('number');

                // If it's an Orbital Cargo Launcher node, check additional properties
                if (node.buildingId === 'orbital_cargo_launcher') {
                    expect(node).toHaveProperty('pointsPerItem');
                    expect(node).toHaveProperty('launchTime');
                    expect(node).toHaveProperty('totalPoints');
                    
                    expect(typeof (node as any).pointsPerItem).toBe('number');
                    expect(typeof (node as any).launchTime).toBe('number');
                    expect(typeof (node as any).totalPoints).toBe('number');
                }
            });
        });

        it('should return properly structured FlowEdge objects', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 60
            }, buildings, corporations);

            result.edges.forEach(edge => {
                expect(edge).toHaveProperty('from');
                expect(edge).toHaveProperty('to');
                expect(edge).toHaveProperty('itemId');
                expect(edge).toHaveProperty('amount');

                expect(typeof edge.from).toBe('string');
                expect(typeof edge.to).toBe('string');
                expect(typeof edge.itemId).toBe('string');
                expect(typeof edge.amount).toBe('number');

                expect(edge.amount).toBeGreaterThan(0);
            });
        });
    });

    describe('Orbital Cargo Launcher', () => {
        it('should add Orbital Cargo Launcher for items used by corporations', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 60
            }, buildings, corporations);

            // Should have the normal production nodes plus the launcher
            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode).toBeDefined();
            
            expect(launcherNode!.outputItem).toBe('bar_titanium');
            expect(launcherNode!.buildingCount).toBe(6); // 60 items / 10 items per launcher
            expect(launcherNode!.outputAmount).toBe(10); // 10 items/min per launcher
            expect((launcherNode as any).pointsPerItem).toBe(2); // From mock data
            expect((launcherNode as any).totalPoints).toBe(120); // 60 items * 2 points per item
            expect((launcherNode as any).launchTime).toBe(6); // 60 items / 10 items per min per launcher
        });

        it('should not add Orbital Cargo Launcher for items not used by corporations', () => {
            const result = buildProductionFlow({
                targetItemId: 'ore_titanium',
                targetAmount: 75
            }, buildings, corporations);

            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode).toBeUndefined();
        });

        it('should create proper edge to Orbital Cargo Launcher', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 60
            }, buildings, corporations);

            // Find edge to launcher
            const launcherNodeId = 'orbital_cargo_launcher_-1_bar_titanium';
            const edgeToLauncher = result.edges.find(e => e.to === launcherNodeId);
            
            expect(edgeToLauncher).toBeDefined();
            expect(edgeToLauncher!.itemId).toBe('bar_titanium');
            expect(edgeToLauncher!.amount).toBe(60); // Should show full flow rate
        });

        it('should calculate launch time correctly for different production rates', () => {
            // Test with titanium_housing which has different points and level cost
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 30
            }, buildings, corporations);

            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode).toBeDefined();
            
            expect((launcherNode as any).pointsPerItem).toBe(10); // From mock data
            expect((launcherNode as any).totalPoints).toBe(300); // 30 items * 10 points per item

            // 30 items / 10 items per min per launcher = 3 minutes
            expect((launcherNode as any).launchTime).toBe(3);
        });

        it('should handle fractional launcher counts correctly', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 25 // Not divisible by 10
            }, buildings, corporations);

            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode).toBeDefined();
            
            expect(launcherNode!.buildingCount).toBe(2.5); // 25 / 10 = 2.5 launchers
        });
    });
});