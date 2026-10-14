import { useState } from 'react';
import { ItemImage } from '@/shared/ui';
import type { SaveResource } from '../overview';

type ImageBounds = { x: number; y: number; width: number; height: number };
const fullImage: ImageBounds = { x: 0, y: 0, width: 1, height: 1 };
const imageBounds = new Map<string, ImageBounds>();

/** Measure each asset once; display its visible artwork without altering the source image. */
function visibleBounds(image: HTMLImageElement): ImageBounds {
    const cached = imageBounds.get(image.src);
    if (cached) return cached;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) return fullImage;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] <= 8) continue;
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        const bounds = right < left ? fullImage : {
            x: left / canvas.width, y: top / canvas.height,
            width: (right - left + 1) / canvas.width, height: (bottom - top + 1) / canvas.height,
        };
        imageBounds.set(image.src, bounds);
        return bounds;
    } catch {
        // Unreadable pixels still get the normal item image and its existing fallback.
        return fullImage;
    }
}

export function SaveMapResourceMarker({ resource, markerSize }: { resource: SaveResource; markerSize: number }) {
    const [bounds, setBounds] = useState<ImageBounds>(fullImage);
    const size = Math.min(34, markerSize * 0.4);
    const aspect = bounds.width / bounds.height;
    return <span className="save-map-resource-marker" style={{
        width: aspect >= 1 ? size : size * aspect, height: aspect >= 1 ? size / aspect : size,
    }} onLoadCapture={event => {
        if (event.target instanceof HTMLImageElement) setBounds(visibleBounds(event.target));
    }}>
        <span className="save-map-resource-image">
            <ItemImage itemId={resource.itemId} item={{ name: resource.name }} size="small" style={{
                position: 'absolute', maxWidth: 'none',
                width: `${100 / bounds.width}%`, height: `${100 / bounds.height}%`,
                left: `${-100 * bounds.x / bounds.width}%`, top: `${-100 * bounds.y / bounds.height}%`,
            }} />
        </span>
    </span>;
}
