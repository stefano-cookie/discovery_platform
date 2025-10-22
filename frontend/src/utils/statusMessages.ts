/**
 * Messaggi di status centralizzati per iscrizioni
 * Sincronizzati tra vista Partner e vista Utente
 */

export interface StatusMessage {
  partner: string; // Messaggio per il partner
  user: string;    // Messaggio per l'utente
}

export const getStatusMessage = (
  status: string,
  offerType?: 'TFA' | 'CERTIFICATION'
): StatusMessage => {

  // Messaggi comuni per entrambi i tipi
  const commonMessages: Record<string, StatusMessage> = {
    PENDING: {
      partner: 'Nuova iscrizione. Prepara i contratti.',
      user: 'Iscrizione ricevuta. Il partner sta preparando i documenti.'
    },
    DATA_VERIFIED: {
      partner: 'Dati verificati. Procedi con i contratti.',
      user: 'Dati verificati. In attesa dei contratti.'
    },
    DOCUMENTS_UPLOADED: {
      partner: 'Documenti caricati. Verifica e approva.',
      user: 'Documenti caricati. In attesa di verifica.'
    },
    DOCUMENTS_PARTNER_CHECKED: {
      partner: 'Documenti verificati. In attesa approvazione Discovery.',
      user: 'Documenti verificati dal partner. In attesa approvazione finale.'
    },
    AWAITING_DISCOVERY_APPROVAL: {
      partner: 'In attesa approvazione Discovery.',
      user: 'In attesa di approvazione finale Discovery.'
    },
    DISCOVERY_APPROVED: {
      partner: 'Approvato da Discovery. Procedi con prossimi step.',
      user: 'Iscrizione approvata da Discovery!'
    },
    CONTRACT_GENERATED: {
      partner: 'Contratti generati. Carica contratti firmati.',
      user: 'Contratti pronti. Visualizza e attendi la firma del partner.'
    },
    CONTRACT_SIGNED: {
      partner: 'Contratti firmati. Attendi il pagamento.',
      user: 'Contratti firmati. Procedi con il pagamento.'
    },
    ENROLLED: {
      partner: 'Iscrizione attiva. Attendi pagamento utente.',
      user: 'Iscrizione attiva. Effettua il pagamento.'
    }
  };

  // Messaggi specifici per CERTIFICATION
  const certificationMessages: Record<string, StatusMessage> = {
    PENDING: {
      partner: 'Nuova iscrizione. In attesa del pagamento.',
      user: 'Iscrizione completata! Procedi con il pagamento per attivare la certificazione.'
    },
    CONTRACT_SIGNED: {
      partner: 'Iscrizione confermata. In attesa del pagamento.',
      user: 'Iscrizione confermata! Procedi con il pagamento per attivare la certificazione.'
    },
    ENROLLED: {
      partner: 'Pagamento ricevuto. Verifica documenti utente.',
      user: 'Pagamento ricevuto! Il partner verificherà i tuoi documenti.'
    },
    DOCUMENTS_APPROVED: {
      partner: 'Documenti approvati. Iscrivi l\'utente all\'esame.',
      user: 'Documenti approvati! Il partner ti iscriverà all\'esame.'
    },
    EXAM_REGISTERED: {
      partner: 'Iscritto all\'esame. Attendi conferma sostenimento.',
      user: 'Sei iscritto all\'esame! Sostieni l\'esame e attendi conferma.'
    },
    COMPLETED: {
      partner: 'Certificazione completata. Processo concluso.',
      user: 'Certificazione completata! Congratulazioni!'
    }
  };

  // Messaggi specifici per TFA
  const tfaMessages: Record<string, StatusMessage> = {
    ENROLLED: {
      partner: 'Pagamento ricevuto. Iscrizione attiva.',
      user: 'Pagamento ricevuto! Iscrizione attiva.'
    },
    CNRED_RELEASED: {
      partner: 'CNRED rilasciato. Attendi esame finale.',
      user: 'CNRED rilasciato! Preparati per l\'esame finale.'
    },
    FINAL_EXAM: {
      partner: 'Esame finale sostenuto. Invia richiesta riconoscimento.',
      user: 'Esame sostenuto! In attesa richiesta riconoscimento.'
    },
    RECOGNITION_REQUEST: {
      partner: 'Richiesta riconoscimento inviata. Attendi conferma.',
      user: 'Richiesta inviata! In attesa di riconoscimento.'
    },
    COMPLETED: {
      partner: 'TFA completato. Processo concluso.',
      user: 'TFA completato! Congratulazioni!'
    }
  };

  // Seleziona il messaggio appropriato
  // PRIMA controlla messaggi specifici per offerType (priorità)
  if (offerType === 'CERTIFICATION' && certificationMessages[status]) {
    return certificationMessages[status];
  }

  if (offerType === 'TFA' && tfaMessages[status]) {
    return tfaMessages[status];
  }

  // POI controlla messaggi comuni
  if (commonMessages[status]) {
    return commonMessages[status];
  }

  // Fallback per status sconosciuti
  return {
    partner: `Status: ${status}`,
    user: `Status: ${status}`
  };
};

/**
 * Ottieni solo il messaggio per il partner
 */
export const getPartnerStatusMessage = (
  status: string,
  offerType?: 'TFA' | 'CERTIFICATION'
): string => {
  return getStatusMessage(status, offerType).partner;
};

/**
 * Ottieni solo il messaggio per l'utente
 */
export const getUserStatusMessage = (
  status: string,
  offerType?: 'TFA' | 'CERTIFICATION'
): string => {
  return getStatusMessage(status, offerType).user;
};
