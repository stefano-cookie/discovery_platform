export interface RegistrationData {
  // Dati generali
  email: string;
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  codiceFiscale: string;
  telefono: string;
  nomePadre?: string;
  nomeMadre?: string;
  
  // Residenza
  residenzaVia: string;
  residenzaCitta: string;
  residenzaProvincia: string;
  residenzaCap: string;
  
  // Domicilio
  hasDifferentDomicilio: boolean;
  domicilioVia?: string;
  domicilioCitta?: string;
  domicilioProvincia?: string;
  domicilioCap?: string;
  
  // Istruzione
  tipoLaurea: string;
  laureaConseguita: string;
  laureaUniversita: string;
  laureaData: string;
  
  // Professione
  tipoProfessione: string;
  scuolaDenominazione?: string;
  scuolaCitta?: string;
  scuolaProvincia?: string;
  
  // Documenti
  cartaIdentita?: File;
  certificatoLaureaTriennale?: File;
  certificatoLaureaMagistrale?: File;
  certificatoMedico?: File;
  
  // Iscrizione
  courseId?: string;
  partnerOfferId?: string;
  couponCode?: string;
  referralCode?: string;
}

export interface FormStep {
  id: string;
  title: string;
  isValid: boolean;
  isCompleted: boolean;
}