interface ItemsStatsProps {
  totalItems: number;
}

export const ItemsStats = ({ totalItems }: ItemsStatsProps) => {
  return (
    <div className="stats shadow">
      <div className="stat">
        <div className="stat-title">Total Items</div>
        <div className="stat-value text-2xl">{totalItems}</div>
      </div>
    </div>
  );
};
