import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
}

const CouponManagement: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  // Load coupons
  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      const token = localStorage.getItem('token');
      
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

  const onSubmit = async (data: CouponForm) => {
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/partners/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create error response:', errorData);
        throw new Error(errorData.error || 'Errore nella creazione del coupon');
      }

      // const result = await response.json();
      
      // Reload coupons to get the updated list
      await loadCoupons();
      
      setShowCreateForm(false);
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
      const token = localStorage.getItem('token');
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

  const deleteCoupon = async (couponId: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo coupon?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/partners/coupons/${couponId}`, {
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
        setCoupons(prev => prev.filter(coupon => coupon.id !== couponId));
      } catch (error) {
        console.error('Errore nell\'eliminazione del coupon:', error);
        alert(error instanceof Error ? error.message : 'Errore nell\'eliminazione del coupon');
      }
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
            onClick={() => loadCoupons()}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center"
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
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600 space-x-4">
                        <span>Utilizzi: {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ''}</span>
                        <span>Dal {new Date(coupon.validFrom).toLocaleDateString('it-IT')}</span>
                        <span>Al {new Date(coupon.validUntil).toLocaleDateString('it-IT')}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleCouponStatus(coupon.id)}
                        className={`
                          px-3 py-1 text-sm rounded transition-colors
                          ${coupon.isActive 
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }
                        `}
                      >
                        {coupon.isActive ? 'Disattiva' : 'Attiva'}
                      </button>
                      
                      <button
                        onClick={() => deleteCoupon(coupon.id)}
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
    </div>
  );
};

export default CouponManagement;