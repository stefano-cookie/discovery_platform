import React from 'react';
import { Building2 } from 'lucide-react';
import ConfirmModal from '../../UI/ConfirmModal';

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
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={isCurrentlyActive ? 'Disattiva Company' : 'Attiva Company'}
      message={
        <div>
          <p className="text-gray-900 font-medium mb-2">
            Stai per {isCurrentlyActive ? 'disattivare' : 'attivare'} la company:
          </p>
          <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {companyName}
          </p>
        </div>
      }
      confirmText={isCurrentlyActive ? 'Disattiva' : 'Attiva'}
      cancelText="Annulla"
      variant={isCurrentlyActive ? 'danger' : 'success'}
      details={
        isCurrentlyActive
          ? [
              'I dipendenti non potranno più accedere al sistema',
              'Non sarà possibile creare nuove iscrizioni',
              'La company non apparirà nelle liste attive'
            ]
          : [
              'I dipendenti potranno nuovamente accedere',
              'Sarà possibile creare nuove iscrizioni',
              'La company tornerà operativa'
            ]
      }
    />
  );
};