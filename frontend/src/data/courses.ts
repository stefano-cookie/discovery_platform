// Database dei corsi di laurea italiani organizzati per tipo

export interface CourseData {
  [key: string]: string[];
}

export const coursesByType: CourseData = {
  "Triennale": [
    // Area Umanistica
    "L-10 - Lettere",
    "L-5 - Filosofia", 
    "L-42 - Storia",
    "L-11 - Lingue e Culture Moderne",
    "L-20 - Scienze della Comunicazione",
    "L-19 - Scienze dell'Educazione e della Formazione",
    "L-1 - Beni Culturali",
    "L-3 - Discipline delle Arti Figurative, della Musica, dello Spettacolo e della Moda",
    
    // Area Economico-Giuridica
    "L-18 - Scienze dell'Economia e della Gestione Aziendale",
    "L-33 - Scienze Economiche",
    "L-36 - Scienze Politiche e delle Relazioni Internazionali",
    "L-16 - Scienze dell'Amministrazione e dell'Organizzazione",
    "L-14 - Scienze dei Servizi Giuridici",
    
    // Area Scientifica
    "L-35 - Scienze Matematiche",
    "L-30 - Scienze e Tecnologie Fisiche",
    "L-27 - Scienze e Tecnologie Chimiche",
    "L-13 - Scienze Biologiche",
    "L-32 - Scienze e Tecnologie per l'Ambiente e la Natura",
    "L-34 - Scienze Geologiche",
    "L-41 - Statistica",
    "L-31 - Scienze e Tecnologie Informatiche",
    
    // Area Ingegneria
    "L-7 - Ingegneria Civile e Ambientale",
    "L-9 - Ingegneria Industriale",
    "L-8 - Ingegneria dell'Informazione",
    "L-9 - Ingegneria Gestionale",
    "L-8 - Ingegneria Informatica",
    "L-8 - Ingegneria Elettronica",
    "L-9 - Ingegneria Meccanica",
    "L-9 - Ingegneria Aerospaziale",
    "L-9 - Ingegneria Chimica",
    "L-8 - Ingegneria Biomedica",
    "L-23 - Scienze e Tecniche dell'Edilizia",
    
    // Area Medico-Sanitaria
    "L-22 - Scienze delle Attività Motorie e Sportive",
    "L-24 - Scienze e Tecniche Psicologiche",
    "L-26 - Scienze e Tecnologie Agro-Alimentari",
    "L/SNT4 - Tecniche della Prevenzione nell'Ambiente e nei Luoghi di Lavoro",
    "L/SNT2 - Fisioterapia",
    "L/SNT1 - Infermieristica",
    "L/SNT2 - Logopedia",
    "L/SNT3 - Dietistica",
    "L/SNT3 - Igiene Dentale",
    "L/SNT3 - Tecniche di Laboratorio Biomedico",
    "L/SNT3 - Tecniche di Radiologia Medica",
    
    // Area Architettonica
    "L-17 - Scienze dell'Architettura",
    "L-4 - Disegno Industriale",
    "L-21 - Scienze della Pianificazione Territoriale, Urbanistica, Paesaggistica e Ambientale",
    
    // Area Agraria
    "L-25 - Scienze e Tecnologie Agrarie e Forestali",
    "L-25 - Scienze Forestali e Ambientali",
    "L-26 - Scienze e Tecnologie Alimentari",
    
    // Area Veterinaria
    "L-38 - Scienze Zootecniche e Tecnologie delle Produzioni Animali",
    
    // Area Sociale
    "L-39 - Servizio Sociale",
    "L-40 - Sociologia",
    "L-24 - Scienze e Tecniche Psicologiche"
  ],

  "Magistrale": [
    // Area Umanistica
    "LM-14 - Filologia Moderna",
    "LM-15 - Filologia, Letterature e Storia dell'Antichità",
    "LM-37 - Lingue e Letterature Moderne Europee e Americane",
    "LM-38 - Lingue Moderne per la Comunicazione e la Cooperazione Internazionale",
    "LM-39 - Scienze Linguistiche",
    "LM-78 - Scienze Filosofiche",
    "LM-84 - Scienze Storiche",
    "LM-19 - Informazione e Sistemi Editoriali",
    "LM-59 - Scienze della Comunicazione Pubblica, d'Impresa e Pubblicità",
    "LM-85 - Scienze Pedagogiche",
    "LM-50 - Programmazione e Gestione dei Servizi Educativi",
    "LM-2 - Archeologia",
    "LM-89 - Storia dell'Arte",
    "LM-45 - Musicologia e Beni Musicali",
    "LM-65 - Scienze dello Spettacolo e Produzione Multimediale",
    
    // Area Economico-Giuridica
    "LM-77 - Scienze Economico-Aziendali",
    "LM-16 - Finanza",
    "LM-56 - Scienze dell'Economia",
    "LM-52 - Relazioni Internazionali",
    "LM-63 - Scienze delle Pubbliche Amministrazioni",
    "LM-62 - Scienze della Politica",
    "LM-90 - Studi Europei",
    "LM-81 - Scienze per la Cooperazione allo Sviluppo",
    
    // Area Scientifica
    "LM-40 - Matematica",
    "LM-17 - Fisica",
    "LM-54 - Scienze Chimiche",
    "LM-6 - Biologia",
    "LM-75 - Scienze e Tecnologie per l'Ambiente e il Territorio",
    "LM-60 - Scienze della Natura",
    "LM-74 - Scienze e Tecnologie Geologiche",
    "LM-18 - Informatica",
    "LM-66 - Sicurezza Informatica",
    "LM-91 - Tecniche e Metodi per la Società dell'Informazione",
    
    // Area Ingegneria
    "LM-23 - Ingegneria Civile",
    "LM-35 - Ingegneria per l'Ambiente e il Territorio",
    "LM-33 - Ingegneria Meccanica",
    "LM-30 - Ingegneria Energetica e Nucleare",
    "LM-28 - Ingegneria Elettrica",
    "LM-29 - Ingegneria Elettronica",
    "LM-27 - Ingegneria delle Telecomunicazioni",
    "LM-32 - Ingegneria Informatica",
    "LM-31 - Ingegneria Gestionale",
    "LM-21 - Ingegneria Biomedica",
    "LM-20 - Ingegneria Aerospaziale e Astronautica",
    "LM-22 - Ingegneria Chimica",
    "LM-53 - Scienza e Ingegneria dei Materiali",
    
    // Area Medico-Sanitaria
    "LM-67 - Scienze e Tecniche delle Attività Motorie Preventive e Adattate",
    "LM-68 - Scienze e Tecniche dello Sport",
    "LM-51 - Psicologia",
    "LM-61 - Scienze della Nutrizione Umana",
    "LM/SNT1 - Scienze Infermieristiche e Ostetriche",
    "LM/SNT2 - Scienze delle Professioni Sanitarie della Riabilitazione",
    "LM/SNT3 - Scienze delle Professioni Sanitarie Tecniche",
    "LM/SNT4 - Scienze delle Professioni Sanitarie della Prevenzione",
    
    // Area Architettonica
    "LM-4 - Architettura e Ingegneria Edile-Architettura",
    "LM-3 - Architettura del Paesaggio",
    "LM-48 - Pianificazione Territoriale Urbanistica e Ambientale",
    "LM-12 - Design",
    
    // Area Agraria
    "LM-69 - Scienze e Tecnologie Agrarie",
    "LM-70 - Scienze e Tecnologie Alimentari",
    "LM-73 - Scienze e Tecnologie Forestali ed Ambientali",
    "LM-7 - Biotecnologie Agrarie",
    
    // Area Sociale
    "LM-87 - Servizio Sociale e Politiche Sociali",
    "LM-88 - Sociologia e Ricerca Sociale",
    "LM-87 - Politiche e Servizi Sociali"
  ],

  "Magistrale a ciclo unico": [
    "LM-41 - Medicina e Chirurgia",
    "LM-46 - Odontoiatria e Protesi Dentaria",
    "LM-42 - Medicina Veterinaria",
    "LM-13 - Farmacia e Farmacia Industriale",
    "LM-13 - Chimica e Tecnologia Farmaceutiche",
    "LMG/01 - Giurisprudenza",
    "LM-4 c.u. - Architettura",
    "LM-4 c.u. - Ingegneria Edile-Architettura",
    "LMR/02 - Conservazione e Restauro dei Beni Culturali",
    "LM-85 bis - Scienze della Formazione Primaria"
  ],

  "Vecchio ordinamento": [
    "Medicina e Chirurgia",
    "Giurisprudenza", 
    "Ingegneria",
    "Architettura",
    "Economia e Commercio",
    "Lettere e Filosofia",
    "Scienze Politiche",
    "Scienze Matematiche, Fisiche e Naturali",
    "Farmacia",
    "Medicina Veterinaria",
    "Scienze Agrarie",
    "Scienze dell'Educazione",
    "Psicologia",
    "Sociologia",
    "Scienze della Comunicazione",
    "Lingue e Letterature Straniere",
    "Conservazione dei Beni Culturali",
    "Scienze Motorie"
  ],

  "Diploma universitario": [
    "Servizi Sociali",
    "Fisioterapia",
    "Infermieristica",
    "Ostetricia",
    "Logopedia",
    "Ortottica",
    "Dietistica",
    "Igiene Dentale",
    "Tecnico Sanitario di Laboratorio",
    "Tecnico Sanitario di Radiologia",
    "Prevenzione nell'Ambiente e nei Luoghi di Lavoro",
    "Gestione Aziendale",
    "Informatica",
    "Turismo",
    "Servizi Giuridici",
    "Disegno Industriale",
    "Costruzioni Edili"
  ],

  "Altro": [
    "Accademia di Belle Arti",
    "Conservatorio di Musica",
    "ISEF (Istituto Superiore di Educazione Fisica)",
    "Scuola Superiore per Mediatori Linguistici",
    "Istituto Superiore per le Industrie Artistiche (ISIA)",
    "Corso di Laurea Magistrale a Orientamento Professionale",
    "Master di I Livello",
    "Master di II Livello",
    "Dottorato di Ricerca",
    "Specializzazione Post-Laurea",
    "Corso di Perfezionamento",
    "Corso di Alta Formazione"
  ]
};

// Funzione helper per ottenere i corsi per un tipo specifico
export const getCoursesByType = (type: string): string[] => {
  return coursesByType[type] || [];
};

// Funzione per cercare corsi
export const searchCourses = (type: string, searchTerm: string): string[] => {
  const courses = getCoursesByType(type);
  if (!searchTerm) return courses;
  
  return courses.filter(course => 
    course.toLowerCase().includes(searchTerm.toLowerCase())
  );
};