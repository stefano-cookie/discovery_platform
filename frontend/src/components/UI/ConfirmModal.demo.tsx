/**
 * ConfirmModal - Demo Component
 *
 * Questo componente dimostra tutti gli usi possibili del ConfirmModal unificato.
 * Usalo come riferimento per implementare conferme nella piattaforma.
 */

import React, { useState } from 'react';
import ConfirmModal from './ConfirmModal';

const ConfirmModalDemo: React.FC = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const simulateAsyncAction = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    setActiveModal(null);
    alert('Azione completata!');
  };

  const demos = [
    {
      id: 'delete-simple',
      label: 'Eliminazione Semplice',
      variant: 'danger' as const,
      title: 'Elimina Elemento',
      message: 'Sei sicuro di voler eliminare questo elemento?',
      confirmText: 'Elimina',
    },
    {
      id: 'delete-detailed',
      label: 'Eliminazione con Dettagli',
      variant: 'danger' as const,
      title: 'Elimina Annuncio',
      message: (
        <div>
          <p className="text-gray-900 font-medium mb-2">
            Stai per eliminare l'annuncio:
          </p>
          <p className="text-lg font-bold text-gray-900">
            "Comunicazione Importante Q1 2025"
          </p>
        </div>
      ),
      confirmText: 'Elimina',
      details: [
        'L\'annuncio sarà rimosso definitivamente',
        'Tutte le statistiche di lettura verranno perse',
        'Questa azione non può essere annullata'
      ],
    },
    {
      id: 'deactivate-company',
      label: 'Disattivazione Company',
      variant: 'danger' as const,
      title: 'Disattiva Company',
      message: (
        <div>
          <p className="text-gray-900 font-medium mb-2">
            Stai per disattivare la company:
          </p>
          <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Discovery Education S.r.l.
          </p>
        </div>
      ),
      confirmText: 'Disattiva',
      details: [
        'I dipendenti non potranno più accedere al sistema',
        'Non sarà possibile creare nuove iscrizioni',
        'La company non apparirà nelle liste attive'
      ],
    },
    {
      id: 'activate-company',
      label: 'Attivazione Company',
      variant: 'success' as const,
      title: 'Attiva Company',
      message: 'Confermi di voler attivare questa company?',
      confirmText: 'Attiva',
      details: [
        'I dipendenti potranno nuovamente accedere',
        'Sarà possibile creare nuove iscrizioni',
        'La company tornerà operativa'
      ],
    },
    {
      id: 'warning-action',
      label: 'Azione con Avviso',
      variant: 'warning' as const,
      title: 'Attenzione',
      message: 'Questa azione modificherà dati sensibili. Verificare prima di procedere.',
      confirmText: 'Procedi',
      details: [
        'I pagamenti in sospeso potrebbero essere modificati',
        'Verranno inviate notifiche agli utenti interessati'
      ],
    },
    {
      id: 'info-action',
      label: 'Conferma Generica',
      variant: 'info' as const,
      title: 'Conferma Operazione',
      message: 'Vuoi procedere con questa operazione?',
      confirmText: 'Conferma',
    },
    {
      id: 'loading-action',
      label: 'Con Loading State',
      variant: 'danger' as const,
      title: 'Elimina con Loading',
      message: 'Questa azione richiederà alcuni secondi...',
      confirmText: 'Elimina',
      details: [
        'Verranno eliminate tutte le dipendenze',
        'Il sistema sincronizzerà i dati',
        'Attendere il completamento'
      ],
      hasLoading: true,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ConfirmModal - Demo</h1>
        <p className="text-gray-600">
          Esempi di utilizzo del componente ConfirmModal unificato per conferme e azioni critiche.
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Come Utilizzare
        </h2>
        <div className="space-y-2 text-sm text-gray-700">
          <p className="flex items-start gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <span>Importa il componente: <code className="bg-white px-2 py-1 rounded">import ConfirmModal from '@/components/UI/ConfirmModal'</code></span>
          </p>
          <p className="flex items-start gap-2">
            <span className="font-bold text-blue-600">2.</span>
            <span>Gestisci stato apertura con <code className="bg-white px-2 py-1 rounded">useState</code></span>
          </p>
          <p className="flex items-start gap-2">
            <span className="font-bold text-blue-600">3.</span>
            <span>Scegli la variante appropriata: <code className="bg-white px-2 py-1 rounded">danger</code> per eliminazioni, <code className="bg-white px-2 py-1 rounded">warning</code> per modifiche critiche, ecc.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="font-bold text-blue-600">4.</span>
            <span>Aggiungi <code className="bg-white px-2 py-1 rounded">details</code> per spiegare le conseguenze dell'azione</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demos.map((demo) => (
          <button
            key={demo.id}
            onClick={() => setActiveModal(demo.id)}
            className={`p-6 rounded-xl border-2 transition-all text-left hover:scale-105 ${
              demo.variant === 'danger'
                ? 'bg-red-50 border-red-200 hover:border-red-400 hover:shadow-lg hover:shadow-red-100'
                : demo.variant === 'warning'
                ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-100'
                : demo.variant === 'success'
                ? 'bg-green-50 border-green-200 hover:border-green-400 hover:shadow-lg hover:shadow-green-100'
                : 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  demo.variant === 'danger'
                    ? 'bg-red-200 text-red-800'
                    : demo.variant === 'warning'
                    ? 'bg-yellow-200 text-yellow-800'
                    : demo.variant === 'success'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-blue-200 text-blue-800'
                }`}
              >
                {demo.variant.toUpperCase()}
              </span>
              {demo.hasLoading && (
                <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded-full font-medium">
                  con loading
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{demo.label}</h3>
            <p className="text-sm text-gray-600">Click per vedere il modal</p>
          </button>
        ))}
      </div>

      {/* Render all modals */}
      {demos.map((demo) => (
        <ConfirmModal
          key={demo.id}
          isOpen={activeModal === demo.id}
          onClose={() => {
            setActiveModal(null);
            setLoading(false);
          }}
          onConfirm={demo.hasLoading ? simulateAsyncAction : () => {
            setActiveModal(null);
            alert('Confermato!');
          }}
          title={demo.title}
          message={demo.message}
          confirmText={demo.confirmText}
          variant={demo.variant}
          details={demo.details}
          loading={demo.hasLoading ? loading : false}
        />
      ))}

      {/* Code Example */}
      <div className="mt-8 bg-gray-900 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Esempio Codice
        </h3>
        <pre className="text-sm text-green-400 font-mono leading-relaxed">
{`const [showModal, setShowModal] = useState(false);
const [deleting, setDeleting] = useState(false);

const handleDelete = async () => {
  setDeleting(true);
  try {
    await api.delete(itemId);
    // Success
  } finally {
    setDeleting(false);
    setShowModal(false);
  }
};

<ConfirmModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleDelete}
  title="Elimina Elemento"
  message="Sei sicuro di voler eliminare?"
  confirmText="Elimina"
  variant="danger"
  details={[
    'Azione irreversibile',
    'I dati verranno persi'
  ]}
  loading={deleting}
/>`}
        </pre>
      </div>
    </div>
  );
};

export default ConfirmModalDemo;
