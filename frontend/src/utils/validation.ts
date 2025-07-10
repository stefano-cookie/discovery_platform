import { z } from 'zod';

// Step 1: Dati Generali
export const generalDataSchema = z.object({
  email: z.string().email('Email non valida'),
  cognome: z.string().min(1, 'Cognome richiesto'),
  nome: z.string().min(1, 'Nome richiesto'),
  dataNascita: z.string().min(1, 'Data di nascita richiesta'),
  luogoNascita: z.string().min(1, 'Luogo di nascita richiesto'),
  codiceFiscale: z.string().length(16, 'Codice fiscale deve essere di 16 caratteri'),
  telefono: z.string().min(10, 'Numero di telefono non valido'),
  nomePadre: z.string().optional(),
  nomeMadre: z.string().optional(),
});

// Step 2: Residenza
export const residenceSchema = z.object({
  residenzaVia: z.string().min(1, 'Via richiesta'),
  residenzaCitta: z.string().min(1, 'Città richiesta'),
  residenzaProvincia: z.string().min(2, 'Provincia richiesta'),
  residenzaCap: z.string().length(5, 'CAP deve essere di 5 cifre'),
  hasDifferentDomicilio: z.boolean(),
  domicilioVia: z.string().optional(),
  domicilioCitta: z.string().optional(),
  domicilioProvincia: z.string().optional(),
  domicilioCap: z.string().optional(),
}).refine((data) => {
  if (data.hasDifferentDomicilio) {
    return data.domicilioVia && data.domicilioCitta && data.domicilioProvincia && data.domicilioCap;
  }
  return true;
}, {
  message: 'Se il domicilio è diverso dalla residenza, tutti i campi sono obbligatori',
  path: ['domicilioVia'],
});

// Step 3: Istruzione
export const educationSchema = z.object({
  tipoLaurea: z.string().min(1, 'Tipo laurea richiesto'),
  laureaConseguita: z.string().min(1, 'Laurea conseguita richiesta'),
  laureaUniversita: z.string().min(1, 'Università richiesta'),
  laureaData: z.string().min(1, 'Data laurea richiesta'),
});

// Step 4: Professione
export const professionSchema = z.object({
  tipoProfessione: z.string().min(1, 'Tipo professione richiesto'),
  scuolaDenominazione: z.string().optional(),
  scuolaCitta: z.string().optional(),
  scuolaProvincia: z.string().optional(),
});

// Step 5: Documenti (validazione file fatta separatamente)
export const documentsSchema = z.object({
  cartaIdentita: z.any().optional(),
  certificatoLaureaTriennale: z.any().optional(),
  certificatoLaureaMagistrale: z.any().optional(),
  certificatoMedico: z.any().optional(),
});

// Step 6: Iscrizione
export const registrationSchema = z.object({
  courseId: z.string().optional(),
  partnerOfferId: z.string().optional(),
  couponCode: z.string().optional(),
  referralCode: z.string().optional(),
});

// Schema completo
export const completeRegistrationSchema = generalDataSchema
  .merge(residenceSchema)
  .merge(educationSchema)
  .merge(professionSchema)
  .merge(documentsSchema)
  .merge(registrationSchema);

export type GeneralDataForm = z.infer<typeof generalDataSchema>;
export type ResidenceForm = z.infer<typeof residenceSchema>;
export type EducationForm = z.infer<typeof educationSchema>;
export type ProfessionForm = z.infer<typeof professionSchema>;
export type DocumentsForm = z.infer<typeof documentsSchema>;
export type RegistrationForm = z.infer<typeof registrationSchema>;
export type CompleteRegistrationForm = z.infer<typeof completeRegistrationSchema>;