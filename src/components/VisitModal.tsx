import { useState, useEffect } from 'react';
import { Calendar, User, FileText, CheckCircle, Camera, MapPin } from 'lucide-react';
import { Modal } from './Modal';
import { PhotoCapture } from './PhotoCapture';
import { VisitLocationCapture } from './VisitLocationCapture';
import { supabase } from '../lib/supabase';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Visit, Customer } from '../types/database';

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit?: Visit;
  onSuccess: () => void;
}

export function VisitModal({ isOpen, onClose, visit, onSuccess }: VisitModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    customer_id: visit?.customer_id || '',
    visit_date: visit?.visit_date ? new Date(visit.visit_date).toISOString().slice(0, 16) : '',
    notes: visit?.notes || '',
    outcome: visit?.outcome || 'pending',
  });
  const [photos, setPhotos] = useState<string[]>(visit?.photos_url || []);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    visit?.latitude && visit?.longitude ? { latitude: visit.latitude, longitude: visit.longitude } : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'location'>('details');

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
    } else {
      setFormData({
        customer_id: '',
        visit_date: '',
        notes: '',
        outcome: 'pending',
      });
      setPhotos([]);
      setCoordinates(null);
    }
  }, [visit]);

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

      if (visit) {
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
        const { data: newVisit, error } = await supabase
          .from('visits')
          .insert([visitData])
          .select()
          .single();
        
        if (error) throw error;
        
        // Log activity
        await logActivity(ActivityTypes.VISIT_CREATED, {
          visit_id: newVisit.id,
          customer_id: formData.customer_id,
          outcome: formData.outcome,
          has_photos: photos.length > 0,
          has_location: !!coordinates
        });
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

        {activeTab === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-6">
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
      </div>
    </Modal>
  );
}