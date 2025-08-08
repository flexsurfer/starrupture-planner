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

export const ItemImage = ({ 
  itemId, 
  item, 
  className = '', 
  size = 'medium',
  showFallback = true,
  style = {}
}: ItemImageProps) => {
  const imagePath = `./icons/items/${itemId}.jpg`;
  const baseClasses = `${sizeClasses[size]} object-cover rounded`;
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses;
  
  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
      <img
        src={imagePath}
        alt={item?.name || itemId}
        className={finalClassName}
        style={style}
        onError={(e) => {
          if (showFallback) {
            // Fallback to showing the item ID if image doesn't exist
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'block';
            }
          }
        }}
      />
      {showFallback && (
        <code className="text-xs bg-base-200 px-1 py-0.5 rounded hidden text-center">
          {itemId}
        </code>
      )}
    </div>
  );
};
