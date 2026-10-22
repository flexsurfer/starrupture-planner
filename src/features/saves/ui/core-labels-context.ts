import { createContext } from 'react';

export const CoreLabelsContext = createContext({ zoom: 1, placements: new Map<number, { x: number; y: number }>() });
