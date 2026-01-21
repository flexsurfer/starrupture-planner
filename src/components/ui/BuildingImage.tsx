import type { Building } from "../../state/db";

export interface BuildingImageProps {
  buildingId: string;
  building?: Building;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  style?: React.CSSProperties;
}

const sizeClasses = {
  small: 'w-10 h-10',
  medium: 'w-15 h-15',
  large: 'w-30 h-30'
};

export const BuildingImage = ({
  buildingId,
  building,
  className = '',
  size = 'large',
  style = {}
}: BuildingImageProps) => {
  const imagePath = `./icons/buildings/${buildingId}.jpg`;
  const baseClasses = `${sizeClasses[size]} object-cover`;
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <div className={finalClassName}>
      <img
        src={imagePath}
        alt={building?.name || buildingId}
        className={finalClassName}
        style={{...style, display: 'block'}} // Ensure image is visible initially
        onError={(e) => {
          // Fallback to showing a building icon if image doesn't exist
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) {
            fallback.style.display = 'flex';
          }
        }}
        onLoad={(e) => {
          // Ensure fallback is hidden when image loads successfully
          const target = e.target as HTMLImageElement;
          target.style.display = 'block';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) {
            fallback.style.display = 'none';
          }
        }}
      />
      <div className="hidden items-center justify-center rounded w-full h-full">
        <svg
          className="w-6 h-6 text-base-content/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
    </div>
  );
};
