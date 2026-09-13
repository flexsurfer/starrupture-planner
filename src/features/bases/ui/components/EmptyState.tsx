import React from 'react';

interface EmptyStateProps {
  onCreateBase: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onCreateBase }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="max-w-md">
        <div className="mb-6">
          <div className="text-6xl mb-4">🏗️</div>
        </div>
        <h2 className="text-2xl font-bold mb-4">No Bases Created</h2>
        <p className="text-base-content/70 mb-6">
          A Core is required to create a Base. The Core defines the buildable area where you can place buildings.
        </p>
        <p className="text-base-content/60 mb-8 text-sm">
          You can create and manage multiple Bases to organize your production facilities.
        </p>
        <button
          type="button"
          className="btn btn-sm btn-primary btn-outline h-8 min-h-8 min-w-8 gap-1 px-2 text-xs"
          onClick={onCreateBase}
        >
          <span aria-hidden="true">＋</span>
          Create Base
        </button>
      </div>
    </div>
  );
};
