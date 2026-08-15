interface ItemsStatsProps {
  totalItems: number;
}

export const ItemsStats = ({ totalItems }: ItemsStatsProps) => {
  return (
      <div  >
        <span className="text-sm font-semibold">Total: </span>
        <span className="text-base font-bold">{totalItems}</span>
      </div>
  );
};
