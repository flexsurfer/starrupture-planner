import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { describeConnection } from '@/features/bases/connections';
import type { BuildingConnection } from '@/features/bases/types';
import { message, useTranslation } from '@/shared/i18n';
import { connectionReferenceLabel } from './utils/connectionLabels';

export function useDisconnectConnections() {
    const runtime = useRuntime();
    const { t } = useTranslation();
    const bases = useSubscription([appIds.subscriptions.BASES_LIST]);
    const buildings = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);

    return (connections: BuildingConnection[]) => {
        if (!connections.length) return;
        const description = connections.map(({ source, target }) =>
            `${connectionReferenceLabel(describeConnection(bases, buildings, source), t)} → ${connectionReferenceLabel(describeConnection(bases, buildings, target), t)}`
        ).join('\n');
        runtime.dispatch([appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
            message('Disconnect'),
            message('Are you sure you want to disconnect?\n\n{connections}\n\nInputs will return to manual mode with no material or rate configured.', { connections: description }),
            () => runtime.dispatch([appIds.events.BASES_DISCONNECT_CONNECTIONS, connections]),
            { confirmLabel: message(connections.length > 1 ? 'Disconnect all' : 'Disconnect') },
        ]);
    };
}
