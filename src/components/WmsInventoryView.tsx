import { useState } from 'react';
import { 
  Building, 
  Package, 
  Search, 
  Plus, 
  Pencil, 
  AlertTriangle,
  Warehouse,
  MapPin,
  Filter
} from 'lucide-react';
import type { WmsWarehouse, WmsLocation, WmsProduct, WmsInventory } from '../types/database';

interface WmsInventoryViewProps {
  warehouses: WmsWarehouse[];
  locations: WmsLocation[];
  products: WmsProduct[];
  inventory: WmsInventory[];
  onEditLocation: (location: WmsLocation) => void;
  onEditProduct: (product: WmsProduct) => void;
  onRefresh: () => void;
}

export function WmsInventoryView({ 
  warehouses, 
  locations, 
  products, 
  inventory, 
  onEditLocation, 
  onEditProduct,
  onRefresh 
}: WmsInventoryViewProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category || 'Uncategorized')));

  const filteredInventory = inventory.filter(item => {
    const matchesWarehouse = selectedWarehouseId === 'all' || 
      (item.location?.warehouse_id === selectedWarehouseId);
    
    const matchesSearch = !searchTerm || 
      item.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.aisle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.shelf.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || 
      item.product?.category === categoryFilter;
    
    return matchesWarehouse && matchesSearch && matchesCategory;
  });

  const getStockStatus = (item: WmsInventory) => {
    if (!item.product) return { color: 'text-gray-600 bg-gray-100', label: 'Unknown' };
    
    if (item.quantity === 0) return { color: 'text-red-600 bg-red-100', label: 'Out of Stock' };
    if (item.quantity <= item.product.min_stock) return { color: 'text-yellow-600 bg-yellow-100', label: 'Low Stock' };
    if (item.product.max_stock && item.quantity >= item.product.max_stock) return { color: 'text-blue-600 bg-blue-100', label: 'Overstocked' };
    return { color: 'text-green-600 bg-green-100', label: 'In Stock' };
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="warehouse-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Warehouse
            </label>
            <select
              id="warehouse-filter"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Products or Locations
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, SKU, or location..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((warehouse) => {
          const warehouseLocations = locations.filter(l => l.warehouse_id === warehouse.id);
          const warehouseLocationIds = warehouseLocations.map(l => l.id);
          const warehouseInventory = inventory.filter(i => 
            warehouseLocationIds.includes(i.location_id)
          );
          
          const totalItems = warehouseInventory.reduce((sum, item) => sum + item.quantity, 0);
          const totalValue = warehouseInventory.reduce((sum, item) => {
            const product = products.find(p => p.id === item.product_id);
            const price = product?.unit_price || 0;
            return sum + (item.quantity * price);
          }, 0);
          
          const lowStockCount = warehouseInventory.filter(item => {
            const product = products.find(p => p.id === item.product_id);
            return product && item.quantity <= product.min_stock;
          }).length;

          return (
            <div key={warehouse.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Warehouse className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{warehouse.name}</h3>
                    <p className="text-sm text-gray-500">{warehouse.address}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRefresh()}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Items:</span>
                  <span className="text-sm font-medium text-gray-900">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value:</span>
                  <span className="text-sm font-medium text-gray-900">${totalValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Locations:</span>
                  <span className="text-sm font-medium text-gray-900">{warehouseLocations.length}</span>
                </div>
                {lowStockCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-red-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Low Stock:
                    </span>
                    <span className="text-sm font-medium text-red-600">{lowStockCount}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Locations Grid */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Warehouse Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations
            .filter(location => selectedWarehouseId === 'all' || location.warehouse_id === selectedWarehouseId)
            .map((location) => {
              const locationInventory = inventory.filter(i => i.location_id === location.id);
              const totalItems = locationInventory.reduce((sum, item) => sum + item.quantity, 0);
              
              return (
                <div key={location.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      <h4 className="text-sm font-medium text-gray-900">
                        {location.zone}-{location.aisle}-{location.shelf}-{location.position}
                      </h4>
                    </div>
                    <button
                      onClick={() => onEditLocation(location)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Warehouse: {location.warehouse?.name}
                  </p>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Items:</span>
                    <span className="font-medium text-gray-900">{totalItems}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Products:</span>
                    <span className="font-medium text-gray-900">{locationInventory.length}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Inventory</h3>
            <button
              onClick={onRefresh}
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lot Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm || selectedWarehouseId !== 'all' || categoryFilter !== 'all'
                        ? 'No inventory found matching your filters.' 
                        : 'No inventory items found. Add stock to get started.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const stockStatus = getStockStatus(item);

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Package className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.product?.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {item.product?.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {item.location?.zone}-{item.location?.aisle}-{item.location?.shelf}-{item.location?.position}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.location?.warehouse?.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.lot_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.updated_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}