import type { Building } from '@/app/uklad/model';
import corporations from '../../../../assets/game-data/update2_QoL/corporations_components.json';
import { createSaveBuildingCatalog, createSaveGameData } from '../game-data';
import type { SaveDecodeContext } from './types';
import buildingMappings from '../../../../assets/game-data/update2_QoL/save_buildings_mappings.json';
import itemMappings from '../../../../assets/game-data/update2_QoL/save_items_mappings.json';
import recipeMappings from '../../../../assets/game-data/update2_QoL/save_recipes_mappings.json';
import rawBuildings from '../../../../assets/game-data/update2_QoL/buildings_and_recipes.json';
import items from '../../../../assets/game-data/update2_QoL/items_catalog.json';
import { parseSaveMappings } from './mappings';

const buildings = rawBuildings as Building[];

export const saveContext: SaveDecodeContext = {
    mappings: parseSaveMappings('update2_QoL', buildingMappings, itemMappings, recipeMappings),
    itemIds: new Set(['helium', 'calcite_sheets', 'powder_calcium']),
    dataVersion: 'update2_QoL', buildingIds: new Set(['smelter', 'fabricator', 'base_core']),
};

export const saveGameData = { buildings, items, corporations,
    saveBuildingCatalog: createSaveBuildingCatalog(saveContext.mappings, buildings) };
export const saveDataContext = { dataVersion: saveContext.dataVersion, buildings, items };
export const saveLookups = createSaveGameData(buildings, items, saveGameData.saveBuildingCatalog);

export function saveEntity(asset: string, x: number, fragments: string[] = []) {
    return {
        spawnData: { entityConfigDataPath: `/Game/Chimera/Buildings/${asset}`, transform: { translation: { x, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 }, scale3D: { x: 1, y: 1, z: 1 } } },
        fragmentValues: fragments,
    };
}

export function coreEntity(x: number) {
    return saveEntity('BaseCore/DA_BaseCore.DA_BaseCore', x, [
        '/Script/AuActorPlacement.AuAPMassFragment(SpawnServerTimeSeconds=10.500000)',
        `/Script/Chimera.CrMassBuildingBaseCoreFragment(CachedBoundingBox=(Min=(X=${x - 10}.000000,Y=-10.000000,Z=-10.000000),Max=(X=${x + 10}.000000,Y=10.000000,Z=10.000000),IsValid=True))`,
    ]);
}

/** Synthetic cases only. Sanitized source-field evidence lives in fixtures/. */
export function saveFixture() {
    return {
        timestamp: '20260403130014', gameVersion: { major: 0, minor: 2, pATCH: 0 },
        itemData: {
            CrBuildingCustomNameSubsystem: { customNames: { '(ID=1)': 'Workshop' } },
            BaseCoreReplicationHelperSaveData: { baseCoreSaveData: [
                { baseCore: { iD: 1 }, upgradeLevel: 0 }, { baseCore: { iD: 2 }, upgradeLevel: 3 },
            ] },
            Mass: {
                entities: {
                    '(ID=1)': coreEntity(0), '(ID=2)': coreEntity(30),
                    '(ID=10)': saveEntity('Smelter/DA_Smelter.DA_Smelter', 0, [
                        '/Script/Chimera.CrBuildingStateFragment(bDisabled=False)',
                        '/Script/Chimera.CrCraftingFragment(SelectedRecipe="/Game/Chimera/Crafting/CR_TitaniumBar.CR_TitaniumBar",CurrentRecipe=None)',
                    ]),
                    '(ID=11)': saveEntity('Crafter/DA_Crafter.DA_Crafter', 30),
                    '(ID=12)': saveEntity('Unknown/DA_Unknown.DA_Unknown', 0),
                },
                electricitySubsystemState: { nodeData: {
                    '(UId=(ID=1))': { handle: { iD: 1 }, subGraph: { subGraphId: 7 } },
                    '(UId=(ID=2))': { handle: { iD: 2 }, subGraph: { subGraphId: 8 } },
                    '(UId=(ID=10))': { handle: { iD: 10 }, subGraph: { subGraphId: 9 } },
                    '(UId=(ID=11))': { handle: { iD: 11 }, subGraph: { subGraphId: 9 } },
                } },
            },
        },
    };
}

export const heliumItemAsset = "/Game/Chimera/Items/I_HeliumOre.I_HeliumOre_C'/Game/Chimera/Items/I_HeliumOre.Default__I_HeliumOre_C'";

