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
  const baseClasses = `${sizeClasses[size]} object-cover rounded`;
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses;
  
  return (
    <img
      src={imagePath}
      alt={building?.name || buildingId}
      className={finalClassName}
      style={style}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};
