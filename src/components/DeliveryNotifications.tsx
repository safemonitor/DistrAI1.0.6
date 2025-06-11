import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types/database';

interface DeliveryNotification {
  id: string;
  delivery_id: string;
  message: string;
  type: 'success' | 'warning' | 'info';
  created_at: string;
  read: boolean;
  delivery?: {
    tracking_number: string;
    status: Delivery['status'];
  };
}

export function DeliveryNotifications() {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to real-time delivery updates
    const subscription = supabase
      .channel('delivery-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries'
        },
        (payload) => {
          handleDeliveryUpdate(payload.new as Delivery);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      // In a real app, you'd have a notifications table
      // For now, we'll simulate with recent delivery updates
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const mockNotifications: DeliveryNotification[] = deliveries?.map(delivery => ({
        id: `notif-${delivery.id}`,
        delivery_id: delivery.id,
        message: `Delivery #${delivery.tracking_number} status updated to ${delivery.status}`,
        type: delivery.status === 'delivered' ? 'success' : 
              delivery.status === 'failed' ? 'warning' : 'info',
        created_at: delivery.created_at,
        read: false,
        delivery: {
          tracking_number: delivery.tracking_number,
          status: delivery.status
        }
      })) || [];

      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleDeliveryUpdate = (delivery: Delivery) => {
    const newNotification: DeliveryNotification = {
      id: `notif-${delivery.id}-${Date.now()}`,
      delivery_id: delivery.id,
      message: `Delivery #${delivery.tracking_number} status updated to ${delivery.status}`,
      type: delivery.status === 'delivered' ? 'success' : 
            delivery.status === 'failed' ? 'warning' : 'info',
      created_at: new Date().toISOString(),
      read: false,
      delivery: {
        tracking_number: delivery.tracking_number,
        status: delivery.status
      }
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const getNotificationIcon = (type: DeliveryNotification['type']) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const getNotificationColor = (type: DeliveryNotification['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const iconColor = getNotificationColor(notification.type);

                  return (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors
                        ${notification.read 
                          ? 'bg-gray-50 border-gray-200' 
                          : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${iconColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}