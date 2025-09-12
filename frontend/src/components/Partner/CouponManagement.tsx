import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePartnerAuth } from '../../hooks/usePartnerAuth';
import Portal from '../UI/Portal';

// Schema per creazione coupon
const couponSchema = z.object({
  code: z.string()
    .min(3, 'Il codice deve essere di almeno 3 caratteri')
    .max(20, 'Il codice deve essere massimo 20 caratteri')
    .regex(/^[A-Za-z0-9_-]+$/, 'Il codice può contenere lettere, numeri, trattini e underscore'),
  discountType: z.string().min(1, 'Tipo sconto richiesto'),
  discountAmount: z.number()
    .min(0.01, 'Importo deve essere maggiore di 0')
    .optional(),
  discountPercent: z.number()
    .min(1, 'Percentuale deve essere tra 1 e 100')
    .max(100, 'Percentuale deve essere tra 1 e 100')
    .optional(),
  maxUses: z.number()
    .min(1, 'Utilizzi massimi deve essere almeno 1')
    .optional(),
  validFrom: z.string().min(1, 'Data inizio richiesta'),
  validUntil: z.string().min(1, 'Data fine richiesta'),
}).refine((data) => {
  if (data.discountType === 'FIXED') {
    return data.discountAmount && data.discountAmount > 0;
  } else {
    return data.discountPercent && data.discountPercent > 0;
  }
}, {
  message: 'Inserisci un valore valido per lo sconto',
  path: ['discountAmount'],
});

type CouponForm = z.infer<typeof couponSchema>;

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountAmount?: number;
  discountPercent?: number;
  maxUses?: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
  partnerCompany?: {
    name: string;
    referralCode: string;
  };
}

interface UsageLog {
  id: string;
  usedAt: string;
  discountApplied: number;
  user: {
    email: string;
    nome: string;      
    cognome: string;
  };
  registration: {
    id: string;
    offerName: string;
    partnerCompany?: string;
  };
}

interface CouponUsageData {
  coupon: {
    id: string;
    code: string;
    discountType: string;
    discountAmount?: number;
    discountPercent?: number;
    maxUses?: number;
    usedCount: number;
    companyName?: string;
  };
  usageLogs: UsageLog[];
  totalUses: number;
}

