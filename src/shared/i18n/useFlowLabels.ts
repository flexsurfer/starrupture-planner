import { useMemo } from 'react';
import type { ReactFlowProps } from '@xyflow/react';
import { useTranslation } from './index';

/** React Flow's built-in controls and screen-reader announcements are UI too. */
export function useFlowLabels(): ReactFlowProps['ariaLabelConfig'] {
    const { t } = useTranslation();
    return useMemo(() => ({
        'controls.ariaLabel': t('Diagram controls'),
        'controls.zoomIn.ariaLabel': t('Zoom in'),
        'controls.zoomOut.ariaLabel': t('Zoom out'),
        'controls.fitView.ariaLabel': t('Fit view'),
        'controls.interactive.ariaLabel': t('Toggle interactivity'),
        'minimap.ariaLabel': t('Mini map'),
        'handle.ariaLabel': t('Connection handle'),
        'node.a11yDescription.default': t('Press enter or space to select a node. Press escape to cancel.'),
        'node.a11yDescription.keyboardDisabled': t('Press enter or space to select a node. Use the arrow keys to move it. Press escape to cancel.'),
        'edge.a11yDescription.default': t('Press enter or space to select a connection. Press escape to cancel.'),
        'node.a11yDescription.ariaLiveMessage': ({ x, y }) => t('New position: x {x}, y {y}.', { x, y }),
    }), [t]);
}
