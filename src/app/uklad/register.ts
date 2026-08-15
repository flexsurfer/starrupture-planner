import type { UkladRuntime } from '@ukladjs/core/vanilla';
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

/** Installs shared features and exactly the browser platform adapters. */
export function registerWebApplication(runtime: UkladRuntime<AppContracts>): void {
    runtime.registerModule(registerAppShellModule);
    runtime.registerModule(registerCorporationsModule);
    runtime.registerModule(registerBuildingsModule);
    runtime.registerModule(registerItemsModule);
    runtime.registerModule(registerPlannerModule);
    runtime.registerModule(registerProductionPlansModule);
    runtime.registerModule(registerProductionPlanModalModule);
    runtime.registerModule(registerBasesModule);
    runtime.registerModule(registerEnergyGroupsModule);
    runtime.registerModule(registerWebEffects);
}
