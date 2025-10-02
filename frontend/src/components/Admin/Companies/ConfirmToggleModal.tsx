import React from 'react';
import { AlertTriangle, Power, X, Building2 } from 'lucide-react';

interface ConfirmToggleModalProps {
  isOpen: boolean;
  companyName: string;
  isCurrentlyActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmToggleModal: React.FC<ConfirmToggleModalProps> = ({
  isOpen,
  companyName,
  isCurrentlyActive,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className={`relative p-6 rounded-t-2xl ${
          isCurrentlyActive
            ? 'bg-gradient-to-r from-red-500 to-red-600'
            : 'bg-gradient-to-r from-green-500 to-green-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl">
                {isCurrentlyActive ? (
                  <AlertTriangle className="w-6 h-6 text-white" />
                ) : (
                  <Power className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {isCurrentlyActive ? 'Disattiva Company' : 'Attiva Company'}
                </h3>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className={`p-4 rounded-xl mb-6 ${
            isCurrentlyActive
              ? 'bg-red-50 border border-red-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className="text-gray-900 font-medium mb-2">
              Stai per {isCurrentlyActive ? 'disattivare' : 'attivare'} la company:
            </p>
            <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {companyName}
            </p>
          </div>

          {isCurrentlyActive ? (
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-700 font-medium">
                ⚠️ Conseguenze della disattivazione:
              </p>
              <ul className="space-y-2 text-sm text-gray-600 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>I dipendenti non potranno più accedere al sistema</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>Non sarà possibile creare nuove iscrizioni</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>La company non apparirà nelle liste attive</span>
                </li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-700 font-medium">
                ✅ Cosa accadrà riattivando:
              </p>
              <ul className="space-y-2 text-sm text-gray-600 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">•</span>
                  <span>I dipendenti potranno nuovamente accedere</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">•</span>
                  <span>Sarà possibile creare nuove iscrizioni</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">•</span>
                  <span>La company tornerà operativa</span>
                </li>
              </ul>
            </div>
          )}

          <p className="text-sm text-gray-500 italic">
            Sei sicuro di voler procedere?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 text-white rounded-xl transition-all font-semibold shadow-lg flex items-center justify-center gap-2 ${
              isCurrentlyActive
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
            }`}
          >
            <Power className="w-5 h-5" />
            {isCurrentlyActive ? 'Disattiva' : 'Attiva'}
          </button>
        </div>
      </div>
    </div>
  );
};