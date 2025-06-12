import { 
  Building, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Clock,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Warehouse,
  MapPin
} from 'lucide-react';
import type { WmsMetrics, WmsWarehouse } from '../types/database';

interface WmsOverviewProps {
  metrics: WmsMetrics;
  warehouses: WmsWarehouse[];
  onWarehouseSelect: (warehouse: WmsWarehouse) => void;
}

export function WmsOverview({ metrics, warehouses, onWarehouseSelect }: WmsOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Warehouse className="h-5 w-5 text-blue-500" />
            <span className="ml-2 text-sm font-medium text-blue-900">Warehouses</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-blue-900">{metrics.totalWarehouses}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-indigo-500" />
            <span className="ml-2 text-sm font-medium text-indigo-900">Locations</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-indigo-900">{metrics.totalLocations}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-green-500" />
            <span className="ml-2 text-sm font-medium text-green-900">Products</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-green-900">{metrics.totalProducts}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-purple-500" />
            <span className="ml-2 text-sm font-medium text-purple-900">Stock Value</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-purple-900">
            ${metrics.totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="ml-2 text-sm font-medium text-red-900">Low Stock</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-900">{metrics.lowStockItems}</p>
        </div>
      </div>

      {/* Pending Operations */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span className="ml-2 text-sm font-medium text-green-900">Pending Receivings</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-green-900">{metrics.pendingReceivings}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <span className="ml-2 text-sm font-medium text-blue-900">Pending Pickings</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-blue-900">{metrics.pendingPickings}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-yellow-500" />
            <span className="ml-2 text-sm font-medium text-yellow-900">Pending Transfers</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-yellow-900">{metrics.pendingTransfers}</p>
        </div>
      </div>

      {/* Stock by Warehouse */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Stock by Warehouse
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.stockByWarehouse.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No warehouse inventory data available.
                  </td>
                </tr>
              ) : (
                metrics.stockByWarehouse.map((warehouseStock) => {
                  const warehouse = warehouses.find(w => w.id === warehouseStock.warehouse_id);
                  if (!warehouse) return null;

                  return (
                    <tr key={warehouseStock.warehouse_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Warehouse className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {warehouseStock.warehouse_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {warehouse.address || 'No address'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {warehouseStock.total_items.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${warehouseStock.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => onWarehouseSelect(warehouse)}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        >
                          View Details
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Moving Products */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Top Moving Products
        </h3>
        
        <div className="space-y-3">
          {metrics.topMovingProducts.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No product movement data available.</p>
          ) : (
            metrics.topMovingProducts.slice(0, 10).map((product, index) => (
              <div key={product.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {product.product_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Net change: {product.net_change > 0 ? '+' : ''}{product.net_change}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {product.total_movements} movements
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        
        <div className="space-y-3">
          {metrics.recentAuditLogs.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No recent activity found.</p>
          ) : (
            metrics.recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {log.action} on {log.table_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {log.user ? `By ${log.user.full_name || log.user.email}` : 'System action'}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}