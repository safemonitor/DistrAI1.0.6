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
  Scan
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LocationModal } from '../components/LocationModal';
import { InventoryTransactionModal } from '../components/InventoryTransactionModal';
import { StockTransferModal } from '../components/StockTransferModal';
import { BarcodeInventoryTransaction } from '../components/BarcodeInventoryTransaction';
import { BarcodeStockTransfer } from '../components/BarcodeStockTransfer';
import { BarcodeInventoryLookup } from '../components/BarcodeInventoryLookup';
import { InventoryOverview } from '../components/InventoryOverview';
import { LocationInventoryView } from '../components/LocationInventoryView';
import { TransactionHistory } from '../components/TransactionHistory';
import { StockTransferManager } from '../components/StockTransferManager';
import type { 
  Location, 
  InventoryTransaction, 
  StockTransfer, 
  LocationInventory,
  Product,
  InventoryMetrics 
} from '../types/database';

export function WarehousePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'transactions' | 'transfers' | 'lookup'>('overview');
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [locationInventory, setLocationInventory] = useState<LocationInventory[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics>({
    totalLocations: 0,
    totalProducts: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    pendingTransfers: 0,
    recentTransactions: [],
    stockByLocation: [],
    topMovingProducts: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBarcodeTransactionOpen, setIsBarcodeTransactionOpen] = useState(false);
  const [isBarcodeTransferOpen, setIsBarcodeTransferOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>();
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | undefined>();

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  async function fetchWarehouseData() {
    try {
      setIsLoading(true);
      
      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (locationsError) throw locationsError;

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;

      // Fetch recent transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          product:products (*),
          location:locations (*),
          performed_by_profile:profiles!performed_by (
            first_name,
            last_name
          )
        `)
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (transactionsError) throw transactionsError;

      // Fetch stock transfers
      const { data: transfersData, error: transfersError } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          from_location:locations!from_location_id (*),
          to_location:locations!to_location_id (*),
          created_by_profile:profiles!created_by (
            first_name,
            last_name
          ),
          transfer_items:stock_transfer_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (transfersError) throw transfersError;

      // Fetch location inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('location_inventory')
        .select(`
          *,
          location:locations (*),
          product:products (*)
        `);

      if (inventoryError) throw inventoryError;

      setLocations(locationsData || []);
      setProducts(productsData || []);
      setTransactions(transactionsData || []);
      setTransfers(transfersData || []);
      setLocationInventory(inventoryData || []);

      // Calculate metrics
      calculateMetrics(locationsData || [], productsData || [], inventoryData || [], transfersData || [], transactionsData || []);

    } catch (err) {
      console.error('Error fetching warehouse data:', err);
      setError('Failed to load warehouse data');
    } finally {
      setIsLoading(false);
    }
  }

  function calculateMetrics(
    locations: Location[], 
    products: Product[], 
    inventory: LocationInventory[], 
    transfers: StockTransfer[],
    transactions: InventoryTransaction[]
  ) {
    const totalStockValue = inventory.reduce((sum, item) => 
      sum + (item.quantity * (item.product?.price || 0)), 0
    );

    const lowStockItems = inventory.filter(item => item.quantity <= 10).length;
    const pendingTransfers = transfers.filter(t => t.status === 'pending').length;

    // Stock by location
    const stockByLocation = locations.map(location => {
      const locationItems = inventory.filter(item => item.location_id === location.id);
      const totalItems = locationItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = locationItems.reduce((sum, item) => 
        sum + (item.quantity * (item.product?.price || 0)), 0
      );

      return {
        location_id: location.id,
        location_name: location.name,
        total_items: totalItems,
        total_value: totalValue
      };
    });

    // Top moving products (based on recent transactions)
    const productMovements = new Map();
    transactions.forEach(transaction => {
      const productId = transaction.product_id;
      const existing = productMovements.get(productId) || {
        product_id: productId,
        product_name: transaction.product?.name || 'Unknown',
        total_movements: 0,
        net_change: 0
      };
      
      existing.total_movements += Math.abs(transaction.quantity);
      existing.net_change += transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in' 
        ? transaction.quantity 
        : -transaction.quantity;
      
      productMovements.set(productId, existing);
    });

    const topMovingProducts = Array.from(productMovements.values())
      .sort((a, b) => b.total_movements - a.total_movements)
      .slice(0, 10);

    setMetrics({
      totalLocations: locations.length,
      totalProducts: products.length,
      totalStockValue,
      lowStockItems,
      pendingTransfers,
      recentTransactions: transactions.slice(0, 10),
      stockByLocation,
      topMovingProducts
    });
  }

  const handleAddLocation = () => {
    setSelectedLocation(undefined);
    setIsLocationModalOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location);
    setIsLocationModalOpen(true);
  };

  const handleAddTransaction = () => {
    setIsTransactionModalOpen(true);
  };

  const handleAddBarcodeTransaction = () => {
    setIsBarcodeTransactionOpen(true);
  };

  const handleAddTransfer = () => {
    setSelectedTransfer(undefined);
    setIsTransferModalOpen(true);
  };

  const handleAddBarcodeTransfer = () => {
    setSelectedTransfer(undefined);
    setIsBarcodeTransferOpen(true);
  };

  const handleEditTransfer = (transfer: StockTransfer) => {
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
          <h1 className="text-2xl font-semibold text-gray-900">Warehouse Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage inventory, locations, stock movements, and transfers with barcode scanning
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button
            onClick={handleAddLocation}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Building className="h-4 w-4 mr-2" />
            Add Location
          </button>
          <button
            onClick={handleAddBarcodeTransaction}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            <Scan className="h-4 w-4 mr-2" />
            Barcode Transaction
          </button>
          <button
            onClick={handleAddTransaction}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <Package className="h-4 w-4 mr-2" />
            Manual Transaction
          </button>
          <button
            onClick={handleAddBarcodeTransfer}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Scan className="h-4 w-4 mr-2" />
            Barcode Transfer
          </button>
          <button
            onClick={handleAddTransfer}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Manual Transfer
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'lookup', name: 'Barcode Lookup', icon: Search },
            { id: 'locations', name: 'Locations', icon: MapPin },
            { id: 'transactions', name: 'Transactions', icon: Package },
            { id: 'transfers', name: 'Transfers', icon: ArrowRightLeft },
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
        <InventoryOverview 
          metrics={metrics}
          locations={locations}
          onLocationSelect={(location) => {
            setActiveTab('locations');
            setSelectedLocation(location);
          }}
        />
      )}

      {activeTab === 'lookup' && (
        <BarcodeInventoryLookup 
          products={products}
          locationInventory={locationInventory}
          onRefresh={fetchWarehouseData}
        />
      )}

      {activeTab === 'locations' && (
        <LocationInventoryView 
          locations={locations}
          locationInventory={locationInventory}
          onEditLocation={handleEditLocation}
          onAddTransaction={handleAddBarcodeTransaction}
          onRefresh={fetchWarehouseData}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionHistory 
          transactions={transactions}
          onAddTransaction={handleAddBarcodeTransaction}
          onRefresh={fetchWarehouseData}
        />
      )}

      {activeTab === 'transfers' && (
        <StockTransferManager 
          transfers={transfers}
          locations={locations}
          onEditTransfer={handleEditTransfer}
          onAddTransfer={handleAddBarcodeTransfer}
          onRefresh={fetchWarehouseData}
        />
      )}

      {/* Modals */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        location={selectedLocation}
        onSuccess={fetchWarehouseData}
      />

      <InventoryTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        locations={locations}
        products={products}
        onSuccess={fetchWarehouseData}
      />

      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        transfer={selectedTransfer}
        locations={locations}
        products={products}
        onSuccess={fetchWarehouseData}
      />

      <BarcodeInventoryTransaction
        isOpen={isBarcodeTransactionOpen}
        onClose={() => setIsBarcodeTransactionOpen(false)}
        locations={locations}
        products={products}
        onSuccess={fetchWarehouseData}
      />

      <BarcodeStockTransfer
        isOpen={isBarcodeTransferOpen}
        onClose={() => setIsBarcodeTransferOpen(false)}
        transfer={selectedTransfer}
        locations={locations}
        products={products}
        onSuccess={fetchWarehouseData}
      />
    </div>
  );
}