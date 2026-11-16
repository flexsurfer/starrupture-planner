import { useEffect } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import { watchAppUpdates } from '@/platform/web/app-updates';

export function AppUpdateMonitor() {
    const runtime = useRuntime();
    useEffect(() => {
        if (!import.meta.env.PROD) return;
        return watchAppUpdates(version => runtime.dispatch([appIds.events.APP_UPDATE_AVAILABLE, version]));
    }, [runtime]);
    return null;
}
