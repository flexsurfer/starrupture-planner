import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerProductionPlansEvents } from './events';

export const registerProductionPlansModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerProductionPlansEvents(registrar);
};
