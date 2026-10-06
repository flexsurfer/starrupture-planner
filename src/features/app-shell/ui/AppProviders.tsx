import { StrictMode, type ReactNode } from 'react';
import { UkladProvider } from '@/app/uklad/bindings';
import { runtime } from '@/platform/web/bootstrap';
import { AppLocalization } from './AppLocalization';

/** Both browser entry points share the same runtime and persisted preferences. */
export function AppProviders({ children }: { children: ReactNode }) {
    return <StrictMode>
        <UkladProvider runtime={runtime}>
            <AppLocalization>{children}</AppLocalization>
        </UkladProvider>
    </StrictMode>;
}
