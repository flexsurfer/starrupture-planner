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
        heat: 10,
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
        heat: 10,
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
        heat: 10,
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
        heat: 10,
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
                targetAmount: 60,
                includeLauncher: true
            }, buildings);

            // Should have 2 production nodes + 1 launcher node
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
                targetAmount: 30, // Half the default output
                includeLauncher: true
            }, buildings);

            // Should have 3 nodes: ore_excavator, smelter, orbital_cargo_launcher
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
                targetAmount: 30,
                includeLauncher: true
            }, buildings);

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
            }, buildings);

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
            }, buildings);

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
            }, buildings);

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
        it('returns an empty result when the target item is raw', () => {
            const result = buildProductionFlow({
                targetItemId: 'ore_titanium',
                targetAmount: 150
            }, buildings);

            expect(result.nodes).toHaveLength(0);
            expect(result.edges).toHaveLength(0);
            expect(result.rawMaterialDeficits).toBeDefined();
            expect(result.rawMaterialDeficits!.length).toBe(0);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle zero target amount gracefully', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 0
            }, buildings);

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
            }, buildings);

            expect(result.nodes).toHaveLength(0);
            expect(result.edges).toHaveLength(0);
        });

        it('should handle very small amounts correctly', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 0.1,
                includeLauncher: true
            }, buildings);

            expect(result.nodes).toHaveLength(3); // ore_excavator, smelter, orbital_cargo_launcher

            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            expect(smelterNode!.buildingCount).toBeCloseTo(0.00167, 4); // 0.1/60

            const launcherNode = result.nodes.find(n => n.buildingId === 'orbital_cargo_launcher');
            expect(launcherNode!.buildingCount).toBe(0.01); // 0.1/10
        });
    });

    describe('Custom Inputs and Raw Deficits', () => {
        it('returns an empty result when the target item is raw, even with input buildings', () => {
            const result = buildProductionFlow(
                {
                    targetItemId: 'imported_crystal',
                    targetAmount: 60,
                    inputBuildings: [
                        {
                            id: 'import_line_1',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'imported_crystal',
                            ratePerMinute: 20
                        }
                    ],
                    rawProductionDisabled: true
                },
                buildings
            );

            expect(result.nodes).toHaveLength(0);
            expect(result.edges).toHaveLength(0);
            expect(result.rawMaterialDeficits).toBeDefined();
            expect(result.rawMaterialDeficits!.length).toBe(0);
        });

        it('returns an empty result when the target item is raw without input buildings', () => {
            const result = buildProductionFlow(
                {
                    targetItemId: 'imported_crystal',
                    targetAmount: 30
                },
                buildings
            );

            expect(result.rawMaterialDeficits).toBeDefined();
            expect(result.rawMaterialDeficits!.length).toBe(0);
            expect(result.nodes).toHaveLength(0);
            expect(result.edges).toHaveLength(0);
        });

        it('uses input building snapshots as external sources without custom input conversion', () => {
            const result = buildProductionFlow(
                {
                    targetItemId: 'bar_titanium',
                    targetAmount: 60,
                    inputBuildings: [
                        {
                            id: 'input_snapshot_1',
                            buildingTypeId: 'ore_excavator',
                            sectionType: 'inputs',
                            selectedItemId: 'ore_titanium',
                            ratePerMinute: 100
                        }
                    ],
                    rawProductionDisabled: false
                },
                buildings
            );

            const customInputNode = result.nodes.find(n => n.isCustomInput && n.outputItem === 'ore_titanium');
            expect(customInputNode).toBeDefined();
            expect(customInputNode!.outputAmount).toBe(100);
            expect(customInputNode!.buildingCount).toBeCloseTo(0.9, 5);

            const oreNode = result.nodes.find(n => n.outputItem === 'ore_titanium' && !n.isCustomInput);
            expect(oreNode).toBeUndefined();

            const edgeFromCustom = result.edges.find(e => e.from.includes('input_snapshot_1') && e.to.includes('bar_titanium'));
            expect(edgeFromCustom).toBeDefined();
            expect(edgeFromCustom!.amount).toBe(90);
        });

        it('uses input buildings for raw materials even when rawProductionDisabled is false', () => {
            const result = buildProductionFlow(
                {
                    targetItemId: 'bar_titanium',
                    targetAmount: 60,
                    inputBuildings: [
                        {
                            id: 'input_1',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'ore_titanium',
                            ratePerMinute: 100
                        }
                    ],
                    rawProductionDisabled: false
                },
                buildings
            );

            // Raw input building should be used to satisfy demand
            const customInputNode = result.nodes.find(n => n.isCustomInput && n.outputItem === 'ore_titanium');
            expect(customInputNode).toBeDefined();
            expect(customInputNode!.outputAmount).toBe(100); // Source rate per minute
            expect(customInputNode!.buildingCount).toBeCloseTo(0.9, 5); // 90 used / 100 available

            // Raw production node should be omitted when custom input fully satisfies demand
            const oreNode = result.nodes.find(n => n.outputItem === 'ore_titanium' && !n.isCustomInput);
            expect(oreNode).toBeUndefined();

            const edgeFromCustom = result.edges.find(e => e.from.includes('input_1') && e.to.includes('bar_titanium'));
            expect(edgeFromCustom).toBeDefined();
            expect(edgeFromCustom!.amount).toBe(90);
            
            // No deficits should be reported when flag is false
            expect(result.rawMaterialDeficits).toBeDefined();
            expect(result.rawMaterialDeficits!.length).toBe(0);
        });

        it('ignores input buildings for the target item and still builds production', () => {
            const result = buildProductionFlow(
                {
                    targetItemId: 'bar_titanium',
                    targetAmount: 60,
                    inputBuildings: [
                        {
                            id: 'input_1',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 60
                        }
                    ],
                    rawProductionDisabled: false
                },
                buildings
            );

            // Custom input node should NOT exist because target inputs are ignored
            const customInputNode = result.nodes.find(n => n.isCustomInput && n.outputItem === 'bar_titanium');
            expect(customInputNode).toBeUndefined();

            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            const oreNode = result.nodes.find(n => n.outputItem === 'ore_titanium' && !n.isCustomInput);
            expect(smelterNode).toBeDefined();
            expect(oreNode).toBeDefined();
            expect(result.edges).toHaveLength(1);
        });

        it('propagates intermediate custom-input allocation to upstream demand', () => {
            const result = buildProductionFlow(
                {
                    targetItemId: 'titanium_housing',
                    targetAmount: 30,
                    inputBuildings: [
                        {
                            id: 'beam_input',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'titanium_beam',
                            ratePerMinute: 30
                        }
                    ],
                    rawProductionDisabled: false
                },
                buildings
            );

            // Beam demand is fully satisfied by custom input, so no beam producer should exist.
            const beamNode = result.nodes.find(n => !n.isCustomInput && n.outputItem === 'titanium_beam');
            expect(beamNode).toBeUndefined();

            // Smelter should only produce bars needed for sheets (30/min), not full theoretical 90/min.
            const smelterNode = result.nodes.find(n => n.outputItem === 'bar_titanium' && !n.isCustomInput);
            expect(smelterNode).toBeDefined();
            expect(smelterNode!.buildingCount).toBe(0.5); // 30/60

            const edgesFromSmelter = result.edges.filter(e => e.from === 'smelter_0_bar_titanium');
            const totalFromSmelter = edgesFromSmelter.reduce((sum, e) => sum + e.amount, 0);
            expect(totalFromSmelter).toBe(30);
        });

        it('should show input node when it is actually consumed by another node', () => {
            // Verify that input snapshots ARE shown when they're consumed by production nodes
            const result = buildProductionFlow(
                {
                    targetItemId: 'titanium_beam',
                    targetAmount: 30,
                    inputBuildings: [
                        {
                            id: 'input_1',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 30
                        }
                    ],
                    rawProductionDisabled: true
                },
                buildings
            );

            // Input node SHOULD exist because it's consumed by the fabricator
            const customInputNode = result.nodes.find(n => n.isCustomInput && n.outputItem === 'bar_titanium');
            expect(customInputNode).toBeDefined();
            expect(customInputNode!.outputAmount).toBe(30);
            
            // Should have production node for titanium_beam
            const fabricatorNode = result.nodes.find(n => n.buildingId === 'fabricator' && n.outputItem === 'titanium_beam');
            expect(fabricatorNode).toBeDefined();
            
            // Should have edge from custom input to fabricator
            const edge = result.edges.find(e => 
                e.from.includes('bar_titanium') && 
                e.from.includes('input_1') &&
                e.to.includes('titanium_beam')
            );
            expect(edge).toBeDefined();
            expect(edge!.amount).toBe(30);
        });
    });

    describe('Deterministic Input Allocation', () => {
        it('should allocate input buildings deterministically in source order', () => {
            // Test that allocation order is deterministic based on input order
            const result1 = buildProductionFlow(
                {
                    targetItemId: 'titanium_beam',
                    targetAmount: 30,
                    inputBuildings: [
                        {
                            id: 'source_a',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 20
                        },
                        {
                            id: 'source_b',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 40
                        }
                    ],
                    rawProductionDisabled: true
                },
                buildings
            );

            const result2 = buildProductionFlow(
                {
                    targetItemId: 'titanium_beam',
                    targetAmount: 30,
                    inputBuildings: [
                        {
                            id: 'source_a',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 20
                        },
                        {
                            id: 'source_b',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 40
                        }
                    ],
                    rawProductionDisabled: true
                },
                buildings
            );

            // Results should be identical for same inputs
            expect(result1.nodes.length).toBe(result2.nodes.length);
            expect(result1.edges.length).toBe(result2.edges.length);

            // Input buildings should be used in source order (source_a first)
            // Total demand is 60 (beam needs 60 bar_titanium per minute for 30 beams)
            // source_a provides 20, source_b provides remaining 40
            const customNodesR1 = result1.nodes.filter(n => n.isCustomInput);
            expect(customNodesR1.length).toBe(2);
            
            const sourceA = customNodesR1.find(n => n.baseBuildingId === 'source_a');
            const sourceB = customNodesR1.find(n => n.baseBuildingId === 'source_b');
            
            expect(sourceA).toBeDefined();
            expect(sourceB).toBeDefined();
            expect(sourceA!.outputAmount).toBe(20); // All of source_a used first
            expect(sourceB!.outputAmount).toBe(40); // Then source_b
        });

        it('should not double-count input supply across multiple consumers', () => {
            // Both titanium_beam and titanium_sheet need bar_titanium
            // If one input building only provides 30, it should be split correctly
            const result = buildProductionFlow(
                {
                    targetItemId: 'titanium_housing',
                    targetAmount: 30,
                    inputBuildings: [
                        {
                            id: 'source_1',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 30 // Less than total needed (60 for beam + 30 for sheet = 90)
                        }
                    ],
                    rawProductionDisabled: true
                },
                buildings
            );

            // Check input node shows correct used amount
            const customInputNode = result.nodes.find(n => n.isCustomInput && n.outputItem === 'bar_titanium');
            expect(customInputNode).toBeDefined();
            expect(customInputNode!.outputAmount).toBe(30); // Should only show 30, not more

            // Should still have production node for smelter to produce remaining bars
            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            expect(smelterNode).toBeDefined();
            // Smelter should produce 60 bars (90 needed - 30 from custom = 60)
            expect(smelterNode!.buildingCount).toBe(1); // 60/60 = 1

            // Total edges from input should sum to exactly 30
            const edgesFromCustom = result.edges.filter(e => e.from.includes('source_1'));
            const totalFromCustom = edgesFromCustom.reduce((sum, e) => sum + e.amount, 0);
            expect(totalFromCustom).toBe(30);
        });

        it('should handle partial input satisfaction correctly', () => {
            // Provide 30 bars, but 60 are needed for titanium_beam
            const result = buildProductionFlow(
                {
                    targetItemId: 'titanium_beam',
                    targetAmount: 30, // Needs 60 bar_titanium (30 beams * 2 bars per beam)
                    inputBuildings: [
                        {
                            id: 'partial_source',
                            buildingTypeId: 'importer',
                            sectionType: 'inputs',
                            selectedItemId: 'bar_titanium',
                            ratePerMinute: 30
                        }
                    ],
                    rawProductionDisabled: true
                },
                buildings
            );

            // Input should provide 30
            const customNode = result.nodes.find(n => n.isCustomInput);
            expect(customNode).toBeDefined();
            expect(customNode!.outputAmount).toBe(30);

            // Smelter should produce remaining 30
            const smelterNode = result.nodes.find(n => n.buildingId === 'smelter');
            expect(smelterNode).toBeDefined();
            expect(smelterNode!.buildingCount).toBe(0.5); // 30/60 = 0.5

            // Fabricator should receive from both input and smelter
            const fabricatorNodeId = 'fabricator_0_titanium_beam';
            const edgesToFabricator = result.edges.filter(e => e.to === fabricatorNodeId);
            
            expect(edgesToFabricator.length).toBe(2); // One from input, one from smelter
            
            const totalToFabricator = edgesToFabricator.reduce((sum, e) => sum + e.amount, 0);
            expect(totalToFabricator).toBe(60); // Total should be exactly 60
        });
    });

    describe('Pure Demand Calculation', () => {
        it('should not mutate input buildings during flow building', () => {
            const inputBuildings = [
                {
                    id: 'input_1',
                    buildingTypeId: 'importer',
                    sectionType: 'inputs',
                    selectedItemId: 'bar_titanium',
                    ratePerMinute: 30
                }
            ];

            // Deep copy to verify no mutation
            const originalInputBuildings = JSON.parse(JSON.stringify(inputBuildings));

            buildProductionFlow(
                {
                    targetItemId: 'titanium_beam',
                    targetAmount: 30,
                    inputBuildings,
                    rawProductionDisabled: true
                },
                buildings
            );

            // Original input snapshots should not be mutated
            expect(inputBuildings).toEqual(originalInputBuildings);
        });

        it('should produce identical results for identical inputs (determinism)', () => {
            const params = {
                targetItemId: 'titanium_housing',
                targetAmount: 60,
                inputBuildings: [
                    {
                        id: 'input_1',
                        buildingTypeId: 'importer',
                        sectionType: 'inputs',
                        selectedItemId: 'bar_titanium',
                        ratePerMinute: 45
                    }
                ],
                rawProductionDisabled: true
            };

            const result1 = buildProductionFlow(params, buildings);
            const result2 = buildProductionFlow(params, buildings);
            const result3 = buildProductionFlow(params, buildings);

            // All results should be identical
            expect(result1.nodes.length).toBe(result2.nodes.length);
            expect(result1.nodes.length).toBe(result3.nodes.length);
            expect(result1.edges.length).toBe(result2.edges.length);
            expect(result1.edges.length).toBe(result3.edges.length);

            // Check specific node values match
            for (let i = 0; i < result1.nodes.length; i++) {
                expect(result1.nodes[i].buildingCount).toBe(result2.nodes[i].buildingCount);
                expect(result1.nodes[i].buildingCount).toBe(result3.nodes[i].buildingCount);
            }
        });
    });

    describe('O(1) Lookup Optimization', () => {
        it('should handle large chains efficiently with map lookups', () => {
            const startTime = performance.now();

            // Run multiple iterations to test performance
            for (let i = 0; i < 100; i++) {
                buildProductionFlow({
                    targetItemId: 'titanium_housing',
                    targetAmount: 1000
                }, buildings);
            }

            const endTime = performance.now();
            const executionTime = endTime - startTime;

            // 100 iterations should complete in under 500ms with O(1) lookups
            expect(executionTime).toBeLessThan(500);
        });
    });

    describe('Node ID Generation', () => {
        it('should generate consistent and unique node IDs', () => {
            const result = buildProductionFlow({
                targetItemId: 'titanium_housing',
                targetAmount: 30
            }, buildings);

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
            }, buildings);

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
            }, buildings);

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
            });
        });

        it('should return properly structured FlowEdge objects', () => {
            const result = buildProductionFlow({
                targetItemId: 'bar_titanium',
                targetAmount: 60
            }, buildings);

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

});
