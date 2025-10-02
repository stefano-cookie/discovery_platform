import React, { useState } from 'react';
import { X, Building2, Mail, User, Sparkles, Crown, Info } from 'lucide-react';
import api from '../../../services/api';

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateCompanyForm {
  name: string;
  referralCode: string;
  isPremium: boolean;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  notes: string;
}

export const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CreateCompanyForm>({
    name: '',
    referralCode: '',
    isPremium: false,
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post('/admin/companies', {
        name: formData.name,
        referralCode: formData.referralCode,
        isPremium: formData.isPremium,
        adminEmail: formData.adminEmail,
        adminFirstName: formData.adminFirstName,
        adminLastName: formData.adminLastName,
        notes: formData.notes
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Errore durante la creazione della company'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      referralCode: '',
      isPremium: false,
      adminEmail: '',
      adminFirstName: '',
      adminLastName: '',
      notes: '',
    });
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header con Gradient */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 flex-shrink-0">
          <div className="absolute inset-0 bg-black opacity-5"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Crea Nuova Company
                  <Sparkles className="w-5 h-5" />
                </h2>
                <p className="text-indigo-100 mt-1">
                  Configura una nuova company partner e invita il primo amministratore
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Form con scroll */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-8 space-y-8" id="create-company-form">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 text-sm flex items-start gap-3 animate-in slide-in-from-top duration-300">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Company Details - Card Style */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
              <div className="flex items-center gap-2 mb-5">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Dettagli Company
                </h3>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Company *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Es. MAIN Education"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Referral Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.referralCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        referralCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                    placeholder="Es. MAIN001"
                  />
                </div>

                <div className="bg-white rounded-xl p-4 border-2 border-dashed border-indigo-200">
                  <label htmlFor="isPremium" className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="isPremium"
                      checked={formData.isPremium}
                      onChange={(e) =>
                        setFormData({ ...formData, isPremium: e.target.checked })
                      }
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        <span className="font-semibold text-gray-900">Company Premium</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Abilita la creazione di sub-partner e funzionalità avanzate
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* First Admin User - Card Style */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-center gap-2 mb-5">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Primo Amministratore
                </h3>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.adminFirstName}
                      onChange={(e) =>
                        setFormData({ ...formData, adminFirstName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Mario"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cognome *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.adminLastName}
                      onChange={(e) =>
                        setFormData({ ...formData, adminLastName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Rossi"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, adminEmail: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="mario.rossi@company.com"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Verrà inviata un'email di invito a questo indirizzo
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Note (opzionale)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                placeholder="Note aggiuntive sulla company, condizioni speciali, accordi particolari..."
              />
            </div>
          </form>
        </div>

        {/* Actions - Fixed Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold"
          >
            Annulla
          </button>
          <button
            type="submit"
            form="create-company-form"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creazione in corso...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Crea Company
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};