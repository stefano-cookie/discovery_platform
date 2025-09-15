import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { 
  BuildingOffice2Icon, 
  UsersIcon, 
  ChartBarIcon
} from '@heroicons/react/20/solid';
import { SubPartner } from '../../../services/subPartnerApi';
import subPartnerApi from '../../../services/subPartnerApi';

interface SubPartnerDetailModalProps {
  subPartner: SubPartner;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const SubPartnerDetailModal: React.FC<SubPartnerDetailModalProps> = ({
  subPartner,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [currentData, setCurrentData] = useState<SubPartner>(subPartner);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update local state when prop changes
  useEffect(() => {
    setCurrentData(subPartner);
  }, [subPartner]);

  // Auto-refresh every 30 seconds when modal is open (solo dati interni, no parent refresh)
  useEffect(() => {
    if (!isOpen) return;

    const refreshData = async () => {
      try {
        setIsRefreshing(true);
        const subPartnersData = await subPartnerApi.getSubPartners();
        const updatedSubPartner = subPartnersData.find(sp => sp.id === subPartner.id);
        if (updatedSubPartner) {
          setCurrentData(updatedSubPartner);
        }
      } catch (error) {
        console.error('Failed to refresh sub-partner data:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    // Auto-refresh ogni 30 secondi
    const interval = setInterval(refreshData, 30000);

    return () => clearInterval(interval);
  }, [isOpen, subPartner.id]);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      const subPartnersData = await subPartnerApi.getSubPartners();
      const updatedSubPartner = subPartnersData.find(sp => sp.id === subPartner.id);
      if (updatedSubPartner) {
        setCurrentData(updatedSubPartner);
      }
      // Solo per il refresh manuale aggiorniamo anche il parent
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to refresh sub-partner data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                <div className="bg-white p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <BuildingOffice2Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <Dialog.Title as="h3" className="text-xl font-medium leading-6 text-gray-900">
                          {currentData.name}
                        </Dialog.Title>
                        <p className="text-sm text-gray-500">
                          Codice: {currentData.referralCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="rounded-md bg-blue-50 p-2 text-blue-500 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Aggiorna dati"
                      >
                        <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      currentData.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {currentData.isActive ? '✅ Azienda Attiva' : '❌ Azienda Disattivata'}
                    </span>
                  </div>

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <ChartBarIcon className="h-8 w-8 text-blue-500" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-blue-800">Iscrizioni</p>
                          <p className="text-2xl font-bold text-blue-900">{currentData.stats.totalRegistrations}</p>
                          {isRefreshing && (
                            <p className="text-xs text-blue-600 animate-pulse">Aggiornando...</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <UsersIcon className="h-8 w-8 text-green-500" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-800">Dipendenti</p>
                          <p className="text-2xl font-bold text-green-900">{currentData.stats.employeeCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">📋 Informazioni Azienda</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Data Creazione:</span>
                        <p className="text-gray-900">{new Date(currentData.createdAt).toLocaleDateString('it-IT')}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Stato:</span>
                        <p className={currentData.isActive ? 'text-green-600' : 'text-red-600'}>
                          {currentData.isActive ? 'Attiva' : 'Disattivata'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Employees List */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">👥 Team Aziendale</h4>
                    {currentData.employees.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Nessun dipendente presente</p>
                    ) : (
                      <div className="space-y-2">
                        {currentData.employees.map((employee) => (
                          <div key={employee.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {employee.firstName} {employee.lastName}
                                {employee.isOwner && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    👑 Proprietario
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">{employee.email}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                employee.role === 'ADMINISTRATIVE' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {employee.role === 'ADMINISTRATIVE' ? '🔧 Admin' : '💼 Commercial'}
                              </span>
                              <p className="text-xs text-gray-500 mt-1">
                                Dal {new Date(employee.createdAt).toLocaleDateString('it-IT')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SubPartnerDetailModal;