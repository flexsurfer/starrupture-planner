// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './analyze';
import { extractionContext, heliumItemAsset, transportFixture } from './test-fixture';

it('retains separate one-to-one links and selections on unlinked dispatchers', () => {
    const buildings = analyzeSave(transportFixture(), extractionContext).cores.flatMap(core => core.buildings);
    expect(buildings.find(building => building.id === 20)?.configuration).toEqual({ kind: 'dispatcher', itemId: 'helium', receiverId: 30 });
    expect(buildings.find(building => building.id === 21)?.configuration).toEqual({ kind: 'dispatcher', itemId: 'helium', receiverId: 31 });
    expect(buildings.find(building => building.id === 22)?.configuration).toEqual({ kind: 'dispatcher', itemId: 'helium', receiverId: null });
    expect(buildings.find(building => building.id === 30)?.configuration).toEqual({ kind: 'receiver' });
    expect(JSON.stringify(buildings)).not.toMatch(/requestedAmount|batchQuantity|itemAsset/);
});
it.each([30, 20, 999, -1])('rejects shared, wrong-type, missing or invalid receivers: %s', receiver => {
    const save = transportFixture();
    save.itemData.CrPackageTransportReplicator.senderConnections['(ID=21)'] = { receiver: { iD: receiver }, item: heliumItemAsset };
    expect(() => analyzeSave(save, extractionContext)).toThrow('transport');
});
it('keeps a valid link with unknown item selection, without guessing from requested amounts', () => {
    const save = transportFixture();
    save.itemData.CrPackageTransportReplicator.senderConnections['(ID=20)'] = { receiver: { iD: 30 }, item: 'unknown', requestedAmount: 5000 };
    const building = analyzeSave(save, extractionContext).cores[0].buildings.find(building => building.id === 20)!;
    expect(building.configuration).toEqual({ kind: 'dispatcher', itemId: null, receiverId: 30 });
});
