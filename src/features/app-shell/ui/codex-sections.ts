import type { TabType } from '@/app/uklad/model';
import type { MessageKey } from '@/shared/i18n';
import type { SectionIconName } from '@/shared/ui';

export type CodexSection = Extract<TabType, 'items' | 'recipes' | 'corporations'>;
export const codexSections: { id: CodexSection; label: MessageKey; icon: SectionIconName }[] = [
    { id: 'items', label: 'Items', icon: 'items' },
    { id: 'recipes', label: 'Buildings & Recipes', icon: 'buildings' },
    { id: 'corporations', label: 'Corporations', icon: 'corporations' },
];
