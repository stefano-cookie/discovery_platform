// Lista delle università italiane
export const ITALIAN_UNIVERSITIES = [
  // Università Statali
  "Università degli Studi di Bologna",
  "Università degli Studi di Padova",
  "Università degli Studi di Napoli Federico II",
  "Università degli Studi di Torino",
  "Università degli Studi di Milano",
  "Università degli Studi di Roma La Sapienza",
  "Università degli Studi di Firenze",
  "Università degli Studi di Pisa",
  "Università degli Studi di Genova",
  "Università degli Studi di Palermo",
  "Università degli Studi di Catania",
  "Università degli Studi di Bari Aldo Moro",
  "Università degli Studi di Messina",
  "Università degli Studi di Parma",
  "Università degli Studi di Modena e Reggio Emilia",
  "Università degli Studi di Trieste",
  "Università degli Studi di Cagliari",
  "Università degli Studi di Sassari",
  "Università degli Studi di Perugia",
  "Università degli Studi di Verona",
  "Università degli Studi di Brescia",
  "Università degli Studi di Salerno",
  "Università degli Studi di Lecce",
  "Università degli Studi della Calabria",
  "Università degli Studi di Trento",
  "Università degli Studi di Udine",
  "Università degli Studi di Venezia Ca' Foscari",
  "Università IUAV di Venezia",
  "Università degli Studi di Bergamo",
  "Università degli Studi dell'Insubria",
  "Università degli Studi del Piemonte Orientale",
  "Università degli Studi di Roma Tor Vergata",
  "Università degli Studi di Roma Tre",
  "Università degli Studi della Tuscia",
  "Università degli Studi di Cassino e del Lazio Meridionale",
  "Università degli Studi dell'Aquila",
  "Università degli Studi di Chieti-Pescara",
  "Università degli Studi del Molise",
  "Università degli Studi di Foggia",
  "Università degli Studi della Basilicata",
  "Università degli Studi Magna Græcia di Catanzaro",
  "Università degli Studi Mediterranea di Reggio Calabria",
  "Università degli Studi di Ferrara",
  "Università degli Studi di Urbino Carlo Bo",
  "Università Politecnica delle Marche",
  "Università degli Studi di Macerata",
  "Università degli Studi di Camerino",
  "Università degli Studi del Sannio",
  "Università degli Studi di Salerno",
  "Università degli Studi Suor Orsola Benincasa",
  "Università degli Studi Parthenope",
  "Università degli Studi di Enna Kore",
  
  // Università Tecniche/Politecnici
  "Politecnico di Milano",
  "Politecnico di Torino",
  "Politecnico di Bari",
  
  // Università Private
  "Università Bocconi",
  "Università Cattolica del Sacro Cuore",
  "Università Commerciale Luigi Bocconi",
  "LUISS Guido Carli",
  "Università Vita-Salute San Raffaele",
  "Università degli Studi Internazionali di Roma",
  "Libera Università di Lingue e Comunicazione IULM",
  "Università Europea di Roma",
  "Università Campus Bio-Medico di Roma",
  "Università degli Studi Niccolò Cusano",
  "Università degli Studi Link Campus University",
  "Università degli Studi Guglielmo Marconi",
  "Università Telematica Uninettuno",
  "Università Telematica San Raffaele Roma",
  "Università Telematica Pegaso",
  "Università Telematica Giustino Fortunato",
  "Università Telematica eCampus",
  "Università Telematica Unitelma Sapienza",
  "Università Telematica IUL",
  "Università Telematica Universitas Mercatorum",
  "Università Telematica Leonardo da Vinci",
  
  // Università Straniere Riconosciute
  "Libera Università di Bolzano",
  "IMT Scuola Alti Studi Lucca",
  "Scuola Normale Superiore di Pisa",
  "Scuola Superiore Sant'Anna",
  "Scuola Internazionale Superiore di Studi Avanzati",
  "Gran Sasso Science Institute",
  
  // Accademie e Conservatori
  "Accademia di Belle Arti di Brera",
  "Accademia di Belle Arti di Venezia",
  "Accademia di Belle Arti di Roma",
  "Accademia di Belle Arti di Firenze",
  "Accademia di Belle Arti di Napoli",
  "Conservatorio di Musica Giuseppe Verdi di Milano",
  "Conservatorio di Musica Santa Cecilia di Roma",
  "Conservatorio di Musica San Pietro a Majella di Napoli",
  "Conservatorio di Musica Luigi Cherubini di Firenze",
  "Conservatorio di Musica Niccolò Paganini di Genova",
  
  // Istituti Specializzati
  "Istituto Superiore per le Industrie Artistiche di Roma",
  "Istituto Superiore per le Industrie Artistiche di Firenze",
  "Istituto Superiore per le Industrie Artistiche di Urbino",
  "Istituto Superiore per le Industrie Artistiche di Faenza",
  "Scuola Superiore per Mediatori Linguistici",
  "Istituto Superiore di Educazione Fisica"
];

// Funzione per ottenere le opzioni per la select
export const getUniversityOptions = () => {
  return ITALIAN_UNIVERSITIES.map(university => ({
    value: university,
    label: university
  }));
};

// Funzione per cercare università
export const searchUniversities = (searchTerm: string) => {
  if (!searchTerm) return ITALIAN_UNIVERSITIES;
  
  return ITALIAN_UNIVERSITIES.filter(university =>
    university.toLowerCase().includes(searchTerm.toLowerCase())
  );
};