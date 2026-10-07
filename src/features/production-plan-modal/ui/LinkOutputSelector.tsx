import type { LinkableOutputItem } from '@/features/bases/types';
import { ConnectionSelector } from '@/features/bases/ui/components/ConnectionSelector';

interface LinkOutputSelectorProps {
    outputs: LinkableOutputItem[];
    onSelect: (output: LinkableOutputItem) => void;
    emptyMessage: string;
    compact?: boolean;
}

export function LinkOutputSelector({ outputs, ...props }: LinkOutputSelectorProps) {
    return <ConnectionSelector entries={outputs} direction="output" {...props} />;
}
