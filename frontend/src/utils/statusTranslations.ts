// Traduzioni centralizzate per gli stati del sistema
export interface StatusConfig {
  label: string;
  color: string;
  bg?: string;
  text?: string;
}

export const statusTranslations: Record<string, StatusConfig> = {
  PENDING: { 
    label: 'In Attesa', 
    color: 'bg-yellow-100 text-yellow-800',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800'
  },
  DATA_VERIFIED: { 
    label: 'Dati Verificati', 
    color: 'bg-blue-100 text-blue-800',
    bg: 'bg-blue-100',
    text: 'text-blue-800'
  },
  CONTRACT_GENERATED: { 
    label: 'Contratto Generato', 
    color: 'bg-purple-100 text-purple-800',
    bg: 'bg-purple-100',
    text: 'text-purple-800'
  },
  CONTRACT_SIGNED: { 
    label: 'Contratto Firmato', 
    color: 'bg-indigo-100 text-indigo-800',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800'
  },
  ENROLLED: { 
    label: 'Iscritto', 
    color: 'bg-green-100 text-green-800',
    bg: 'bg-green-100',
    text: 'text-green-800'
  },
  CNRED_RELEASED: { 
    label: 'CNRED Rilasciato', 
    color: 'bg-cyan-100 text-cyan-800',
    bg: 'bg-cyan-100',
    text: 'text-cyan-800'
  },
  FINAL_EXAM: { 
    label: 'Esame Finale', 
    color: 'bg-orange-100 text-orange-800',
    bg: 'bg-orange-100',
    text: 'text-orange-800'
  },
  RECOGNITION_REQUEST: { 
    label: 'Richiesta Riconoscimento', 
    color: 'bg-pink-100 text-pink-800',
    bg: 'bg-pink-100',
    text: 'text-pink-800'
  },
  COMPLETED: { 
    label: 'Completato', 
    color: 'bg-blue-100 text-blue-800',
    bg: 'bg-blue-100',
    text: 'text-blue-800'
  },
  ACTIVE: { 
    label: 'Attivo', 
    color: 'bg-green-100 text-green-800',
    bg: 'bg-green-100',
    text: 'text-green-800'
  },
  INACTIVE: { 
    label: 'Inattivo', 
    color: 'bg-red-100 text-red-800',
    bg: 'bg-red-100',
    text: 'text-red-800'
  },
  SUSPENDED: { 
    label: 'Sospeso', 
    color: 'bg-orange-100 text-orange-800',
    bg: 'bg-orange-100',
    text: 'text-orange-800'
  }
};

// Funzione helper per ottenere la traduzione di uno stato
export const getStatusTranslation = (status: string): StatusConfig => {
  return statusTranslations[status] || statusTranslations.PENDING;
};

// Funzione helper per creare il badge di stato
export const getStatusBadge = (status: string) => {
  const config = getStatusTranslation(status);
  return {
    label: config.label,
    className: `px-2 py-1 text-xs font-medium rounded-full ${config.color}`
  };
};

// Funzioni per display contestuali
export const getPartnerStatusDisplay = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'In Attesa';
    case 'CONTRACT_GENERATED':
      return 'Contratto Generato';
    case 'CONTRACT_SIGNED':
      return 'Contratto Firmato';
    case 'ENROLLED':
      return 'Attivo';
    case 'CNRED_RELEASED':
      return 'CNRED Rilasciato';
    case 'FINAL_EXAM':
      return 'Esame Finale';
    case 'RECOGNITION_REQUEST':
      return 'Richiesta Riconoscimento';
    case 'COMPLETED':
      return 'Completato';
    default:
      return status;
  }
};

export const getUserStatusDisplay = (status: string): string => {
  if (!status) return '';
  
  switch (status) {
    case 'PENDING':
      return 'In Attesa';
    case 'DATA_VERIFIED':
      return 'Dati Verificati';
    case 'CONTRACT_GENERATED':
      return 'Contratto Generato';
    case 'CONTRACT_SIGNED':
      return 'Contratto Firmato';
    case 'ENROLLED':
      return 'Iscritto';
    case 'CNRED_RELEASED':
      return 'CNRED Rilasciato';
    case 'FINAL_EXAM':
      return 'Esame Finale';
    case 'RECOGNITION_REQUEST':
      return 'Richiesta Riconoscimento';
    case 'COMPLETED':
      return 'Completato';
    // Aggiungiamo anche stati comuni dell'enrollment
    case 'ACTIVE':
      return 'Attivo';
    case 'INACTIVE':
      return 'Inattivo';
    case 'SUSPENDED':
      return 'Sospeso';
    default:
      // Se non troviamo una traduzione, restituiamo lo stato originale
      return status;
  }
};

// Funzione per ottenere i colori di stato per componenti legacy
export const getStatusColors = (status: string) => {
  const config = getStatusTranslation(status);
  return {
    bg: config.bg || 'bg-gray-100',
    text: config.text || 'text-gray-800',
    combined: config.color
  };
};