import React, { useState, useEffect } from 'react';
import { X, Building2, Sparkles, Crown, Info, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';

interface EditCompanyModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditCompanyForm {
  name: string;
  isActive: boolean;
  isPremium: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  referralCode: string;
  isActive: boolean;
  isPremium: boolean;
  canCreateChildren: boolean;
}

export const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  companyId,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<EditCompanyForm>({
    name: '',
    isActive: true,
    isPremium: false,
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCompanyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchCompanyData = async () => {
    try {
      setFetching(true);
      const response = await api.get<CompanyData>(`/admin/companies/${companyId}`);
      const data = response.data;
      setCompany(data);

      setFormData({
        name: data.name,
        isActive: data.isActive,
        isPremium: data.isPremium,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il caricamento dei dati');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.patch(`/admin/companies/${companyId}`, {
        name: formData.name,
        isActive: formData.isActive,
        isPremium: formData.isPremium,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Errore durante la modifica della company'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== company?.name) {
      setError('Il nome della company non corrisponde');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/admin/companies/${companyId}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Errore durante l\'eliminazione della company'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header con Gradient */}
        <div className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-8 flex-shrink-0">
          <div className="absolute inset-0 bg-black opacity-5"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Modifica Company
                  <Sparkles className="w-5 h-5" />
                </h2>
                <p className="text-pink-100 mt-1">
                  {company?.referralCode ? `Codice: ${company.referralCode}` : 'Caricamento...'}
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
          {fetching ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-8" id="edit-company-form">
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 text-sm flex items-start gap-3 animate-in slide-in-from-top duration-300">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Company Details - Card Style */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-center gap-2 mb-5">
                  <Building2 className="w-5 h-5 text-purple-600" />
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
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                      placeholder="Es. MAIN Education"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Active Status */}
                    <div className="bg-white rounded-xl p-4 border-2 border-dashed border-purple-200">
                      <label htmlFor="isActive" className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={formData.isActive}
                          onChange={(e) =>
                            setFormData({ ...formData, isActive: e.target.checked })
                          }
                          className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${formData.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="font-semibold text-gray-900">Company Attiva</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {formData.isActive ? 'Operativa e funzionante' : 'Disattivata'}
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Premium Status */}
                    <div className="bg-white rounded-xl p-4 border-2 border-dashed border-purple-200">
                      <label htmlFor="isPremium" className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          id="isPremium"
                          checked={formData.isPremium}
                          onChange={(e) =>
                            setFormData({ ...formData, isPremium: e.target.checked })
                          }
                          className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-yellow-500" />
                            <span className="font-semibold text-gray-900">Premium</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Può creare sub-partner
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Actions - Fixed Footer */}
        <div className="flex justify-between items-center gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          {/* Pulsante Elimina a sinistra */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={fetching || loading}
            className="px-6 py-3 text-red-600 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 transition-all font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5" />
            Elimina Company
          </button>

          {/* Pulsanti azione a destra */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              form="edit-company-form"
              disabled={loading || fetching}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvataggio...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Salva Modifiche
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal di Conferma Eliminazione */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Elimina Company Permanentemente
                </h3>
                <p className="text-gray-600">
                  Questa azione è <span className="font-bold text-red-600">irreversibile</span> ed eliminerà:
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-600">
                  <li>• Tutti i dipendenti della company</li>
                  <li>• Tutte le iscrizioni associate</li>
                  <li>• Tutti i documenti caricati</li>
                  <li>• Tutti i payment deadlines</li>
                  <li>• Tutte le offers create</li>
                </ul>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-red-900 mb-3">
                Per confermare, digita il nome della company:
              </p>
              <p className="text-lg font-bold text-red-700 mb-3 bg-white px-3 py-2 rounded-lg border border-red-200">
                {company?.name}
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-3 border-2 border-red-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Digita il nome della company..."
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setError(null);
                }}
                disabled={deleting}
                className="flex-1 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== company?.name}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Eliminazione...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Elimina Definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};