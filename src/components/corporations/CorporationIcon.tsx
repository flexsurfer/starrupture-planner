type CorporationIconProps = {
  corporationId: string;
  corporationName: string;
};

export const CorporationIcon = ({ corporationId, corporationName }: CorporationIconProps) => {
  const imagePath = `./icons/corporations/${corporationId}.jpg`;
  
  return (
    <div className="flex items-center justify-center w-16 h-16">
      <img
        src={imagePath}
        alt={corporationName}
        className="w-16 h-16 rounded-lg shadow-md object-cover"
        onError={(e) => {
          // Fallback to placeholder if image fails to load
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
          e.currentTarget.nextElementSibling?.classList.add('flex');
        }}
      />
      <div className="w-16 h-16 bg-base-300 rounded-lg shadow-md hidden items-center justify-center">
        <span className="text-xs text-center font-medium px-2">
          {corporationName}
        </span>
      </div>
    </div>
  );
};
