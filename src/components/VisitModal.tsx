import { useState, useEffect } from 'react';
import { Calendar, User, FileText, CheckCircle, Camera, MapPin, Route as RouteIcon, CalendarDays } from 'lucide-react';
import { Modal } from './Modal';
import { PhotoCapture } from './PhotoCapture';
import { VisitLocationCapture } from './VisitLocationCapture';
import { supabase } from '../lib/supabase';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Visit, Customer, Route, RouteCustomer, VisitSchedule } from '../types/database';

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit?: Visit;
  routes?: Route[];
  routeCustomers?: RouteCustomer[];
  onSuccess: () => void;
}

export function VisitModal({ isOpen, onClose, visit, routes = [], routeCustomers = [], onSuccess }: VisitModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    customer_id: visit?.customer_id || '',
    visit_date: visit?.visit_date ? new Date(visit.visit_date).toISOString().slice(0, 16) : '',
    notes: visit?.notes || '',
    outcome: visit?.outcome || 'pending',
  });
  
  // Schedule related state
  const [isRecurring, setIsRecurring] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    route_id: string;
    route_customer_id: string;
    frequency_type: VisitSchedule['frequency_type'];
    frequency_value: number;
    start_date: string;
    end_date: string;
    days_of_week: number[];
    day_of_month: number;
  }>({
    route_id: '',
    route_customer_id: '',
    frequency_type: 'weekly',
    frequency_value: 1,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday by default
    day_of_month: 1,
  });
  
  const [photos, setPhotos] = useState<string[]>(visit?.photos_url || []);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    visit?.latitude && visit?.longitude ? { latitude: visit.latitude, longitude: visit.longitude } : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'photos' | 'location'>('details');

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (visit) {
      setFormData({
        customer_id: visit.customer_id,
        visit_date: new Date(visit.visit_date).toISOString().slice(0, 16),
        notes: visit.notes || '',
        outcome: visit.outcome || 'pending',
      });
      setPhotos(visit.photos_url || []);
      setCoordinates(
        visit.latitude && visit.longitude 
          ? { latitude: visit.latitude, longitude: visit.longitude } 
          : null
      );
      
      // Check if visit has a schedule
      if (visit.schedule_id) {
        setIsRecurring(true);
        // Fetch schedule details if needed
      }
    } else {
      setFormData({
        customer_id: '',
        visit_date: '',
        notes: '',
        outcome: 'pending',
      });
      setPhotos([]);
      setCoordinates(null);
      setIsRecurring(false);
    }
  }, [visit]);
  
  // Update route_customer_id when route_id or customer_id changes
  useEffect(() => {
    if (scheduleData.route_id && formData.customer_id) {
      const routeCustomer = routeCustomers.find(rc => 
        rc.route_id === scheduleData.route_id && rc.customer_id === formData.customer_id
      );
      
      if (routeCustomer) {
        setScheduleData(prev => ({
          ...prev,
          route_customer_id: routeCustomer.id
        }));
      } else {
        setScheduleData(prev => ({
          ...prev,
          route_customer_id: ''
        }));
      }
    }
  }, [scheduleData.route_id, formData.customer_id, routeCustomers]);

  async function fetchCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setScheduleData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) : value,
    }));
  };
  
  const handleDayOfWeekToggle = (day: number) => {
    setScheduleData(prev => {
      const currentDays = [...prev.days_of_week];
      if (currentDays.includes(day)) {
        return {
          ...prev,
          days_of_week: currentDays.filter(d => d !== day)
        };
      } else {
        return {
          ...prev,
          days_of_week: [...currentDays, day].sort()
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const visitData: any = {
        customer_id: formData.customer_id,
        visit_date: new Date(formData.visit_date).toISOString(),
        notes: formData.notes || null,
        outcome: formData.outcome,
        photos_url: photos,
        created_by: user.id,
      };

      // Add coordinates if available
      if (coordinates) {
        visitData.latitude = coordinates.latitude;
        visitData.longitude = coordinates.longitude;
      }
      
      let visitId = visit?.id;
      let scheduleId = visit?.schedule_id;

      if (visit) {
        // Update existing visit
        const { error } = await supabase
          .from('visits')
          .update(visitData)
          .eq('id', visit.id);
        
        if (error) throw error;
        
        // Log activity
        await logActivity(ActivityTypes.VISIT_UPDATED, {
          visit_id: visit.id,
          customer_id: formData.customer_id,
          outcome: formData.outcome,
          has_photos: photos.length > 0,
          has_location: !!coordinates
        });
      } else {
        // Create new visit
        const { data: newVisit, error } = await supabase
          .from('visits')
          .insert([visitData])
          .select()
          .single();
        
        if (error) throw error;
        
        visitId = newVisit.id;
        
        // Log activity
        await logActivity(ActivityTypes.VISIT_CREATED, {
          visit_id: newVisit.id,
          customer_id: formData.customer_id,
          outcome: formData.outcome,
          has_photos: photos.length > 0,
          has_location: !!coordinates
        });
      }
      
      // Handle recurring schedule if enabled
      if (isRecurring && visitId) {
        if (scheduleId) {
          // Update existing schedule
          const { error: scheduleError } = await supabase
            .from('visit_schedules')
            .update({
              route_customer_id: scheduleData.route_customer_id,
              frequency_type: scheduleData.frequency_type,
              frequency_value: scheduleData.frequency_value,
              start_date: scheduleData.start_date,
              end_date: scheduleData.end_date || null,
              days_of_week: scheduleData.frequency_type === 'daily' ? null : scheduleData.days_of_week,
              day_of_month: scheduleData.frequency_type === 'monthly' ? scheduleData.day_of_month : null,
            })
            .eq('id', scheduleId);
            
          if (scheduleError) throw scheduleError;
        } else if (scheduleData.route_customer_id) {
          // Create new schedule
          const { data: newSchedule, error: scheduleError } = await supabase
            .from('visit_schedules')
            .insert([{
              route_customer_id: scheduleData.route_customer_id,
              frequency_type: scheduleData.frequency_type,
              frequency_value: scheduleData.frequency_value,
              start_date: scheduleData.start_date,
              end_date: scheduleData.end_date || null,
              days_of_week: scheduleData.frequency_type === 'daily' ? null : scheduleData.days_of_week,
              day_of_month: scheduleData.frequency_type === 'monthly' ? scheduleData.day_of_month : null,
              tenant_id: (await supabase.auth.getUser()).data.user?.id
            }])
            .select()
            .single();
            
          if (scheduleError) throw scheduleError;
          
          // Link schedule to visit
          if (newSchedule) {
            const { error: updateError } = await supabase
              .from('visits')
              .update({ schedule_id: newSchedule.id })
              .eq('id', visitId);
              
            if (updateError) throw updateError;
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to save visit');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const outcomeOptions = [
    { value: 'pending', label: 'Pending', color: 'text-yellow-600' },
    { value: 'successful', label: 'Successful', color: 'text-green-600' },
    { value: 'unsuccessful', label: 'Unsuccessful', color: 'text-red-600' },
    { value: 'rescheduled', label: 'Rescheduled', color: 'text-blue-600' },
    { value: 'cancelled', label: 'Cancelled', color: 'text-gray-600' },
  ];
  
  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' },
  ];
  
  const getDayName = (day: number): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1];
  };
  
  // Filter route customers by selected customer
  const filteredRouteCustomers = routeCustomers.filter(rc => 
    rc.customer_id === formData.customer_id
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={visit ? 'Edit Visit' : 'Schedule Visit'}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Visit Details
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CalendarDays className="h-4 w-4 inline mr-2" />
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('location')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'location'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MapPin className="h-4 w-4 inline mr-2" />
              Location
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Camera className="h-4 w-4 inline mr-2" />
              Photos {photos.length > 0 && `(${photos.length})`}
            </button>
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-2" />
                  Customer
                </label>
                <select
                  id="customer_id"
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="visit_date" className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Visit Date & Time
                </label>
                <input
                  type="datetime-local"
                  id="visit_date"
                  name="visit_date"
                  value={formData.visit_date}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="outcome" className="block text-sm font-medium text-gray-700 mb-2">
                  <CheckCircle className="h-4 w-4 inline mr-2" />
                  Outcome
                </label>
                <select
                  id="outcome"
                  name="outcome"
                  value={formData.outcome}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  {outcomeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 inline mr-2" />
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Add visit notes, observations, or follow-up actions..."
                />
              </div>
            </div>
          )}
          
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="is-recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is-recurring" className="ml-2 block text-sm font-medium text-gray-700">
                  This is a recurring visit
                </label>
              </div>
              
              {isRecurring && (
                <div className="bg-gray-50 p-4 rounded-md space-y-4">
                  <div>
                    <label htmlFor="route_id" className="block text-sm font-medium text-gray-700">
                      <RouteIcon className="h-4 w-4 inline mr-2" />
                      Route
                    </label>
                    <select
                      id="route_id"
                      name="route_id"
                      value={scheduleData.route_id}
                      onChange={handleScheduleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required={isRecurring}
                    >
                      <option value="">Select a route</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name} ({route.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {scheduleData.route_id && formData.customer_id && filteredRouteCustomers.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-700">
                        This customer is not assigned to the selected route. Please add the customer to the route first.
                      </p>
                    </div>
                  )}
                  
                  {filteredRouteCustomers.length > 0 && (
                    <>
                      <div>
                        <label htmlFor="frequency_type" className="block text-sm font-medium text-gray-700">
                          <Calendar className="h-4 w-4 inline mr-2" />
                          Frequency
                        </label>
                        <select
                          id="frequency_type"
                          name="frequency_type"
                          value={scheduleData.frequency_type}
                          onChange={handleScheduleChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required={isRecurring}
                        >
                          {frequencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {scheduleData.frequency_type !== 'custom' && (
                        <div>
                          <label htmlFor="frequency_value" className="block text-sm font-medium text-gray-700">
                            Every
                          </label>
                          <div className="mt-1 flex items-center">
                            <input
                              type="number"
                              id="frequency_value"
                              name="frequency_value"
                              value={scheduleData.frequency_value}
                              onChange={handleScheduleChange}
                              min="1"
                              className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              required={isRecurring}
                            />
                            <span className="ml-2 text-sm text-gray-500">
                              {scheduleData.frequency_type === 'daily' ? 'day(s)' : 
                               scheduleData.frequency_type === 'weekly' ? 'week(s)' : 'month(s)'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {(scheduleData.frequency_type === 'weekly' || scheduleData.frequency_type === 'custom') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Days of Week
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6, 7].map(day => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleDayOfWeekToggle(day)}
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  scheduleData.days_of_week.includes(day)
                                    ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300'
                                    : 'bg-gray-100 text-gray-800 border-2 border-gray-200'
                                }`}
                              >
                                {getDayName(day).substring(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {scheduleData.frequency_type === 'monthly' && (
                        <div>
                          <label htmlFor="day_of_month" className="block text-sm font-medium text-gray-700">
                            Day of Month
                          </label>
                          <input
                            type="number"
                            id="day_of_month"
                            name="day_of_month"
                            value={scheduleData.day_of_month}
                            onChange={handleScheduleChange}
                            min="1"
                            max="31"
                            className="mt-1 block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required={isRecurring && scheduleData.frequency_type === 'monthly'}
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                            Start Date
                          </label>
                          <input
                            type="date"
                            id="start_date"
                            name="start_date"
                            value={scheduleData.start_date}
                            onChange={handleScheduleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required={isRecurring}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                            End Date (Optional)
                          </label>
                          <input
                            type="date"
                            id="end_date"
                            name="end_date"
                            value={scheduleData.end_date}
                            onChange={handleScheduleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-4">
              <PhotoCapture
                visitId={visit?.id || 'temp'}
                existingPhotos={photos}
                onPhotosUpdate={setPhotos}
                disabled={!visit}
              />
              
              {!visit && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-sm text-yellow-700">
                    Save the visit first to enable photo uploads.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'location' && (
            <div className="space-y-4">
              <VisitLocationCapture
                visitId={visit?.id || 'temp'}
                existingCoordinates={coordinates}
                onCoordinatesUpdate={setCoordinates}
                disabled={!visit}
              />
              
              {!visit && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-sm text-yellow-700">
                    Save the visit first to enable location capture.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : visit ? 'Update Visit' : 'Schedule Visit'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}