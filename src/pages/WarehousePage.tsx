import { useState, useEffect } from 'react';
import { 
  Package, 
  MapPin, 
  ArrowRightLeft, 
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  Search,
  Filter,
  Building,
  Boxes,
  Scan,
  Warehouse
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WmsWarehouseModal } from '../components/WmsWarehouseModal';
import { WmsLocationModal } from '../components/WmsLocationModal';
import { WmsProductModal } from '../components/WmsProductModal';
import { WmsReceivingModal } from '../components/WmsReceivingModal';
import { WmsPickingModal } from '../components/WmsPickingModal';
import { WmsTransferModal } from '../components/WmsTransferModal';
import { WmsInventoryLookup } from '../components/WmsInventoryLookup';
import { WmsOverview } from '../components/WmsOverview';
import { WmsInventoryView } from '../components/WmsInventoryView';
import { WmsAuditLogView } from '../components/WmsAuditLogView';
import { WmsTransferManager } from '../components/WmsTransferManager';
import type { 
  WmsWarehouse,
  WmsLocation,
  WmsProduct,
  WmsInventory,
  WmsReceiving,
  WmsPicking,
  WmsTransfer,
  WmsAuditLog,
  WmsMetrics,
  WmsUser
} from '../types/database';

export function WarehousePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'receiving' | 'picking' | 'transfers' | 'lookup'>('overview');
  const [warehouses, setWarehouses] = useState<WmsWarehouse[]>([]);
  const [locations, setLocations] = useState<WmsLocation[]>([]);
  const [products, setProducts] = useState<WmsProduct[]>([]);
  const [inventory, setInventory] = useState<WmsInventory[]>([]);
  const [receivings, setReceivings] = useState<WmsReceiving[]>([]);
  const [pickings, setPickings] = useState<WmsPicking[]>([]);
  const [transfers, setTransfers] = useState<WmsTransfer[]>([]);
  const [auditLogs, setAuditLogs] = useState<WmsAuditLog[]>([]);
  const [wmsUsers, setWmsUsers] = useState<WmsUser[]>([]);
  
  const [metrics, setMetrics] = useState<WmsMetrics>({
    totalWarehouses: 0,
    totalProducts: 0,
    totalLocations: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    pendingReceivings: 0,
    pendingPickings: 0,
    pendingTransfers: 0,
    recentAuditLogs: [],
    stockByWarehouse: [],
    topMovingProducts: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isPickingModalOpen, setIsPickingModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  // Selected items for editing
  const [selectedWarehouse, setSelectedWarehouse] = useState<WmsWarehouse | undefined>();
  const [selectedLocation, setSelectedLocation] = useState<WmsLocation | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<WmsProduct | undefined>();
  const [selectedReceiving, setSelectedReceiving] = useState<WmsReceiving | undefined>();
  const [selectedPicking, setSelectedPicking] = useState<WmsPicking | undefined>();
  const [selectedTransfer, setSelectedTransfer] = useState<WmsTransfer | undefined>();

  useEffect(() => {
    fetchWmsData();
  }, []);

  async function fetchWmsData() {
    try {
      setIsLoading(true);
      
      // Fetch warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from('wms_warehouses')
        .select('*')
        .order('name');

      if (warehousesError) throw warehousesError;

      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('wms_locations')
        .select(`
          *,
          warehouse:wms_warehouses (*)
        `)
        .order('warehouse_id, zone, aisle, shelf, position');

      if (locationsError) throw locationsError;

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('wms_products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;

      // Fetch inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('wms_inventory')
        .select(`
          *,
          product:wms_products (*),
          location:wms_locations (
            *,
            warehouse:wms_warehouses (*)
          )
        `);

      if (inventoryError) throw inventoryError;

      // Fetch receivings
      const { data: receivingsData, error: receivingsError } = await supabase
        .from('wms_receiving')
        .select(`
          *,
          warehouse:wms_warehouses (*),
          received_by_user:wms_users (*),
          receiving_items:wms_receiving_items (
            *,
            product:wms_products (*),
            location:wms_locations (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (receivingsError) throw receivingsError;

      // Fetch pickings
      const { data: pickingsData, error: pickingsError } = await supabase
        .from('wms_picking')
        .select(`
          *,
          warehouse:wms_warehouses (*),
          picked_by_user:wms_users (*),
          picking_items:wms_picking_items (
            *,
            product:wms_products (*),
            location:wms_locations (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (pickingsError) throw pickingsError;

      // Fetch transfers - Fixed query to avoid ambiguous relationships
      const { data: transfersData, error: transfersError } = await supabase
        .from('wms_transfers')
        .select(`
          id,
          reference_number,
          from_location_id,
          to_location_id,
          status,
          initiated_by,
          completed_by,
          completed_at,
          created_at,
          updated_at,
          from_location:wms_locations!wms_transfers_from_location_id_fkey (
            id,
            warehouse_id,
            zone,
            aisle,
            shelf,
            position,
            created_at,
            updated_at,
            warehouse:wms_warehouses (
              id,
              name,
              address,
              created_at,
              updated_at
            )
          ),
          to_location:wms_locations!wms_transfers_to_location_id_fkey (
            id,
            warehouse_id,
            zone,
            aisle,
            shelf,
            position,
            created_at,
            updated_at,
            warehouse:wms_warehouses (
              id,
              name,
              address,
              created_at,
              updated_at
            )
          ),
          initiated_by_user:wms_users!wms_transfers_initiated_by_fkey (
            id,
            email,
            full_name,
            role,
            warehouse_id,
            created_at,
            updated_at
          ),
          completed_by_user:wms_users!wms_transfers_completed_by_fkey (
            id,
            email,
            full_name,
            role,
            warehouse_id,
            created_at,
            updated_at
          ),
          transfer_items:wms_transfer_items (
            id,
            transfer_id,
            product_id,
            quantity,
            lot_number,
            created_at,
            updated_at,
            product:wms_products (
              id,
              sku,
              name,
              description,
              category,
              unit,
              min_stock,
              max_stock,
              created_at,
              updated_at
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (transfersError) throw transfersError;

      // Fetch audit logs
      const { data: auditLogsData, error: auditLogsError } = await supabase
        .from('wms_audit_log')
        .select(`
          *,
          user:wms_users (*)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (auditLogsError) throw auditLogsError;

      // Fetch WMS users
      const { data: usersData, error: usersError } = await supabase
        .from('wms_users')
        .select(`
          *,
          warehouse:wms_warehouses (*)
        `);

      if (usersError) throw usersError;

      setWarehouses(warehousesData || []);
      setLocations(locationsData || []);
      setProducts(productsData || []);
      setInventory(inventoryData || []);
      setReceivings(receivingsData || []);
      setPickings(pickingsData || []);
      setTransfers(transfersData || []);
      setAuditLogs(auditLogsData || []);
      setWmsUsers(usersData || []);

      // Calculate metrics
      calculateMetrics(
        warehousesData || [], 
        locationsData || [], 
        productsData || [], 
        inventoryData || [], 
        receivingsData || [], 
        pickingsData || [], 
        transfersData || [], 
        auditLogsData || []
      );

    } catch (err) {
      console.error('Error fetching WMS data:', err);
      setError('Failed to load warehouse management data');
    } finally {
      setIsLoading(false);
    }
  }

  function calculateMetrics(
    warehouses: WmsWarehouse[], 
    locations: WmsLocation[], 
    products: WmsProduct[], 
    inventory: WmsInventory[],
    receivings: WmsReceiving[],
    pickings: WmsPicking[],
    transfers: WmsTransfer[],
    auditLogs: WmsAuditLog[]
  ) {
    // Calculate total stock value
    const totalStockValue = inventory.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      // Use a default price of 0 if product not found or price not available
      const price = product ? (product.unit_price || 0) : 0;
      return sum + (item.quantity * price);
    }, 0);

    // Count low stock items
    const lowStockItems = inventory.reduce((count, item) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && item.quantity <= product.min_stock) {
        return count + 1;
      }
      return count;
    }, 0);

    // Count pending operations
    const pendingReceivings = receivings.filter(r => r.status === 'pending').length;
    const pendingPickings = pickings.filter(p => p.status === 'pending').length;
    const pendingTransfers = transfers.filter(t => t.status === 'pending').length;

    // Calculate stock by warehouse
    const stockByWarehouse = warehouses.map(warehouse => {
      const warehouseLocations = locations.filter(l => l.warehouse_id === warehouse.id);
      const warehouseLocationIds = warehouseLocations.map(l => l.id);
      
      const warehouseInventory = inventory.filter(i => 
        warehouseLocationIds.includes(i.location_id)
      );
      
      const totalItems = warehouseInventory.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = warehouseInventory.reduce((sum, item) => {
        const product = products.find(p => p.id === item.product_id);
        const price = product ? (product.unit_price || 0) : 0;
        return sum + (item.quantity * price);
      }, 0);

      return {
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.name,
        total_items: totalItems,
        total_value: totalValue
      };
    });

    // Calculate top moving products based on audit logs
    const productMovements = new Map();
    
    auditLogs.forEach(log => {
      if (log.table_name === 'wms_inventory' && log.new_values && log.old_values) {
        const productId = log.new_values.product_id || log.old_values.product_id;
        if (!productId) return;
        
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const oldQuantity = log.old_values.quantity || 0;
        const newQuantity = log.new_values.quantity || 0;
        const quantityChange = newQuantity - oldQuantity;
        
        const existing = productMovements.get(productId) || {
          product_id: productId,
          product_name: product.name,
          total_movements: 0,
          net_change: 0
        };
        
        existing.total_movements += Math.abs(quantityChange);
        existing.net_change += quantityChange;
        
        productMovements.set(productId, existing);
      }
    });

    const topMovingProducts = Array.from(productMovements.values())
      .sort((a, b) => b.total_movements - a.total_movements)
      .slice(0, 10);

    setMetrics({
      totalWarehouses: warehouses.length,
      totalProducts: products.length,
      totalLocations: locations.length,
      totalStockValue,
      lowStockItems,
      pendingReceivings,
      pendingPickings,
      pendingTransfers,
      recentAuditLogs: auditLogs.slice(0, 10),
      stockByWarehouse,
      topMovingProducts
    });
  }

  const handleAddWarehouse = () => {
    setSelectedWarehouse(undefined);
    setIsWarehouseModalOpen(true);
  };

  const handleEditWarehouse = (warehouse: WmsWarehouse) => {
    setSelectedWarehouse(warehouse);
    setIsWarehouseModalOpen(true);
  };

  const handleAddLocation = () => {
    setSelectedLocation(undefined);
    setIsLocationModalOpen(true);
  };

  const handleEditLocation = (location: WmsLocation) => {
    setSelectedLocation(location);
    setIsLocationModalOpen(true);
  };

  const handleAddProduct = () => {
    setSelectedProduct(undefined);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product: WmsProduct) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleAddReceiving = () => {
    setSelectedReceiving(undefined);
    setIsReceivingModalOpen(true);
  };

  const handleProcessReceiving = (receiving: WmsReceiving) => {
    setSelectedReceiving(receiving);
    setIsReceivingModalOpen(true);
  };

  const handleAddPicking = () => {
    setSelectedPicking(undefined);
    setIsPickingModalOpen(true);
  };

  const handleProcessPicking = (picking: WmsPicking) => {
    setSelectedPicking(picking);
    setIsPickingModalOpen(true);
  };

  const handleAddTransfer = () => {
    setSelectedTransfer(undefined);
    setIsTransferModalOpen(true);
  };

  const handleProcessTransfer = (transfer: WmsTransfer) => {
    setSelectedTransfer(transfer);
    setIsTransferModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Warehouse Management System</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage warehouses, inventory, receiving, picking, and transfers with barcode scanning
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button
            onClick={handleAddWarehouse}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Warehouse className="h-4 w-4 mr-2" />
            Add Warehouse
          </button>
          <button
            onClick={handleAddLocation}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Add Location
          </button>
          <button
            onClick={handleAddProduct}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Package className="h-4 w-4 mr-2" />
            Add Product
          </button>
          <button
            onClick={handleAddReceiving}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            New Receiving
          </button>
          <button
            onClick={handleAddPicking}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            New Picking
          </button>
          <button
            onClick={handleAddTransfer}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            New Transfer
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'inventory', name: 'Inventory', icon: Package },
            { id: 'receiving', name: 'Receiving', icon: TrendingUp },
            { id: 'picking', name: 'Picking', icon: TrendingDown },
            { id: 'transfers', name: 'Transfers', icon: ArrowRightLeft },
            { id: 'lookup', name: 'Inventory Lookup', icon: Search },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <WmsOverview 
          metrics={metrics}
          warehouses={warehouses}
          onWarehouseSelect={(warehouse) => {
            setActiveTab('inventory');
            setSelectedWarehouse(warehouse);
          }}
        />
      )}

      {activeTab === 'inventory' && (
        <WmsInventoryView 
          warehouses={warehouses}
          locations={locations}
          products={products}
          inventory={inventory}
          onEditLocation={handleEditLocation}
          onEditProduct={handleEditProduct}
          onRefresh={fetchWmsData}
        />
      )}

      {activeTab === 'receiving' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Receiving Management</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Warehouse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {receivings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No receiving records found. Create a new receiving to get started.
                    </td>
                  </tr>
                ) : (
                  receivings.map((receiving) => (
                    <tr key={receiving.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {receiving.reference_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {receiving.warehouse?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          receiving.status === 'completed' ? 'bg-green-100 text-green-800' :
                          receiving.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          receiving.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {receiving.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {receiving.receiving_items?.length || 0} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(receiving.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleProcessReceiving(receiving)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {receiving.status === 'pending' ? 'Process' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'picking' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Picking Management</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Warehouse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pickings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No picking records found. Create a new picking to get started.
                    </td>
                  </tr>
                ) : (
                  pickings.map((picking) => (
                    <tr key={picking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {picking.reference_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {picking.warehouse?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          picking.status === 'completed' ? 'bg-green-100 text-green-800' :
                          picking.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          picking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {picking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {picking.picking_items?.length || 0} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(picking.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleProcessPicking(picking)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {picking.status === 'pending' ? 'Process' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (
        <WmsTransferManager 
          transfers={transfers}
          locations={locations}
          onProcessTransfer={handleProcessTransfer}
          onAddTransfer={handleAddTransfer}
          onRefresh={fetchWmsData}
        />
      )}

      {activeTab === 'lookup' && (
        <WmsInventoryLookup 
          products={products}
          inventory={inventory}
          auditLogs={auditLogs}
          onRefresh={fetchWmsData}
        />
      )}

      {/* Modals */}
      <WmsWarehouseModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        warehouse={selectedWarehouse}
        onSuccess={fetchWmsData}
      />

      <WmsLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        location={selectedLocation}
        warehouses={warehouses}
        onSuccess={fetchWmsData}
      />

      <WmsProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        onSuccess={fetchWmsData}
      />

      <WmsReceivingModal
        isOpen={isReceivingModalOpen}
        onClose={() => setIsReceivingModalOpen(false)}
        receiving={selectedReceiving}
        warehouses={warehouses}
        locations={locations}
        products={products}
        onSuccess={fetchWmsData}
      />

      <WmsPickingModal
        isOpen={isPickingModalOpen}
        onClose={() => setIsPickingModalOpen(false)}
        picking={selectedPicking}
        warehouses={warehouses}
        locations={locations}
        products={products}
        inventory={inventory}
        onSuccess={fetchWmsData}
      />

      <WmsTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        transfer={selectedTransfer}
        locations={locations}
        products={products}
        onSuccess={fetchWmsData}
      />
    </div>
  );
}