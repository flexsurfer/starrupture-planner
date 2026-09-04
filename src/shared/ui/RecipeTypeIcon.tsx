import type { RecipeDisplayType } from '@/app/uklad/model';

interface RecipeTypeIconProps {
  recipeType: RecipeDisplayType;
  className?: string;
}

export const RecipeTypeIcon = ({ recipeType, className = '' }: RecipeTypeIconProps) => {
  if (recipeType === 'standard') return null;

  const isAlternative = recipeType === 'alternative';
  const label = isAlternative ? 'Alternative recipe' : 'V.2 recipe';

  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border shadow-sm ${
        isAlternative
          ? 'border-secondary/40 bg-secondary/15 text-secondary'
          : 'border-info/40 bg-info/15 text-info'
      } ${className}`.trim()}
      title={label}
      aria-label={label}
    >
      {isAlternative ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
          <path
            d="M3 12h5c4 0 4-6 9-6h3M8 12c4 0 4 6 9 6h3"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m17 3 3 3-3 3M17 15l3 3-3 3"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
          <path d="m6 11 6-6 6 6M6 18l6-6 6 6" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
};
