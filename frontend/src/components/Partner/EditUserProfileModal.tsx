import React, { useState } from 'react';
import { PartnerUser } from '../../types/partner';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setSuccessMessage(null);

    try {
      console.log('Updating user profile:', user.id, formData);
      await partnerService.updateUserProfile(user.id, formData);
      setSuccessMessage('Anagrafica aggiornata con successo!');
      setTimeout(() => {
        onUpdated();
      }, 1500);
    } catch (err: any) {
      console.error('Update error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Errore durante l\'aggiornamento dell\'anagrafica';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl flex justify-between items-center shadow-lg z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Modifica Anagrafica
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all p-2 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold">Errore</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-6 py-4 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold">Successo!</p>
                <p className="text-sm">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Dati Personali */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Dati Personali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cognome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Inserisci cognome"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Inserisci nome"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Codice Fiscale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="codiceFiscale"
                  value={formData.codiceFiscale}
                  onChange={handleChange}
                  required
                  maxLength={16}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono uppercase"
                  placeholder="RSSMRA80A01H501X"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telefono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="+39 123 456 7890"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  name="dataNascita"
                  value={formData.dataNascita}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sesso
                </label>
                <select
                  name="sesso"
                  value={formData.sesso}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Seleziona</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Luogo di Nascita
                </label>
                <input
                  type="text"
                  name="luogoNascita"
                  value={formData.luogoNascita}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Città"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Provincia di Nascita
                </label>
                <input
                  type="text"
                  name="provinciaNascita"
                  value={formData.provinciaNascita}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase"
                  placeholder="RM"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Padre
                </label>
                <input
                  type="text"
                  name="nomePadre"
                  value={formData.nomePadre}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Madre
                </label>
                <input
                  type="text"
                  name="nomeMadre"
                  value={formData.nomeMadre}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Nome completo"
                />
              </div>
            </div>
          </div>

          {/* Residenza */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Residenza
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Via/Indirizzo
                </label>
                <input
                  type="text"
                  name="residenzaVia"
                  value={formData.residenzaVia}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Via Roma, 123"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Città
                </label>
                <input
                  type="text"
                  name="residenzaCitta"
                  value={formData.residenzaCitta}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Roma"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Provincia
                </label>
                <input
                  type="text"
                  name="residenzaProvincia"
                  value={formData.residenzaProvincia}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all uppercase"
                  placeholder="RM"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CAP
                </label>
                <input
                  type="text"
                  name="residenzaCap"
                  value={formData.residenzaCap}
                  onChange={handleChange}
                  maxLength={5}
                  className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="00100"
                />
              </div>
            </div>
          </div>

          {/* Domicilio */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Domicilio
              </h3>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border-2 border-green-200 hover:border-green-300 transition-all">
                <input
                  type="checkbox"
                  name="hasDifferentDomicilio"
                  checked={formData.hasDifferentDomicilio}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">Diverso dalla residenza</span>
              </label>
            </div>

            {formData.hasDifferentDomicilio ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Via/Indirizzo
                  </label>
                  <input
                    type="text"
                    name="domicilioVia"
                    value={formData.domicilioVia}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Via Milano, 456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Città
                  </label>
                  <input
                    type="text"
                    name="domicilioCitta"
                    value={formData.domicilioCitta}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Milano"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Provincia
                  </label>
                  <input
                    type="text"
                    name="domicilioProvincia"
                    value={formData.domicilioProvincia}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all uppercase"
                    placeholder="MI"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CAP
                  </label>
                  <input
                    type="text"
                    name="domicilioCap"
                    value={formData.domicilioCap}
                    onChange={handleChange}
                    maxLength={5}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="20100"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">Il domicilio coincide con la residenza</p>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-100 sticky bottom-0 bg-white pb-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvataggio...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Salva Modifiche
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserProfileModal;
