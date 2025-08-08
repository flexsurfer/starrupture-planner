import type { CorporationUsage } from "./types";

interface CorporationUsageBadgeProps {
  usage: CorporationUsage;
  corporationId: string;
}

export const CorporationUsageBadge = ({ usage, corporationId }: CorporationUsageBadgeProps) => {
  const imagePath = `./icons/corporations/${corporationId}.jpg`;
  
  return (
    <div 
      className="flex items-center gap-1 badge badge-sm badge-ghost px-1"
      title={`${usage.corporation} - Level ${usage.level}`}
    >
      <img
        src={imagePath}
        alt={usage.corporation}
        className="w-4 h-4 rounded object-cover"
        onError={(e) => {
          // Hide image if it fails to load
          e.currentTarget.style.display = 'none';
        }}
      />
      <span className="text-xs">
        {usage.corporation.split(' ')[0]} L{usage.level}
      </span>
    </div>
  );
};