const CouponManagement: React.FC = () => {
  const { token, isAuthenticated, partnerCompany } = usePartnerAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<Array<{id: string, name: string, referralCode: string}>>([]);
  const [selectedTargetCompany, setSelectedTargetCompany] = useState<string>('');
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCouponUsage, setSelectedCouponUsage] = useState<CouponUsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    mode: 'onChange',
  });

  const discountType = watch('discountType');

  // Load coupons and companies
  useEffect(() => {
    if (isAuthenticated() && token) {
      loadCoupons();
      loadAvailableCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  const loadCoupons = async () => {
    try {
      if (!token) {
        console.error('No partner token available');
        return;
      }
      
      const response = await fetch('/api/partners/coupons', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Errore nel caricamento dei coupon');
      }

      const data = await response.json();
      setCoupons(data);
      setLoading(false);
    } catch (error) {
      console.error('Errore nel caricamento coupon:', error);
      setLoading(false);
    }
  };

  const loadAvailableCompanies = async () => {
    try {
      if (!token) {
        console.error('No partner token available');
        return;
      }
      
      const response = await fetch('/api/partners/companies/hierarchy', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCompanies(data.companies || []);
      }
    } catch (error) {
      console.error('Errore nel caricamento aziende:', error);
    }
  };

  const onSubmit = async (data: CouponForm) => {
    setSubmitting(true);
    
    try {
      if (!token) {
        throw new Error('No partner token available');
      }
      
      const submitData = {
        ...data,
        targetCompanyId: selectedTargetCompany || undefined
      };
      
      const response = await fetch('/api/partners/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create error response:', errorData);
        throw new Error(errorData.error || 'Errore nella creazione del coupon');
      }

      // Reload coupons to get the updated list
      await loadCoupons();
      
      setShowCreateForm(false);
      setSelectedTargetCompany('');
      reset();
    } catch (error) {
      console.error('Errore nella creazione del coupon:', error);
      alert(error instanceof Error ? error.message : 'Errore nella creazione del coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCouponStatus = async (couponId: string) => {
    try {
      if (!token) {
        throw new Error('No partner token available');
      }
      
      const coupon = coupons.find(c => c.id === couponId);
      
      if (!coupon) return;
      
      const response = await fetch(`/api/partners/coupons/${couponId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !coupon.isActive })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'aggiornamento del coupon');
      }

      // Update local state
      setCoupons(prev => 
        prev.map(coupon => 
          coupon.id === couponId 
            ? { ...coupon, isActive: !coupon.isActive }
            : coupon
        )
      );
    } catch (error) {
      console.error('Errore nell\'aggiornamento del coupon:', error);
      alert(error instanceof Error ? error.message : 'Errore nell\'aggiornamento del coupon');
    }
  };

  const deleteCoupon = (coupon: Coupon) => {
    setCouponToDelete(coupon);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const confirmDeleteCoupon = async () => {
    if (!couponToDelete) return;

    setDeletingCoupon(true);
    try {
      if (!token) {
        throw new Error('No partner token available');
      }
      const response = await fetch(`/api/partners/coupons/${couponToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'eliminazione del coupon');
      }

      // Update local state
      setCoupons(prev => prev.filter(coupon => coupon.id !== couponToDelete.id));
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setCouponToDelete(null);
    } catch (error) {
      console.error('Errore nell\'eliminazione del coupon:', error);
      setDeleteError(error instanceof Error ? error.message : 'Errore nell\'eliminazione del coupon');
    } finally {
      setDeletingCoupon(false);
    }
  };

  const cancelDeleteCoupon = () => {
    setShowDeleteModal(false);
    setCouponToDelete(null);
    setDeleteError(null);
  };

  // Handle ESC key press to close delete modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDeleteModal && !deletingCoupon) {
        cancelDeleteCoupon();
      }
    };

    if (showDeleteModal) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [showDeleteModal, deletingCoupon]);

  const loadCouponUsage = async (couponId: string) => {
    setLoadingUsage(true);
    try {
      if (!token) {
        throw new Error('No partner token available');
      }
      const response = await fetch(`/api/partners/coupons/${couponId}/usage-logs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel caricamento dei log');
      }

      const data: CouponUsageData = await response.json();
      setSelectedCouponUsage(data);
      setShowUsageModal(true);
    } catch (error) {
      console.error('Errore nel caricamento dei log di utilizzo:', error);
      alert(error instanceof Error ? error.message : 'Errore nel caricamento dei log');
    } finally {
      setLoadingUsage(false);
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountPercent}%`;
    } else {
      return `€${coupon.discountAmount}`;
    }
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  const isMaxUsesReached = (coupon: Coupon) => {
    return coupon.maxUses ? coupon.usedCount >= coupon.maxUses : false;
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.isActive) return { label: 'Disattivato', color: 'gray' };
    if (isExpired(coupon.validUntil)) return { label: 'Scaduto', color: 'red' };
    if (isMaxUsesReached(coupon)) return { label: 'Esaurito', color: 'orange' };
    return { label: 'Attivo', color: 'green' };
  };

  const getUsageProgress = (coupon: Coupon) => {
    if (!coupon.maxUses) return null;
    const percentage = (coupon.usedCount / coupon.maxUses) * 100;
    return {
      percentage: Math.min(percentage, 100),
      isNearLimit: percentage >= 80,
      isWarning: percentage >= 60
    };
  };

  const getCouponStats = () => {
    const total = coupons.length;
    const active = coupons.filter(c => c.isActive && !isExpired(c.validUntil) && !isMaxUsesReached(c)).length;
    const expired = coupons.filter(c => isExpired(c.validUntil)).length;
    const exhausted = coupons.filter(c => isMaxUsesReached(c)).length;
    const totalUsages = coupons.reduce((sum, c) => sum + c.usedCount, 0);
    const nearLimit = coupons.filter(c => {
      const progress = getUsageProgress(c);
      return progress?.isNearLimit && c.isActive;
    }).length;

    return { total, active, expired, exhausted, totalUsages, nearLimit };
  };

  // Check if this is a child partner - they shouldn't see coupons
  if (partnerCompany?.parentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Accesso Limitato
          </h3>
          <p className="text-gray-600">
            I partner figli non hanno accesso alla gestione dei coupon. 
            Questa funzionalità è disponibile solo per le aziende parent.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="w-6 h-6 animate-spin text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-gray-600">Caricamento coupon...</span>
      </div>
    );
  }

  const stats = getCouponStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Coupon</h2>
          <p className="text-gray-600 mt-1">Crea e gestisci coupon sconto per i tuoi clienti</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => isAuthenticated() && loadCoupons()}
            disabled={!isAuthenticated()}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Ricarica
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuovo Coupon
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {!loading && coupons.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2.01 2.01 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Totali</p>
                <p className="text-xl font-semibold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Attivi</p>
                <p className="text-xl font-semibold text-green-600">{stats.active}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Esauriti</p>
                <p className="text-xl font-semibold text-orange-600">{stats.exhausted}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">In Scadenza</p>
                <p className="text-xl font-semibold text-red-600">{stats.nearLimit}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 6v6m-7 0h14a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Scaduti</p>
                <p className="text-xl font-semibold text-gray-600">{stats.expired}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Utilizzi Tot.</p>
                <p className="text-xl font-semibold text-purple-600">{stats.totalUsages}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form creazione coupon */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Crea Nuovo Coupon</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Codice coupon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice Coupon *
                </label>
                <input
                  type="text"
                  {...register('code')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="es. SCONTO10, welcome-20, promo_estate"
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>
                )}
              </div>

              {/* Tipo sconto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Sconto *
                </label>
                <select
                  {...register('discountType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleziona tipo sconto</option>
                  <option value="PERCENTAGE">Percentuale</option>
                  <option value="FIXED">Importo fisso</option>
                </select>
                {errors.discountType && (
                  <p className="mt-1 text-sm text-red-600">{errors.discountType.message}</p>
                )}
              </div>

              {/* Valore sconto */}
              {discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentuale Sconto *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      {...register('discountPercent', { valueAsNumber: true })}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                  {errors.discountPercent && (
                    <p className="mt-1 text-sm text-red-600">{errors.discountPercent.message}</p>
                  )}
                </div>
              )}

              {discountType === 'FIXED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Importo Sconto *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">€</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      {...register('discountAmount', { valueAsNumber: true })}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="50.00"
                    />
                  </div>
                  {errors.discountAmount && (
                    <p className="mt-1 text-sm text-red-600">{errors.discountAmount.message}</p>
                  )}
                </div>
              )}

              {/* Utilizzi massimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Utilizzi Massimi (opzionale)
                </label>
                <input
                  type="number"
                  min="1"
                  {...register('maxUses', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="100"
                />
                {errors.maxUses && (
                  <p className="mt-1 text-sm text-red-600">{errors.maxUses.message}</p>
                )}
              </div>

              {/* Date validità */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inizio *
                </label>
                <input
                  type="date"
                  {...register('validFrom')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.validFrom && (
                  <p className="mt-1 text-sm text-red-600">{errors.validFrom.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Fine *
                </label>
                <input
                  type="date"
                  {...register('validUntil')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.validUntil && (
                  <p className="mt-1 text-sm text-red-600">{errors.validUntil.message}</p>
                )}
              </div>

              {/* Target Company Selection (for ADMINISTRATIVE users) */}
              {availableCompanies.length > 1 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Azienda Target (opzionale)
                  </label>
                  <select
                    value={selectedTargetCompany}
                    onChange={(e) => setSelectedTargetCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Mia azienda</option>
                    {availableCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.referralCode})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Seleziona un'azienda specifica per creare il coupon per quella azienda
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {submitting && (
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {submitting ? 'Creazione...' : 'Crea Coupon'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista coupon */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Coupon Esistenti</h3>
        </div>

        {coupons.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2.01 2.01 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-gray-500 text-lg">Nessun coupon creato</p>
            <p className="text-gray-400 text-sm mt-1">Crea il tuo primo coupon per iniziare</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {coupons.map((coupon) => {
              const status = getCouponStatus(coupon);
              const usageProgress = getUsageProgress(coupon);
              
              return (
                <div key={coupon.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="font-mono text-lg font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                          {coupon.code}
                        </div>
                        <span className={`
                          px-2 py-1 text-xs font-semibold rounded-full
                          ${status.color === 'green' ? 'bg-green-100 text-green-800' :
                            status.color === 'red' ? 'bg-red-100 text-red-800' :
                            status.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'}
                        `}>
                          {status.label}
                        </span>
                        <span className="text-lg font-semibold text-blue-600">
                          {formatDiscount(coupon)}
                        </span>
                        
                        {/* Company Badge */}
                        {coupon.partnerCompany && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            {coupon.partnerCompany.name}
                          </span>
                        )}
                        
                        {/* Usage indicator badge */}
                        {coupon.maxUses && (
                          <span className={`
                            px-2 py-1 text-xs font-medium rounded-full
                            ${usageProgress?.isNearLimit 
                              ? 'bg-red-100 text-red-700' 
                              : usageProgress?.isWarning 
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                            }
                          `}>
                            {coupon.usedCount}/{coupon.maxUses}
                          </span>
                        )}
                      </div>
                      
                      {/* Usage Progress Bar */}
                      {usageProgress && (
                        <div className="mt-3 mb-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Utilizzi</span>
                            <span>{Math.round(usageProgress.percentage)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`
                                h-2 rounded-full transition-all duration-300
                                ${usageProgress.isNearLimit 
                                  ? 'bg-gradient-to-r from-red-400 to-red-600' 
                                  : usageProgress.isWarning 
                                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                                    : 'bg-gradient-to-r from-blue-400 to-blue-600'
                                }
                              `}
                              style={{ width: `${usageProgress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 text-sm text-gray-600 space-x-4">
                        <span>
                          Utilizzi: 
                          <span className={`
                            font-semibold ml-1
                            ${usageProgress?.isNearLimit 
                              ? 'text-red-600' 
                              : usageProgress?.isWarning 
                                ? 'text-yellow-600'
                                : coupon.usedCount > 0 
                                  ? 'text-green-600'
                                  : 'text-gray-500'
                            }
                          `}>
                            {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ' (illimitati)'}
                          </span>
                        </span>
                        <span>Dal {new Date(coupon.validFrom).toLocaleDateString('it-IT')}</span>
                        <span>Al {new Date(coupon.validUntil).toLocaleDateString('it-IT')}</span>
                        {coupon.partnerCompany && (
                          <span className="text-purple-600 font-medium">
                            {coupon.partnerCompany.referralCode}
                          </span>
                        )}
                      </div>

                      {/* Usage warning alerts */}
                      {usageProgress?.isNearLimit && coupon.isActive && (
                        <div className="mt-2 flex items-center text-xs text-red-600 bg-red-50 px-3 py-1 rounded">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Attenzione: pochi utilizzi rimasti!
                        </div>
                      )}
                      
                      {usageProgress?.isWarning && !usageProgress.isNearLimit && coupon.isActive && (
                        <div className="mt-2 flex items-center text-xs text-yellow-600 bg-yellow-50 px-3 py-1 rounded">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          Coupon utilizzato oltre il 60%
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* View Usage button - only show if coupon has been used */}
                      {coupon.usedCount > 0 && (
                        <button
                          onClick={() => loadCouponUsage(coupon.id)}
                          disabled={loadingUsage}
                          className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors disabled:opacity-50 flex items-center"
                        >
                          {loadingUsage ? (
                            <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          Log Utilizzi
                        </button>
                      )}
                      
                      <button
                        onClick={() => toggleCouponStatus(coupon.id)}
                        disabled={isMaxUsesReached(coupon)}
                        className={`
                          px-3 py-1 text-sm rounded transition-colors
                          ${isMaxUsesReached(coupon) 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                            coupon.isActive 
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }
                        `}
                      >
                        {isMaxUsesReached(coupon) ? 'Esaurito' : 
                         coupon.isActive ? 'Disattiva' : 'Attiva'}
                      </button>
                      
                      <button
                        onClick={() => deleteCoupon(coupon)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && couponToDelete && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingCoupon) {
              cancelDeleteCoupon();
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl transform transition-all animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with danger styling */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-100" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Elimina Coupon</h3>
                  <p className="text-red-100 text-sm">Questa azione non può essere annullata</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <p className="text-gray-900 text-lg font-semibold mb-2">
                  Sei sicuro di voler eliminare questo coupon?
                </p>
                <p className="text-gray-600 text-sm">
                  Stai per eliminare definitivamente il coupon:
                </p>
              </div>

              {/* Coupon Info Card */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border-l-4 border-red-400">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-mono text-lg font-bold text-gray-900 bg-white px-2 py-1 rounded border">
                        {couponToDelete.code}
                      </span>
                      <span className="text-blue-600 font-semibold">
                        {formatDiscount(couponToDelete)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>Utilizzi: {couponToDelete.usedCount}</span>
                      {couponToDelete.maxUses && <span>/{couponToDelete.maxUses}</span>}
                      <span className="ml-3">
                        Scadenza: {new Date(couponToDelete.validUntil).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning if coupon has been used */}
              {couponToDelete.usedCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Attenzione:</strong> Questo coupon è stato utilizzato {couponToDelete.usedCount} volte. 
                        Eliminandolo, perderai lo storico degli utilizzi.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">
                        <strong>Errore:</strong> {deleteError}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with action buttons */}
            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                onClick={cancelDeleteCoupon}
                disabled={deletingCoupon}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={confirmDeleteCoupon}
                disabled={deletingCoupon}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {deletingCoupon ? (
                  <>
                    <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Eliminazione...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Elimina Definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Logs Modal */}
      {showUsageModal && selectedCouponUsage && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Log Utilizzi Coupon
                </h3>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="font-mono text-lg font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    {selectedCouponUsage.coupon.code}
                  </span>
                  <span className="text-sm text-gray-600">
                    {selectedCouponUsage.totalUses} utilizzi totali
                    {selectedCouponUsage.coupon.maxUses && ` / ${selectedCouponUsage.coupon.maxUses} max`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUsageModal(false);
                  setSelectedCouponUsage(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
              {selectedCouponUsage.usageLogs.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">Nessun utilizzo registrato</p>
                </div>
              ) : (
                <div>
                  {selectedCouponUsage.usageLogs.map((log) => (
                    <div key={log.id} className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {log.user.nome} {log.user.cognome}
                              </p>
                              <p className="text-sm text-gray-600">{log.user.email}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 font-medium">Data/Ora Utilizzo</p>
                              <p className="text-gray-900">
                                {new Date(log.usedAt).toLocaleString('it-IT', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-gray-500 font-medium">Sconto Applicato</p>
                              <p className="text-green-600 font-semibold">
                                -€{Number(log.discountApplied).toFixed(2)}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-gray-500 font-medium">Offerta</p>
                              <p className="text-gray-900">{log.registration.offerName}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex-shrink-0 ml-4">
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                            Utilizzato
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Sconto totale erogato:</span>
                  <span className="ml-2 text-green-600 font-semibold">
                    -€{selectedCouponUsage.usageLogs.reduce((sum, log) => sum + Number(log.discountApplied), 0).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowUsageModal(false);
                    setSelectedCouponUsage(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

export default CouponManagement;