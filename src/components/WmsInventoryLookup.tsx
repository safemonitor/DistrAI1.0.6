import { useState } from 'react';
import { 
  Search, 
  Package, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Scan,
  Clock
} from 'lucide-react';
import type { WmsProduct, WmsInventory, WmsAuditLog } from '../types/database';

interface WmsInventoryLookupProps {
  products: WmsProduct[];
  inventory: WmsInventory[];
  auditLogs: WmsAuditLog[];
  onRefresh: () => void;
}

interface ProductLookupResult {
  product: WmsProduct;
  inventoryItems: WmsInventory[];
  recentLogs: WmsAuditLog[];
  totalQuantity: number;
  totalValue: number;
}

export function WmsInventoryLookup({ 
  products, 
  inventory, 
  auditLogs,
  onRefresh 
}: WmsInventoryLookupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lookupResult, setLookupResult] = useState<ProductLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      await performLookup(searchTerm.trim());
    }
  };

  const performLookup = async (searchValue: string) => {
    setIsLoading(true);
    setError(null);
    setLookupResult(null);

    try {
      // Find product by SKU, name, or ID
      const product = products.find(p => 
        p.sku === searchValue ||
        p.sku.includes(searchValue) ||
        searchValue.includes(p.sku) ||
        p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.id === searchValue
      );

      if (!product) {
        setError(`No product found matching: ${searchValue}`);
        return;
      }

      // Get inventory items for this product
      const productInventory = inventory.filter(inv => inv.product_id === product.id);
      
      // Get recent logs for this product
      const productLogs = auditLogs.filter(log => {
        // Check if the log is related to this product
        if (log.table_name === 'wms_inventory') {
          const oldValues = log.old_values || {};
          const newValues = log.new_values || {};
          return oldValues.product_id === product.id || newValues.product_id === product.id;
        }
        return false;
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

      const totalQuantity = productInventory.reduce((sum, inv) => sum + inv.quantity, 0);
      const totalValue = totalQuantity * (product.unit_price || 0);

      const result: ProductLookupResult = {
        product,
        inventoryItems: productInventory,
        recentLogs: productLogs,
        totalQuantity,
        totalValue,
      };

      setLookupResult(result);
    } catch (err) {
      console.error('Error performing lookup:', err);
      setError('Failed to lookup product information');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Product Inventory Lookup</h3>
        </div>

        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter SKU, barcode, or product name..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchTerm.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Lookup Results */}
      {lookupResult && (
        <div className="space-y-6">
          {/* Product Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Product Information
              </h3>
              <button
                onClick={onRefresh}
                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
              >
                Refresh Data
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Product Name</h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">{lookupResult.product.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">SKU</h4>
                <p className="mt-1 text-lg font-mono text-gray-900">{lookupResult.product.sku}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Unit</h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">{lookupResult.product.unit}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Category</h4>
                <p className="mt-1 text-lg text-gray-900 capitalize">{lookupResult.product.category || 'Uncategorized'}</p>
              </div>
            </div>

            {lookupResult.product.description && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-500">Description</h4>
                <p className="mt-1 text-gray-900">{lookupResult.product.description}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-500">Min Stock</h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">{lookupResult.product.min_stock}</p>
              </div>
              {lookupResult.product.max_stock && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-500">Max Stock</h4>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{lookupResult.product.max_stock}</p>
                </div>
              )}
              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-500">Last Updated</h4>
                <p className="mt-1 text-sm text-gray-900">{new Date(lookupResult.product.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Inventory Summary */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-900">{lookupResult.totalQuantity}</div>
                <div className="text-sm text-blue-600">Total Quantity</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-900">${lookupResult.totalValue.toFixed(2)}</div>
                <div className="text-sm text-green-600">Total Value</div>
              </div>
            </div>

            {/* Location Breakdown */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Warehouse
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
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lookupResult.inventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No inventory found at any location
                      </td>
                    </tr>
                  ) : (
                    lookupResult.inventoryItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm font-medium text-gray-900">
                              {item.location?.zone}-{item.location?.aisle}-{item.location?.shelf}-{item.location?.position}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.location?.warehouse?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.lot_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.updated_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Recent Activity
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lookupResult.recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No recent activity found for this product
                      </td>
                    </tr>
                  ) : (
                    lookupResult.recentLogs.map((log) => {
                      const oldValues = log.old_values || {};
                      const newValues = log.new_values || {};
                      const oldQuantity = oldValues.quantity || 0;
                      const newQuantity = newValues.quantity || 0;
                      const quantityChange = newQuantity - oldQuantity;
                      const locationId = newValues.location_id || oldValues.location_id;
                      const location = locations.find(l => l.id === locationId);
                      
                      let ActionIcon = Clock;
                      let actionColor = 'text-gray-600';
                      
                      if (quantityChange > 0) {
                        ActionIcon = TrendingUp;
                        actionColor = 'text-green-600';
                      } else if (quantityChange < 0) {
                        ActionIcon = TrendingDown;
                        actionColor = 'text-red-600';
                      } else {
                        ActionIcon = BarChart3;
                        actionColor = 'text-blue-600';
                      }

                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <ActionIcon className={`h-4 w-4 mr-2 ${actionColor}`} />
                              <span className="text-sm text-gray-900">
                                {log.action}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.user?.full_name || log.user?.email || 'System'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {oldQuantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              quantityChange > 0 ? 'text-green-600' : 
                              quantityChange < 0 ? 'text-red-600' : 
                              'text-gray-900'
                            }`}>
                              {newQuantity}
                              {quantityChange !== 0 && (
                                <span className="ml-1">
                                  ({quantityChange > 0 ? '+' : ''}{quantityChange})
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {location ? (
                              <span>
                                {location.zone}-{location.aisle}-{location.shelf}-{location.position}
                              </span>
                            ) : (
                              <span className="text-gray-500">Unknown</span>
                            )}
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
      )}
    </div>
  );
}