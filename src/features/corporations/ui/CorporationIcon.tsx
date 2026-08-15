type CorporationIconProps = {
  corporationId: string;
  corporationName: string;
};

export const CorporationIcon = ({ corporationId, corporationName }: CorporationIconProps) => {
  const webpImagePath = `./icons/corporations/${corporationId}.webp`;
  
  return (
    <div className="flex items-center justify-center w-16 h-16">
      <img
        key={corporationId}
        src={webpImagePath}
        alt={corporationName}
        className="w-16 h-16"
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onError={(e) => {
          const target = e.currentTarget;
          // Fallback to placeholder if image fails to load
          target.style.display = 'none';
          target.nextElementSibling?.classList.remove('hidden');
          target.nextElementSibling?.classList.add('flex');
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