export function transportFixture() {
    const save = saveFixture();
    const senderConnections: Record<string, unknown> = {
        '(ID=20)': { receiver: { iD: 30 }, item: heliumItemAsset, requestedAmount: 100 },
        '(ID=21)': { receiver: { iD: 31 }, item: heliumItemAsset, requestedAmount: 100 },
        '(ID=22)': { receiver: { iD: 4294967295 }, item: heliumItemAsset, requestedAmount: 0 },
    };
    return { ...save, itemData: { ...save.itemData,
        CrPackageTransportReplicator: { senderConnections },
        Mass: { ...save.itemData.Mass, entities: { ...save.itemData.Mass.entities,
            '(ID=20)': saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', 0),
            '(ID=21)': saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', 5),
            '(ID=22)': saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', 100),
            '(ID=23)': saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', 0),
            '(ID=30)': saveEntity('PackageStation/PackageReceiver/DA_PackageReceiver.DA_PackageReceiver', 30),
            '(ID=31)': saveEntity('PackageStation/PackageReceiver/DA_PackageReceiver.DA_PackageReceiver', 100),
        } },
    } };
}

export const extractionContext: SaveDecodeContext = { ...saveContext, buildingIds: new Set(buildings.map(building => building.id)), itemIds: new Set(items.map(item => item.id)) };

export function extractorEntity(tier: 1 | 2, purity: 'impure' | 'normal' | 'pure', x = 0, fields = '') {
    const folder = tier === 1 ? 'MechanicalDrill' : 'MechanicalDrillTier2';
    const suffix = purity === 'normal' ? '' : purity === 'impure' ? 'Impure' : 'Pure';
    const recipe = `CR_TitaniumOre${suffix}_${folder}`;
    return saveEntity(`${folder}/DA_${folder}.DA_${folder}`, x, [
        '/Script/Chimera.CrBuildingStateFragment(bDisabled=False)',
        `/Script/Chimera.CrCraftingFragment(SelectedRecipe="/Script/Chimera.CrItemRecipeData'/Game/Chimera/Crafting/${folder}/${recipe}.${recipe}'",CraftingSpeed=1.000000,CraftingMultiplier=1,bOutputFull=False,bIsMissingItems=False${fields})`,
    ]);
}

export function extractionFixture() {
    const save = transportFixture();
    return { ...save, gameVersion: { major: 0, minor: 3, pATCH: 5 }, itemData: { ...save.itemData,
        Mass: { ...save.itemData.Mass, entities: { ...save.itemData.Mass.entities,
            '(ID=100)': extractorEntity(1, 'impure'), '(ID=101)': extractorEntity(1, 'normal'),
            '(ID=102)': extractorEntity(1, 'pure'), '(ID=103)': extractorEntity(2, 'impure', 30),
            '(ID=104)': extractorEntity(2, 'normal', 30), '(ID=105)': extractorEntity(2, 'pure', 30),
            '(ID=106)': saveEntity('GasExtractor/DA_GasExtractor.DA_GasExtractor', 100, [
                '/Script/Chimera.CrBuildingStateFragment(bDisabled=True)',
                `/Script/Chimera.CrCraftingFragment(SelectedRecipe="/Script/Chimera.CrItemRecipeData'/Game/Chimera/Crafting/CR_Helium.CR_Helium'",CraftingSpeed=1.000000,CraftingMultiplier=1,bOutputFull=True,bIsMissingItems=False)`,
            ]),
        } },
    } };
}

export function productionEntity(folder: string, recipe: string | null, x = 0, disabled = false) {
    return saveEntity(`${folder}/DA_${folder}.DA_${folder}`, x, [
        `/Script/Chimera.CrBuildingStateFragment(bDisabled=${disabled ? 'True' : 'False'})`,
        ...(recipe === null ? [] : [`/Script/Chimera.CrCraftingFragment(SelectedRecipe=${recipe === 'None' ? 'None'
            : `"/Script/Chimera.CrItemRecipeData'/Game/Chimera/Crafting/${recipe}.${recipe}'"`},CurrentRecipe=None,CraftingSpeed=1.000000,CraftingMultiplier=1,bOutputFull=False,bIsMissingItems=False)`]),
    ]);
}

/** Deliberate edge cases; these settings and geometry are synthetic. */
export function snapshotFixture() {
    const save = extractionFixture();
    const entities: Record<string, ReturnType<typeof saveEntity>> = { ...save.itemData.Mass.entities,
        '(ID=2)': coreEntity(5),
        '(ID=200)': productionEntity('Crafter', 'CR_Tube', 0, true),
        '(ID=201)': productionEntity('CrafterTier2', 'CR_Tube_v2'),
        '(ID=202)': productionEntity('CrafterTier2', 'CR_Tube_v3'),
        '(ID=203)': productionEntity('CrafterTier2', 'CR_Unknown'),
        '(ID=204)': productionEntity('CrafterTier2', 'None'),
        '(ID=205)': productionEntity('CrafterTier2', null),
        '(ID=206)': productionEntity('Smelter', 'CR_Tube_v2', 100),
    };
    return { ...save, itemData: { ...save.itemData, Mass: { ...save.itemData.Mass, entities } } };
}
