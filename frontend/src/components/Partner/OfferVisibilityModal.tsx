import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Modal from '../UI/Modal';

interface User {
  id: string;
  email: string;
  name: string;
  isVisible: boolean;
}

interface OfferVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string;
  offerName: string;
}

const OfferVisibilityModal: React.FC<OfferVisibilityModalProps> = ({
  isOpen,
  onClose,
  offerId,
  offerName
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOfferVisibility = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/partners/offer-visibility/${offerId}`);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error loading offer visibility:', error);
      setError('Errore nel caricamento delle impostazioni di visibilità');
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    if (isOpen && offerId) {
      loadOfferVisibility();
    }
  }, [isOpen, offerId, loadOfferVisibility]);

  const toggleUserVisibility = (userId: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { ...user, isVisible: !user.isVisible }
        : user
    ));
  };

  const saveVisibilitySettings = async () => {
    try {
      setSaving(true);
      setError(null);

      const userVisibility = Array.isArray(users) ? users.map(user => ({
        userId: user.id,
        isVisible: user.isVisible
      })) : [];

      await api.put(`/partners/offer-visibility/${offerId}`, {
        userVisibility
      });

      onClose();
    } catch (error) {
      console.error('Error saving visibility settings:', error);
      setError('Errore nel salvataggio delle impostazioni');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestisci Visibilità Offerta"
      size="lg"
      closeOnOverlayClick={!saving}
      closeOnEscape={!saving}
    >
      <div className="p-6">

        {/* Offer Info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900">{offerName}</h4>
          <p className="text-sm text-blue-600">
            Controlla quali utenti possono vedere questa offerta
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Users List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(!Array.isArray(users) || users.length === 0) ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Nessun utente associato trovato</p>
                </div>
              ) : (
                users.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={user.isVisible}
                        onChange={() => toggleUserVisibility(user.id)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700">
                        {user.isVisible ? 'Visibile' : 'Nascosta'}
                      </span>
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={saveVisibilitySettings}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvataggio...
                  </>
                ) : (
                  'Salva Modifiche'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default OfferVisibilityModal;