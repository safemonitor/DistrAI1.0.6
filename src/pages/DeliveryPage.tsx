import { useState, useEffect } from 'react';
import { Plus, Truck, MapPin, Clock, AlertTriangle, Eye, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DeliveryMap } from '../components/DeliveryMap';
import { DeliveryLocationModal } from '../components/DeliveryLocationModal';
import { DeliveryStatusUpdater } from '../components/DeliveryStatusUpdater';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { ProofOfDeliveryModal } from '../components/ProofOfDeliveryModal';
import { DeliveryProofViewer } from '../components/DeliveryProofViewer';
import { Modal } from '../components/Modal';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Delivery, Profile } from '../types/database';

interface DeliveryWithStaff extends Delivery {
  staff?: {
    first_name: string;
    last_name: string;
  } | null;
}

export function DeliveryPage() {
  // State for data
  const [deliveries, setDeliveries] = useState<DeliveryWithStaff[]>([]);
  const [deliveryStaff, setDeliveryStaff] = useState<Profile[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<DeliveryWithStaff[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<Delivery['status'] | 'all'>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryWithStaff | null>(null);
  
  // Modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isStatusUpdaterOpen, setIsStatusUpdaterOpen] = useState(false);
  const [isProofOfDeliveryOpen, setIsProofOfDeliveryOpen] = useState(false);
  const [isProofViewerOpen, setIsProofViewerOpen] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    logActivity('delivery_page_accessed', { timestamp: new Date().toISOString() });
    
    // Initialize data
    fetchDeliveries();
    fetchDeliveryStaff();

    // Set up real-time subscription
    const subscription = setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
      logActivity('delivery_page_exited', { timestamp: new Date().toISOString() });
    };
  }, []);

  // Filter deliveries when selectedStatus or deliveries change
  useEffect(() => {
    filterDeliveries();
  }, [selectedStatus, deliveries]);

  // Setup real-time subscription to delivery updates
  function setupRealtimeSubscription() {
    try {
      const subscription = supabase
        .channel('delivery-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries'
          },
          (payload) => {
            logActivity('delivery_realtime_update', { 
              event: payload.eventType,
              delivery_id: payload.new?.id || payload.old?.id,
              timestamp: new Date().toISOString()
            });
            fetchDeliveries();
          }
        )
        .subscribe((status) => {
          logActivity('delivery_subscription_status', { 
            status,
            timestamp: new Date().toISOString()
          });
          
          if (status !== 'SUBSCRIBED') {
            console.error('Failed to subscribe to delivery updates:', status);
          }
        });

      return subscription;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error setting up subscription';
      console.error('Error setting up real-time subscription:', err);
      logActivity('delivery_subscription_error', { 
        error: errorMessage,
        stack: err instanceof Error ? err.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      
      // Return a dummy subscription object that can be "unsubscribed" without errors
      return { unsubscribe: () => {} };
    }
  }

  // Fetch deliveries with staff information
  async function fetchDeliveries() {
    try {
      setIsLoading(true);
      logActivity('delivery_fetch_started', { timestamp: new Date().toISOString() });

      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          staff:profiles!delivery_staff_id (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from Supabase');
      }

      logActivity('delivery_fetch_success', { 
        count: data.length,
        timestamp: new Date().toISOString()
      });

      setDeliveries(data);
      setFilteredDeliveries(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching deliveries';
      console.error('Error fetching deliveries:', err);
      setError(errorMessage);
      logActivity('delivery_fetch_error', { 
        error: errorMessage,
        stack: err instanceof Error ? err.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch delivery staff (profiles with delivery role)
  async function fetchDeliveryStaff() {
    try {
      logActivity('delivery_staff_fetch_started', { timestamp: new Date().toISOString() });

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'delivery');

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      logActivity('delivery_staff_fetch_success', { 
        count: data?.length || 0,
        timestamp: new Date().toISOString()
      });

      setDeliveryStaff(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching delivery staff';
      console.error('Error fetching delivery staff:', err);
      logActivity('delivery_staff_fetch_error', { 
        error: errorMessage,
        stack: err instanceof Error ? err.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      // We don't set the main error state here since this is not critical for the page to function
    }
  }

  // Filter deliveries based on selected status
  function filterDeliveries() {
    if (selectedStatus === 'all') {
      setFilteredDeliveries(deliveries);
    } else {
      setFilteredDeliveries(deliveries.filter(delivery => delivery.status === selectedStatus));
    }
  }

  // Update delivery status
  async function updateDeliveryStatus(delivery: Delivery, newStatus: Delivery['status']) {
    try {
      logActivity('delivery_status_update_started', { 
        delivery_id: delivery.id,
        old_status: delivery.status,
        new_status: newStatus,
        timestamp: new Date().toISOString()
      });

      const updates: Partial<Delivery> = {
        status: newStatus,
      };

      if (newStatus === 'delivered') {
        updates.actual_delivery = new Date().toISOString();
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', delivery.id);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      logActivity('delivery_status_update_success', { 
        delivery_id: delivery.id,
        new_status: newStatus,
        timestamp: new Date().toISOString()
      });

      await fetchDeliveries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error updating delivery status';
      console.error('Error updating delivery status:', err);
      logActivity('delivery_status_update_error', { 
        error: errorMessage,
        delivery_id: delivery.id,
        stack: err instanceof Error ? err.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      alert('Failed to update delivery status: ' + errorMessage);
    }
  }

  // Handler functions for various actions
  const handleLocationUpdate = (delivery: DeliveryWithStaff) => {
    setSelectedDelivery(delivery);
    setIsLocationModalOpen(true);
  };

  const handleViewTimeline = (delivery: DeliveryWithStaff) => {
    setSelectedDelivery(delivery);
    setIsTimelineModalOpen(true);
  };

  const handleQuickStatusUpdate = (delivery: DeliveryWithStaff) => {
    setSelectedDelivery(delivery);
    setIsStatusUpdaterOpen(true);
  };

  const handleProofOfDelivery = (delivery: DeliveryWithStaff) => {
    setSelectedDelivery(delivery);
    setIsProofOfDeliveryOpen(true);
  };

  const handleViewProof = (delivery: DeliveryWithStaff) => {
    setSelectedDelivery(delivery);
    setIsProofViewerOpen(true);
  };

  // Check if a delivery has proof of delivery
  const hasProofOfDelivery = (delivery: Delivery) => {
    return delivery.signature_url || 
           delivery.proof_of_delivery_image_url || 
           delivery.customer_feedback || 
           delivery.delivery_rating;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading delivery information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-lg shadow-md">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Deliveries</h3>
            <p className="mt-2 text-red-700">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setIsLoading(true);
                fetchDeliveries();
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Delivery Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Track and manage all deliveries in real-time
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as Delivery['status'] | 'all')}
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Truck className="h-5 w-5 text-blue-500" />
                <span className="ml-2 text-sm font-medium text-blue-900">Active Deliveries</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-blue-900">
                {deliveries.filter(d => d.status === 'out_for_delivery').length}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="ml-2 text-sm font-medium text-green-900">Completed Today</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-green-900">
                {deliveries.filter(d => 
                  d.status === 'delivered' && 
                  d.actual_delivery &&
                  new Date(d.actual_delivery).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="ml-2 text-sm font-medium text-yellow-900">Pending</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-yellow-900">
                {deliveries.filter(d => d.status === 'assigned').length}
              </p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="ml-2 text-sm font-medium text-red-900">Failed</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-red-900">
                {deliveries.filter(d => d.status === 'failed').length}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <DeliveryMap 
              deliveries={filteredDeliveries}
              onDeliverySelect={(delivery) => {
                logActivity('delivery_selected_on_map', { 
                  delivery_id: delivery.id,
                  timestamp: new Date().toISOString()
                });
                setSelectedDelivery(delivery);
              }}
            />
          </div>

          <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                        Tracking Number
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Delivery Staff
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Route
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Estimated Delivery
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredDeliveries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                          {selectedStatus !== 'all' 
                            ? `No deliveries with status "${selectedStatus}" found.` 
                            : 'No deliveries found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredDeliveries.map((delivery) => (
                        <tr 
                          key={delivery.id}
                          className={selectedDelivery?.id === delivery.id ? 'bg-indigo-50' : ''}
                        >
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                            {delivery.tracking_number}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {delivery.staff ? 
                              `${delivery.staff.first_name} ${delivery.staff.last_name}` : 
                              'Unassigned'
                            }
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {delivery.route_number || 'N/A'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                              ${delivery.status === 'delivered' ? 'bg-green-50 text-green-700' :
                                delivery.status === 'out_for_delivery' ? 'bg-blue-50 text-blue-700' :
                                delivery.status === 'failed' ? 'bg-red-50 text-red-700' :
                                delivery.status === 'cancelled' ? 'bg-gray-50 text-gray-700' :
                                'bg-yellow-50 text-yellow-700'}`}>
                              {delivery.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {delivery.estimated_delivery ? new Date(delivery.estimated_delivery).toLocaleString() : 'Not set'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                              {(delivery.status === 'out_for_delivery' || delivery.status === 'assigned') && (
                                <button
                                  type="button"
                                  onClick={() => handleProofOfDelivery(delivery)}
                                  className="inline-flex items-center p-1 border border-transparent rounded-full text-green-600 hover:bg-green-50"
                                  title="Complete Delivery"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              )}
                              {delivery.status === 'delivered' && hasProofOfDelivery(delivery) && (
                                <button
                                  type="button"
                                  onClick={() => handleViewProof(delivery)}
                                  className="inline-flex items-center p-1 border border-transparent rounded-full text-purple-600 hover:bg-purple-50"
                                  title="View Proof of Delivery"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleQuickStatusUpdate(delivery)}
                                className="inline-flex items-center p-1 border border-transparent rounded-full text-indigo-600 hover:bg-indigo-50"
                                title="Update Status"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLocationUpdate(delivery)}
                                className="inline-flex items-center p-1 border border-transparent rounded-full text-indigo-600 hover:bg-indigo-50"
                                title="Update Location"
                              >
                                <MapPin className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleViewTimeline(delivery)}
                                className="inline-flex items-center p-1 border border-transparent rounded-full text-indigo-600 hover:bg-indigo-50"
                                title="View Timeline"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedDelivery && (
        <>
          <DeliveryLocationModal
            isOpen={isLocationModalOpen}
            onClose={() => {
              setIsLocationModalOpen(false);
              logActivity('delivery_location_modal_closed', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
            delivery={selectedDelivery}
            onSuccess={() => {
              fetchDeliveries();
              setIsLocationModalOpen(false);
              logActivity('delivery_location_updated', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
          />

          <Modal
            isOpen={isTimelineModalOpen}
            onClose={() => {
              setIsTimelineModalOpen(false);
              logActivity('delivery_timeline_modal_closed', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
            title="Delivery Timeline"
          >
            <DeliveryTimeline delivery={selectedDelivery} />
          </Modal>

          <Modal
            isOpen={isStatusUpdaterOpen}
            onClose={() => {
              setIsStatusUpdaterOpen(false);
              logActivity('delivery_status_updater_modal_closed', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
            title="Update Delivery Status"
          >
            <DeliveryStatusUpdater 
              delivery={selectedDelivery} 
              onUpdate={() => {
                fetchDeliveries();
                setIsStatusUpdaterOpen(false);
                logActivity('delivery_status_updated_via_modal', { 
                  delivery_id: selectedDelivery.id,
                  timestamp: new Date().toISOString()
                });
              }} 
            />
          </Modal>

          <ProofOfDeliveryModal
            isOpen={isProofOfDeliveryOpen}
            onClose={() => {
              setIsProofOfDeliveryOpen(false);
              logActivity('proof_of_delivery_modal_closed', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
            delivery={selectedDelivery}
            onSuccess={() => {
              fetchDeliveries();
              setIsProofOfDeliveryOpen(false);
              logActivity('proof_of_delivery_submitted', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
          />

          <DeliveryProofViewer
            isOpen={isProofViewerOpen}
            onClose={() => {
              setIsProofViewerOpen(false);
              logActivity('proof_viewer_modal_closed', { 
                delivery_id: selectedDelivery.id,
                timestamp: new Date().toISOString()
              });
            }}
            delivery={selectedDelivery}
          />
        </>
      )}
    </div>
  );
}