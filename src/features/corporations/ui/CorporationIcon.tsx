type CorporationIconProps = {
  corporationId: string;
  corporationName: string;
};

export const CorporationIcon = ({ corporationId, corporationName }: CorporationIconProps) => {
  const webpImagePath = `./icons/corporations/${corporationId}.webp`;
  
  return (
    <div className="flex size-10 shrink-0 items-center justify-center sm:size-12">
      <img
        key={corporationId}
        src={webpImagePath}
        alt={corporationName}
        className="size-full object-contain"
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
      <div className="hidden size-full items-center justify-center rounded bg-base-300">
        <span className="text-[9px] text-center font-medium px-1 break-words">
          {corporationName}
        </span>
      </div>
    </div>
  );
};
