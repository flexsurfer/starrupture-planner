import React from 'react';
import type { Base } from '../../../state/db';
import type { BaseDetailTab } from '../types';
import { BaseCard } from './BaseCard';

interface BasesListProps {
  bases: Base[];
  onOpen: (baseId: string, tab?: BaseDetailTab) => void;
  onDelete: (baseId: string) => void;
}

export const BasesList: React.FC<BasesListProps> = ({
  bases,
  onOpen,
  onDelete,
}) => {
  if (bases.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {bases.map((base) => (
        <BaseCard
          key={base.id}
          base={base}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
