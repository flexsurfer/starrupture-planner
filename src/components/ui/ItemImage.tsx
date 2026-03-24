import type { Item } from "../../state/db";

export interface ItemImageProps {
  itemId: string;
  item?: Item;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showFallback?: boolean;
  style?: React.CSSProperties;
}

const sizeClasses = {
  small: 'w-10 h-10',
  medium: 'w-15 h-15', 
  large: 'w-30 h-30'
};

const sizePixels = {
  small: 40,
  medium: 60,
  large: 120,
};

export const ItemImage = ({ 
  itemId, 
  item, 
  className = '', 
  size = 'medium',
  showFallback = true,
  style = {}
}: ItemImageProps) => {
  const webpImagePath = `./icons/items/${itemId}.webp`;
  const baseClasses = `${sizeClasses[size]} object-cover`;
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses;
  const pixelSize = sizePixels[size];
  
  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
      <img
        key={itemId}
        src={webpImagePath}
        alt={item?.name || itemId}
        className={finalClassName}
        width={pixelSize}
        height={pixelSize}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        style={{...style, display: 'block'}} // Ensure image is visible initially
        onError={(e) => {
          const target = e.currentTarget;
          if (showFallback) {
            // Fallback to showing a no-picture icon if image doesn't exist
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }
        }}
        onLoad={(e) => {
          // Ensure fallback is hidden when image loads successfully
          const target = e.currentTarget;
          target.style.display = 'block';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) {
            fallback.style.display = 'none';
          }
        }}
      />
      {showFallback && (
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
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
