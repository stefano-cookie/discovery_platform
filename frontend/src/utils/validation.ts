import { z } from 'zod';

// Step 1: General Data
export const generalDataSchema = z.object({
  email: z.string().email('Email non valida'),
  cognome: z.string().min(1, 'Cognome richiesto'),
  nome: z.string().min(1, 'Nome richiesto'),
  dataNascita: z.string().min(1, 'Data di nascita richiesta'),
  provinciaNascita: z.string().min(1, 'Provincia di nascita richiesta'),
  luogoNascita: z.string().min(1, 'Luogo di nascita richiesto'),
  sesso: z.string().refine(val => val === 'M' || val === 'F', { message: 'Sesso richiesto' }),
  codiceFiscale: z.string().length(16, 'Codice fiscale deve essere di 16 caratteri'),
  telefono: z.string().min(10, 'Numero di telefono non valido'),
  nomePadre: z.string().min(1, 'Nome del padre richiesto'),
  nomeMadre: z.string().min(1, 'Nome della madre richiesto'),
});

// Step 2: Residence - base schema
const residenceBaseSchema = z.object({
  residenzaVia: z.string().min(1, 'Via richiesta'),
  residenzaCitta: z.string().min(1, 'Città richiesta'),
  residenzaProvincia: z.string().min(2, 'Provincia richiesta'),
  residenzaCap: z.string().length(5, 'CAP deve essere di 5 cifre'),
  hasDifferentDomicilio: z.boolean(),
  domicilioVia: z.string().optional(),
  domicilioCitta: z.string().optional(),
  domicilioProvincia: z.string().optional(),
  domicilioCap: z.string().optional(),
});

// Step 2: Residence - with validation
export const residenceSchema = residenceBaseSchema.refine((data) => {
  if (data.hasDifferentDomicilio) {
    return data.domicilioVia && data.domicilioCitta && data.domicilioProvincia && data.domicilioCap;
  }
  return true;
}, {
  message: 'Se il domicilio è diverso dalla residenza, tutti i campi sono obbligatori',
  path: ['domicilioVia'],
});

// Step 3: Education - base schema
const educationBaseSchema = z.object({
  tipoLaurea: z.string().min(1, 'Tipo laurea richiesto'),
  laureaConseguita: z.string().min(1, 'Laurea conseguita richiesta'),
  laureaConseguitaCustom: z.string().optional(),
  laureaUniversita: z.string().min(1, 'Università richiesta'),
  laureaData: z.string().min(1, 'Data laurea richiesta'),
  
  // Campi triennale condizionali
  tipoLaureaTriennale: z.string().optional(),
  laureaConseguitaTriennale: z.string().optional(),
  laureaUniversitaTriennale: z.string().optional(),
  laureaDataTriennale: z.string().optional(),
  
  // Diploma superiori (obbligatorio per TFA)
  diplomaData: z.string().min(1, 'Data conseguimento diploma richiesta'),
  diplomaCitta: z.string().min(1, 'Città conseguimento diploma richiesta'),
  diplomaProvincia: z.string().min(1, 'Provincia conseguimento diploma richiesta'),
  diplomaIstituto: z.string().min(1, 'Istituto conseguimento diploma richiesto'),
  diplomaVoto: z.string().min(1, 'Voto diploma richiesto'),
});

// Step 3: Education - with validation
export const educationSchema = educationBaseSchema.refine((data) => {
  if (data.laureaConseguita === 'ALTRO') {
    return data.laureaConseguitaCustom && data.laureaConseguitaCustom.trim().length > 0;
  }
  return true;
}, {
  message: 'Se selezioni "Altro", devi specificare il corso di laurea',
  path: ['laureaConseguitaCustom'],
}).refine((data) => {
  // Se è laurea magistrale, i campi triennale sono obbligatori
  if (data.tipoLaurea === 'Magistrale') {
    return data.tipoLaureaTriennale;
  }
  return true;
}, {
  message: 'Tipo laurea triennale richiesto',
  path: ['tipoLaureaTriennale'],
}).refine((data) => {
  if (data.tipoLaurea === 'Magistrale') {
    return data.laureaConseguitaTriennale;
  }
  return true;
}, {
  message: 'Corso di laurea triennale richiesto',
  path: ['laureaConseguitaTriennale'],
}).refine((data) => {
  if (data.tipoLaurea === 'Magistrale') {
    return data.laureaUniversitaTriennale;
  }
  return true;
}, {
  message: 'Università triennale richiesta',
  path: ['laureaUniversitaTriennale'],
}).refine((data) => {
  if (data.tipoLaurea === 'Magistrale') {
    return data.laureaDataTriennale;
  }
  return true;
}, {
  message: 'Data conseguimento laurea triennale richiesta',
  path: ['laureaDataTriennale'],
});

// Step 4: Profession - base schema
const professionBaseSchema = z.object({
  tipoProfessione: z.string().min(1, 'Tipo professione richiesto'),
  scuolaDenominazione: z.string().optional(),
  scuolaCitta: z.string().optional(),
  scuolaProvincia: z.string().optional(),
});

// Step 4: Profession - with validation
export const professionSchema = professionBaseSchema.refine((data) => {
  if (data.tipoProfessione === 'Docente di ruolo' || data.tipoProfessione === 'Docente a tempo determinato') {
    return data.scuolaDenominazione && data.scuolaCitta && data.scuolaProvincia;
  }
  return true;
}, {
  message: 'Per i docenti sono richieste le informazioni scolastiche',
  path: ['scuolaDenominazione'],
});

// Step 5: Documents
export const documentsSchema = z.object({
  // Documenti opzionali
  cartaIdentita: z.any().optional(),
  
  // Certificati di laurea (sezione)
  certificatoTriennale: z.any().optional(),
  certificatoMagistrale: z.any().optional(),
  
  // Piani di studio (sezione)
  pianoStudioTriennale: z.any().optional(),
  pianoStudioMagistrale: z.any().optional(),
  
  // Altri documenti opzionali
  certificatoMedico: z.any().optional(),
  certificatoNascita: z.any().optional(),
  diplomoLaurea: z.any().optional(),
  pergamenaLaurea: z.any().optional(),
});

// Step 6: Registration
export const registrationSchema = z.object({
  courseId: z.string().optional(),
  partnerOfferId: z.string().optional(),
  couponCode: z.string().optional(),
  referralCode: z.string().optional(),
  couponValidation: z.object({
    isValid: z.boolean(),
    discount: z.object({
      type: z.string(),
      amount: z.union([z.number(), z.string().transform((val) => parseFloat(val) || 0)])
    }).optional()
  }).nullable().optional(),
});

// Complete schema - using base schemas for merging
export const completeRegistrationSchema = generalDataSchema
  .merge(residenceBaseSchema)
  .merge(educationBaseSchema)
  .merge(professionBaseSchema)
  .merge(documentsSchema)
  .merge(registrationSchema);

export type GeneralDataForm = z.infer<typeof generalDataSchema>;
export type ResidenceForm = z.infer<typeof residenceSchema>;
export type EducationForm = z.infer<typeof educationSchema>;
export type ProfessionForm = z.infer<typeof professionSchema>;
export type DocumentsForm = z.infer<typeof documentsSchema>;
export type RegistrationForm = z.infer<typeof registrationSchema>;
export type CompleteRegistrationForm = z.infer<typeof completeRegistrationSchema>;