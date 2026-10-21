import { deflateSync } from 'node:zlib';
import { coreEntity, productionEntity, saveEntity, heliumItemAsset } from '../../src/features/saves/decoder/test-fixture';

/** Synthetic parser fixture for the planner UI, not a playable game world. */
export function factoryMapOverlapFixture() {
    const entities: Record<string, ReturnType<typeof saveEntity>> = {};
    const customNames: Record<string, string> = {};
    const nodeData: Record<string, unknown> = {};
    const senderConnections: Record<string, unknown> = {};
    const baseCoreSaveData: { baseCore: { iD: number }; upgradeLevel: number }[] = [];
    let origin = { x: 0, y: 0 };
    const add = (id: number, name: string, entity: ReturnType<typeof saveEntity>, x: number, y: number, z = 0) => {
        entity.spawnData.transform.translation = { x: origin.x + x, y: origin.y + y, z };
        entities[`(ID=${id})`] = entity;
        customNames[`(ID=${id})`] = name;
        nodeData[`(UId=(ID=${id}))`] = { handle: { iD: id }, subGraph: { subGraphId: Math.floor(id / 100) % 3 } };
    };
    const core = (id: number, name: string) => {
        origin = { x: ((id - 1) % 4) * 50000, y: Math.floor((id - 1) / 4) * 50000 };
        const entity = coreEntity(origin.x);
        entity.fragmentValues[1] = `/Script/Chimera.CrMassBuildingBaseCoreFragment(CachedBoundingBox=(Min=(X=${origin.x - 500},Y=${origin.y - 500},Z=-1000),Max=(X=${origin.x + 4500},Y=${origin.y + 3500},Z=12000),IsValid=True))`;
        add(id, name, entity, 0, 0);
        baseCoreSaveData.push({ baseCore: { iD: id }, upgradeLevel: 3 });
    };
    const fabricator = (id: number, name: string, x: number, y: number, z = 0, recipe = 'CR_WolframWire') =>
        add(id, name, productionEntity('Crafter', recipe), x, y, z);

    core(1, '01 · Aligned layers — 8 fabricators');
    for (let i = 0; i < 8; i++) fabricator(101 + i, `Exact ${i + 1}`, 1500 + (i % 2) * 1200,
        800 + (Math.floor(i / 2) % 2) * 1200, i < 4 ? 0 : 1800);

    core(2, '02 · Offset mixed buildings — three node layers');
    fabricator(201, 'Offset Fabricator', 1700, 1500);
    add(202, 'Offset Smelter', productionEntity('Smelter', 'CR_WolframBar'), 1880, 1580, 1800);
    fabricator(203, 'Offset Tube', 1960, 1700, -900, 'CR_Tube');

    core(3, '03 · Same Z — never stacked');
    // Deliberately impossible coincident models exercise the same-Z guard.
    fabricator(301, 'Same Z diagnostic A', 1500, 600, 1000);
    fabricator(302, 'Same Z diagnostic B', 1500, 600, 1000);
    fabricator(303, 'Same Z nearby A', 3000, 600, 1000);
    fabricator(304, 'Same Z nearby B', 3360, 960, 1000);
    fabricator(305, 'Same Z separate A', 1500, 2400, 1000);
    fabricator(306, 'Same Z separate B', 2100, 2400, 1000);
    fabricator(307, 'Same Z edge A', 3000, 2400, 1000);
    fabricator(308, 'Same Z edge B', 3720, 2400, 1000);

    core(4, '04 · Rotation — matching and different poses');
    fabricator(401, 'Rotated lower', 1900, 1500);
    fabricator(402, 'Rotated upper', 1900, 1500, 1800);
    fabricator(403, 'Different rotation — same node position', 1900, 1500, 3600);
    for (const id of [401, 402]) entities[`(ID=${id})`].spawnData.transform.rotation = {
        x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8),
    };

    core(5, '05 · Ten layers — irregular heights and names');
    const elevations = [-1800, -100, 0, 900, 2700, 6000, 12000, 23000, 50000, 90000];
    for (let i = 0; i < 10; i++) fabricator(501 + i, 'Repeated name', 1900, 1500, elevations[i],
        i % 2 ? 'CR_Tube' : 'CR_WolframWire');

    core(6, '06 · Uneven ground — only overlaps add levels');
    fabricator(601, 'Nearby lower', 1500, 1200);
    fabricator(602, 'Nearby upper', 2700, 1200, 1800);
    fabricator(603, 'Valley stack lower', 3200, 2600, -2000);
    fabricator(604, 'Valley stack upper', 3200, 2600, -200);

    core(7, '07 · Cargo — independent endpoint layers');
    add(701, 'Cargo sender A', saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', 0), 1500, 1000);
    add(702, 'Cargo sender B', saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', 0), 1500, 1000, 1800);
    add(703, 'Cargo receiver A', saveEntity('PackageStation/PackageReceiver/DA_PackageReceiver.DA_PackageReceiver', 0), 3000, 900);
    add(704, 'Cargo receiver B', saveEntity('PackageStation/PackageReceiver/DA_PackageReceiver.DA_PackageReceiver', 0), 3000, 900, 2600);
    for (const [sender, receiver] of [[701, 703], [702, 704]]) {
        senderConnections[`(ID=${sender})`] = { receiver: { iD: receiver }, item: heliumItemAsset, requestedAmount: 100 };
    }

    core(8, '08 · Node size — aligned and offset stacks');
    fabricator(801, 'Resize lower', 1500, 1500, 123.25);
    fabricator(802, 'Resize upper', 1500, 1500, 3479.5);
    // 64 map units apart: separate at 56/72, overlapping at 88 with the 10% edge inset.
    fabricator(803, 'Large-only middle', 2140, 1500, 3479.5);
    fabricator(804, 'Large-only upper', 2780, 1500, 6000);
    for (const id of [801, 802]) {
        entities[`(ID=${id})`].spawnData.transform.rotation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
        entities[`(ID=${id})`].spawnData.transform.scale3D = { x: 1.2, y: .8, z: 1 };
    }

    return {
        timestamp: '20261021120000', gameVersion: { major: 0, minor: 3, pATCH: 5 },
        itemData: {
            CrBuildingCustomNameSubsystem: { customNames },
            BaseCoreReplicationHelperSaveData: { baseCoreSaveData },
            CrPackageTransportReplicator: { senderConnections },
            Mass: { entities, electricitySubsystemState: { nodeData } },
        },
    };
}

export function encodeOverlapFixture(): Uint8Array<ArrayBuffer> {
    const json = Buffer.from(JSON.stringify(factoryMapOverlapFixture()), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(json.length);
    return Uint8Array.from(Buffer.concat([header, deflateSync(json)]));
}
