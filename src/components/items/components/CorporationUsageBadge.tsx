import type { CorporationUsage } from "../types";

interface CorporationUsageBadgeProps {
  usage: CorporationUsage;
  corporationId: string;
}

export const CorporationUsageBadge = ({ usage, corporationId }: CorporationUsageBadgeProps) => {
  const webpImagePath = `./icons/corporations/${corporationId}.webp`;
  
  return (
    <div 
      className="flex items-center gap-1 badge badge-sm badge-ghost px-1"
      title={`${usage.corporation} - Level ${usage.level}`}
    >
      <img
        key={corporationId}
        src={webpImagePath}
        alt={usage.corporation}
        className="w-4 h-4 rounded object-cover"
        width={16}
        height={16}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onError={(e) => {
          const target = e.currentTarget;
          // Hide image if it fails to load
          target.style.display = 'none';
        }}
      />
      <span className="text-xs">
        {usage.corporation.split(' ')[0]} L{usage.level}
      </span>
    </div>
  );
};
