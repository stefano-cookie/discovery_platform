export interface RegistrationData {
  // Dati generali
  email: string;
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  codiceFiscale: string;
  telefono: string;
  nomePadre: string;
  nomeMadre: string;
  
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
  laureaConseguitaCustom?: string;
  laureaUniversita: string;
  laureaData: string;
  
  // Istruzione triennale (condizionale per Magistrale)
  tipoLaureaTriennale?: string;
  laureaConseguitaTriennale?: string;
  laureaUniversitaTriennale?: string;
  laureaDataTriennale?: string;
  
  // Professione
  tipoProfessione: string;
  scuolaDenominazione?: string;
  scuolaCitta?: string;
  scuolaProvincia?: string;
  
  // Documenti
  cartaIdentita?: File;
  certificatoTriennale?: File;
  certificatoMagistrale?: File;
  pianoStudioTriennale?: File;
  pianoStudioMagistrale?: File;
  certificatoMedico?: File;
  certificatoNascita?: File;
  diplomoLaurea?: File;
  pergamenaLaurea?: File;
  
  // Opzioni Iscrizione
  courseId?: string;
  paymentPlan?: string;
  
  // Riepilogo
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