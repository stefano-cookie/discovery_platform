import React, { useState, useEffect } from 'react';
import { PartnerUser } from '../../types/partner';
import Button from '../UI/Button';
import { partnerService } from '../../services/partner';

interface EditUserProfileModalProps {
  user: PartnerUser;
  onClose: () => void;
  onUpdated: () => void;
}

interface ProfileFormData {
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  provinciaNascita: string;
  sesso: string;
  codiceFiscale: string;
  telefono: string;
  nomePadre: string;
  nomeMadre: string;
  residenzaVia: string;
  residenzaCitta: string;
  residenzaProvincia: string;
  residenzaCap: string;
  hasDifferentDomicilio: boolean;
  domicilioVia: string;
  domicilioCitta: string;
  domicilioProvincia: string;
  domicilioCap: string;
}

const EditUserProfileModal: React.FC<EditUserProfileModalProps> = ({ user, onClose, onUpdated }) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    cognome: user.profile?.cognome || '',
    nome: user.profile?.nome || '',
    dataNascita: user.profile?.dataNascita ? new Date(user.profile.dataNascita).toISOString().split('T')[0] : '',
    luogoNascita: user.profile?.luogoNascita || '',
    provinciaNascita: user.profile?.provinciaNascita || '',
    sesso: user.profile?.sesso || '',
    codiceFiscale: user.profile?.codiceFiscale || '',
    telefono: user.profile?.telefono || '',
    nomePadre: user.profile?.nomePadre || '',
    nomeMadre: user.profile?.nomeMadre || '',
    residenzaVia: user.profile?.residenzaVia || '',
    residenzaCitta: user.profile?.residenzaCitta || '',
    residenzaProvincia: user.profile?.residenzaProvincia || '',
    residenzaCap: user.profile?.residenzaCap || '',
    hasDifferentDomicilio: user.profile?.hasDifferentDomicilio || false,
    domicilioVia: user.profile?.domicilioVia || '',
    domicilioCitta: user.profile?.domicilioCitta || '',
    domicilioProvincia: user.profile?.domicilioProvincia || '',
    domicilioCap: user.profile?.domicilioCap || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await partnerService.updateUserProfile(user.id, formData);
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante l\'aggiornamento dell\'anagrafica');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            Modifica Anagrafica - {user.email}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Dati Personali */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dati Personali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cognome *
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codice Fiscale *
                </label>
                <input
                  type="text"
                  name="codiceFiscale"
                  value={formData.codiceFiscale}
                  onChange={handleChange}
                  required
                  maxLength={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono *
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  name="dataNascita"
                  value={formData.dataNascita}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Luogo di Nascita
                </label>
                <input
                  type="text"
                  name="luogoNascita"
                  value={formData.luogoNascita}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provincia di Nascita
                </label>
                <input
                  type="text"
                  name="provinciaNascita"
                  value={formData.provinciaNascita}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sesso
                </label>
                <select
                  name="sesso"
                  value={formData.sesso}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleziona</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Padre
                </label>
                <input
                  type="text"
                  name="nomePadre"
                  value={formData.nomePadre}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Madre
                </label>
                <input
                  type="text"
                  name="nomeMadre"
                  value={formData.nomeMadre}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Residenza */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Residenza</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Via
                </label>
                <input
                  type="text"
                  name="residenzaVia"
                  value={formData.residenzaVia}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Città
                </label>
                <input
                  type="text"
                  name="residenzaCitta"
                  value={formData.residenzaCitta}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provincia
                </label>
                <input
                  type="text"
                  name="residenzaProvincia"
                  value={formData.residenzaProvincia}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CAP
                </label>
                <input
                  type="text"
                  name="residenzaCap"
                  value={formData.residenzaCap}
                  onChange={handleChange}
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Domicilio */}
          <div>
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                name="hasDifferentDomicilio"
                checked={formData.hasDifferentDomicilio}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Domicilio diverso dalla residenza
              </label>
            </div>

            {formData.hasDifferentDomicilio && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Via
                  </label>
                  <input
                    type="text"
                    name="domicilioVia"
                    value={formData.domicilioVia}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Città
                  </label>
                  <input
                    type="text"
                    name="domicilioCitta"
                    value={formData.domicilioCitta}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provincia
                  </label>
                  <input
                    type="text"
                    name="domicilioProvincia"
                    value={formData.domicilioProvincia}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CAP
                  </label>
                  <input
                    type="text"
                    name="domicilioCap"
                    value={formData.domicilioCap}
                    onChange={handleChange}
                    maxLength={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={isSubmitting}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserProfileModal;
