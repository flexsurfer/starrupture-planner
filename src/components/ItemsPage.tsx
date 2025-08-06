import { dispatch, useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../state/sub-ids";
import type { Item } from "../state/db";
import { EVENT_IDS } from "../state/event-ids";

const ItemsPage = () => {
  const filteredItems = useSubscription<Item[]>([SUB_IDS.FILTERED_ITEMS]);
  const selectedCategory = useSubscription<string>([SUB_IDS.SELECTED_CATEGORY]);
  const categories = useSubscription<string[]>([SUB_IDS.CATEGORIES]);

  const getCategoryDisplayName = (category: string) => {
    if (category === 'all') return 'All Items';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const ItemIcon = ({ item }: { item: Item }) => {
    const imagePath = `./icons/items/${item.id}.jpg`;
    
    return (
      <div className="flex items-center justify-center w-15 h-15">
        <img
          src={imagePath}
          alt={item.name}
          className="w-15 h-15 object-cover rounded"
          onError={(e) => {
            // Fallback to showing the ID if image doesn't exist
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'block';
            }
          }}
        />
        <code className="text-xs bg-base-200 px-1 py-0.5 rounded hidden">
          {item.id}
        </code>
      </div>
    );
  };

  const getCategoryBadgeClass = (type: string) => {
    const badgeClasses = {
      raw: 'badge-primary',
      processed: 'badge-secondary', 
      component: 'badge-accent',
      ammo: 'badge-warning',
      final: 'badge-success',
    };
    return badgeClasses[type as keyof typeof badgeClasses] || 'badge-neutral';
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              className={`btn btn-sm ${
                selectedCategory === category ? 'btn-primary' : 'btn-outline'
              }`}
              onClick={() => dispatch([EVENT_IDS.SET_CATEGORY, category])}
            >
              {getCategoryDisplayName(category)}
            </button>
          ))}
        </div>
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Total Items</div>
              <div className="stat-value text-2xl">{filteredItems.length}</div>
            </div>
          </div>
        </div>

        

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Icon</th>
                <th>Name</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover">
                  <td>
                    <ItemIcon item={item} />
                  </td>
                  <td className="font-medium">{item.name}</td>
                  <td>
                    <div className={`badge ${getCategoryBadgeClass(item.type)}`}>
                      {getCategoryDisplayName(item.type)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <div className="text-base-content/60">No items found in this category</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemsPage;