import type { UkladModule, UkladRegistrar, UkladRuntime } from '@ukladjs/core/vanilla';
import { registerAppShellModule } from '@/features/app-shell/module';
import { registerBasesModule } from '@/features/bases/module';
import { registerBuildingsModule } from '@/features/buildings/module';
import { registerCorporationsModule } from '@/features/corporations/module';
import { registerEnergyGroupsModule } from '@/features/energy-groups/module';
import { registerItemsModule } from '@/features/items/module';
import { registerPlannerModule } from '@/features/planner/module';
import { registerProductionPlansModule } from '@/features/production-plans/module';
import { registerProductionPlanModalModule } from '@/features/production-plan-modal/module';
import { registerWebEffects } from '@/platform/web/effects';
import type { AppContracts } from './contracts';

/** Installs the feature modules shared by every application execution target. */
export const registerApplicationModules: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerAppShellModule(registrar);
    registerCorporationsModule(registrar);
    registerBuildingsModule(registrar);
    registerItemsModule(registrar);
    registerPlannerModule(registrar);
    registerProductionPlansModule(registrar);
    registerProductionPlanModalModule(registrar);
    registerBasesModule(registrar);
    registerEnergyGroupsModule(registrar);
};

/** Installs shared features and exactly the browser platform adapters. */
export function registerWebApplication(runtime: UkladRuntime<AppContracts>): void {
    runtime.registerModule(registerApplicationModules);
    runtime.registerModule(registerWebEffects);
}
