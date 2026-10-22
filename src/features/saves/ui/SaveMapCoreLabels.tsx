import { useMemo, type ReactNode } from 'react';
import { useStore } from '@xyflow/react';
import { placeCoreLabels, type CoreLabelPeer } from './map-display';
import { CoreLabelsContext } from './core-labels-context';

// Only Core markers consume this context. Buildings and the canvas do not render on zoom frames.
export function SaveMapCoreLabels({ peers, children }: { peers: CoreLabelPeer[]; children: ReactNode }) {
    const zoom = useStore(state => state.transform[2]);
    const value = useMemo(() => ({ zoom, placements: placeCoreLabels(peers, zoom) }), [peers, zoom]);
    return <CoreLabelsContext value={value}>{children}</CoreLabelsContext>;
}
