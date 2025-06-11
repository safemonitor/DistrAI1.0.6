import { useState } from 'react';
import { Modal } from './Modal';

export function PromotionModal({ isOpen, onClose, promotion, onSuccess }) {
  // This is a placeholder component for the promotion modal
  // It will be implemented in a future update
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={promotion ? 'Edit Promotion' : 'Create Promotion'}
    >
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800">
          Promotion management functionality will be implemented in a future update.
        </p>
      </div>
      
      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}