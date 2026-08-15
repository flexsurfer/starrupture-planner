import { createUkladHooks } from '@ukladjs/core/react';
import type { AppContracts } from './contracts';

/** The provider and hooks paired with the one application runtime contract. */
export const { UkladProvider, useRuntime, useSubscription } =
    createUkladHooks<AppContracts>();
