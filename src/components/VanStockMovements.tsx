import { useState } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown, Package, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StockLoadUnloadModal } from './StockLoadUnloadModal';
import type { VanStockMovement, Product } from '../types/database';

interface VanStockMovementsProps {
  movements: VanStockMovement[];
  products: Product[];
  onMovementCreated: () => void;
}

export function VanStockMovements({ movements, products, onMovementCreated }: VanStockMovementsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'load' | 'unload'>('load');

  const getMovementIcon = (type: VanStockMovement['movement_type']) => {
    switch (type) {
      case 'load':
        return TrendingUp;
      case 'unload':
        return TrendingDown;
      case 'sale':
        return Package;
      default:
        return ArrowUpDown;
    }
  };

  const getMovementColor = (type: VanStockMovement['movement_type']) => {
    switch (type) {
      case 'load':
        return 'text-green-600';
      case 'unload':
        return 'text-blue-600';
      case 'sale':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getMovementBgColor = (type: VanStockMovement['movement_type']) => {
    switch (type) {
      case 'load':
        return 'bg-green-100';
      case 'unload':
        return 'bg-blue-100';
      case 'sale':
        return 'bg-purple-100';
      default:
        return 'bg-gray-100';
    }
  };

  const handleLoadStock = () => {
    setModalType('load');
    setIsModalOpen(true);
  };

  const handleUnloadStock = () => {
    setModalType('unload');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Stock Movements</h2>
          <p className="mt-1 text-sm text-gray-600">
            Track all stock movements for your van inventory
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex sm:space-x-3">
          <button
            onClick={handleLoadStock}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Load Stock
          </button>
          <button
            onClick={handleUnloadStock}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            Unload Stock
          </button>
        </div>
      </div>

      {/* Movements List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          {movements.length === 0 ? (
            <div className="text-center py-8">
              <ArrowUpDown className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No stock movements</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start by loading stock onto your van or making sales.
              </p>
            </div>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8">
                {movements.map((movement, movementIdx) => {
                  const Icon = getMovementIcon(movement.movement_type);
                  const iconColor = getMovementColor(movement.movement_type);
                  const bgColor = getMovementBgColor(movement.movement_type);

                  return (
                    <li key={movement.id}>
                      <div className="relative pb-8">
                        {movementIdx !== movements.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${bgColor}`}>
                              <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900">
                                <span className="font-medium capitalize">{movement.movement_type}</span>
                                {' '}
                                <span className="font-medium">
                                  {Math.abs(movement.quantity)} units
                                </span>
                                {' '}of {movement.product?.name}
                              </p>
                              {movement.notes && (
                                <p className="text-sm text-gray-500">{movement.notes}</p>
                              )}
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time dateTime={movement.created_at}>
                                {new Date(movement.created_at).toLocaleString()}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Stock Load/Unload Modal */}
      <StockLoadUnloadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        products={products}
        onSuccess={() => {
          onMovementCreated();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}