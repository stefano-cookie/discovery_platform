// Service for geographic data via API

export interface Country {
  code: string;
  name: string;
}

export interface Province {
  code: string;
  name: string;
}

export interface City {
  name: string;
  province: string;
  belfioreCode: string;
}

// Liste paesi principali con codici catastali corretti
const COUNTRIES: Country[] = [
  { code: 'Z404', name: 'FRANCESE' },
  { code: 'Z112', name: 'TEDESCA' },
  { code: 'Z131', name: 'SPAGNOLA' },
  { code: 'Z114', name: 'BRITANNICA' },
  { code: 'Z602', name: 'STATUNITENSE' },
  { code: 'Z401', name: 'CANADESE' },
  { code: 'Z402', name: 'BRASILIANA' },
  { code: 'Z400', name: 'ARGENTINA' },
  { code: 'Z700', name: 'AUSTRALIANA' },
  { code: 'Z222', name: 'GIAPPONESE' },
  { code: 'Z210', name: 'CINESE' },
  { code: 'Z230', name: 'INDIANA' },
  { code: 'Z135', name: 'RUSSA' },
  { code: 'Z149', name: 'UCRAINA' },
  { code: 'Z127', name: 'POLACCA' },
  { code: 'Z129', name: 'RUMENA' },
  { code: 'Z103', name: 'BULGARA' },
  { code: 'Z149', name: 'CROATA' },
  { code: 'Z130', name: 'SLOVENA' },
  { code: 'Z115', name: 'UNGHERESE' },
  { code: 'Z109', name: 'CECA' },
  { code: 'Z148', name: 'SLOVACCA' },
  { code: 'Z101', name: 'AUSTRIACA' },
  { code: 'Z343', name: 'SENEGALESE'},
  { code: 'Z133', name: 'SVIZZERA' },
  { code: 'Z102', name: 'BELGA' },
  { code: 'Z123', name: 'OLANDESE' },
  { code: 'Z107', name: 'DANESE' },
  { code: 'Z132', name: 'SVEDESE' },
  { code: 'Z124', name: 'NORVEGESE' },
  { code: 'Z111', name: 'FINLANDESE' },
  { code: 'Z128', name: 'PORTOGHESE' },
  { code: 'Z113', name: 'GRECA' },
  { code: 'Z134', name: 'TURCA' },
  { code: 'Z301', name: 'EGIZIANA' },
  { code: 'Z330', name: 'MAROCCHINA' },
  { code: 'Z336', name: 'TUNISINA' },
  { code: 'Z300', name: 'ALGERINA' },
  { code: 'Z388', name: 'SUDAFRICANA' },
  { code: 'Z325', name: 'LIBICA' },
  { code: 'Z326', name: 'SOMALA' },
  { code: 'Z327', name: 'ETIOPE' },
  { code: 'Z328', name: 'KENIOTA' },
  { code: 'Z329', name: 'NIGERIANA' },
  { code: 'Z106', name: 'IRLANDESE' },
  { code: 'Z108', name: 'ISLANDESE' },
  { code: 'Z505', name: 'MESSICANA' },
  { code: 'Z506', name: 'VENEZUELANA' },
  { code: 'Z507', name: 'COLOMBIANA' },
  { code: 'Z508', name: 'PERUVIANA' },
  { code: 'Z509', name: 'ECUADORIANA' },
  { code: 'Z510', name: 'BOLIVIANA' },
  { code: 'Z511', name: 'CILENA' },
  { code: 'Z512', name: 'URUGUAIANA' },
  { code: 'Z513', name: 'PARAGUAIANA' }
];

// Province italiane
const PROVINCES: Province[] = [
  { code: 'AG', name: 'AGRIGENTO' },
  { code: 'AL', name: 'ALESSANDRIA' },
  { code: 'AN', name: 'ANCONA' },
  { code: 'AO', name: 'AOSTA' },
  { code: 'AQ', name: 'L\'AQUILA' },
  { code: 'AR', name: 'AREZZO' },
  { code: 'AP', name: 'ASCOLI PICENO' },
  { code: 'AT', name: 'ASTI' },
  { code: 'AV', name: 'AVELLINO' },
  { code: 'BA', name: 'BARI' },
  { code: 'BT', name: 'BARLETTA-ANDRIA-TRANI' },
  { code: 'BL', name: 'BELLUNO' },
  { code: 'BN', name: 'BENEVENTO' },
  { code: 'BG', name: 'BERGAMO' },
  { code: 'BI', name: 'BIELLA' },
  { code: 'BO', name: 'BOLOGNA' },
  { code: 'BZ', name: 'BOLZANO' },
  { code: 'BS', name: 'BRESCIA' },
  { code: 'BR', name: 'BRINDISI' },
  { code: 'CA', name: 'CAGLIARI' },
  { code: 'CL', name: 'CALTANISSETTA' },
  { code: 'CB', name: 'CAMPOBASSO' },
  { code: 'CI', name: 'CARBONIA-IGLESIAS' },
  { code: 'CE', name: 'CASERTA' },
  { code: 'CT', name: 'CATANIA' },
  { code: 'CZ', name: 'CATANZARO' },
  { code: 'CH', name: 'CHIETI' },
  { code: 'CO', name: 'COMO' },
  { code: 'CS', name: 'COSENZA' },
  { code: 'CR', name: 'CREMONA' },
  { code: 'KR', name: 'CROTONE' },
  { code: 'CN', name: 'CUNEO' },
  { code: 'EN', name: 'ENNA' },
  { code: 'FM', name: 'FERMO' },
  { code: 'FE', name: 'FERRARA' },
  { code: 'FI', name: 'FIRENZE' },
  { code: 'FG', name: 'FOGGIA' },
  { code: 'FC', name: 'FORLI\'-CESENA' },
  { code: 'FR', name: 'FROSINONE' },
  { code: 'GE', name: 'GENOVA' },
  { code: 'GO', name: 'GORIZIA' },
  { code: 'GR', name: 'GROSSETO' },
  { code: 'IM', name: 'IMPERIA' },
  { code: 'IS', name: 'ISERNIA' },
  { code: 'SP', name: 'LA SPEZIA' },
  { code: 'LT', name: 'LATINA' },
  { code: 'LE', name: 'LECCE' },
  { code: 'LC', name: 'LECCO' },
  { code: 'LI', name: 'LIVORNO' },
  { code: 'LO', name: 'LODI' },
  { code: 'LU', name: 'LUCCA' },
  { code: 'MC', name: 'MACERATA' },
  { code: 'MN', name: 'MANTOVA' },
  { code: 'MS', name: 'MASSA-CARRARA' },
  { code: 'MT', name: 'MATERA' },
  { code: 'ME', name: 'MESSINA' },
  { code: 'MI', name: 'MILANO' },
  { code: 'MO', name: 'MODENA' },
  { code: 'MB', name: 'MONZA E BRIANZA' },
  { code: 'NA', name: 'NAPOLI' },
  { code: 'NO', name: 'NOVARA' },
  { code: 'NU', name: 'NUORO' },
  { code: 'OG', name: 'OGLIASTRA' },
  { code: 'OT', name: 'OLBIA-TEMPIO' },
  { code: 'OR', name: 'ORISTANO' },
  { code: 'PD', name: 'PADOVA' },
  { code: 'PA', name: 'PALERMO' },
  { code: 'PR', name: 'PARMA' },
  { code: 'PV', name: 'PAVIA' },
  { code: 'PG', name: 'PERUGIA' },
  { code: 'PU', name: 'PESARO E URBINO' },
  { code: 'PE', name: 'PESCARA' },
  { code: 'PC', name: 'PIACENZA' },
  { code: 'PI', name: 'PISA' },
  { code: 'PT', name: 'PISTOIA' },
  { code: 'PN', name: 'PORDENONE' },
  { code: 'PZ', name: 'POTENZA' },
  { code: 'PO', name: 'PRATO' },
  { code: 'RG', name: 'RAGUSA' },
  { code: 'RA', name: 'RAVENNA' },
  { code: 'RC', name: 'REGGIO CALABRIA' },
  { code: 'RE', name: 'REGGIO EMILIA' },
  { code: 'RI', name: 'RIETI' },
  { code: 'RN', name: 'RIMINI' },
  { code: 'RM', name: 'ROMA' },
  { code: 'RO', name: 'ROVIGO' },
  { code: 'SA', name: 'SALERNO' },
  { code: 'VS', name: 'MEDIO CAMPIDANO' },
  { code: 'SS', name: 'SASSARI' },
  { code: 'SV', name: 'SAVONA' },
  { code: 'SI', name: 'SIENA' },
  { code: 'SR', name: 'SIRACUSA' },
  { code: 'SO', name: 'SONDRIO' },
  { code: 'TA', name: 'TARANTO' },
  { code: 'TE', name: 'TERAMO' },
  { code: 'TR', name: 'TERNI' },
  { code: 'TO', name: 'TORINO' },
  { code: 'TP', name: 'TRAPANI' },
  { code: 'TN', name: 'TRENTO' },
  { code: 'TV', name: 'TREVISO' },
  { code: 'TS', name: 'TRIESTE' },
  { code: 'UD', name: 'UDINE' },
  { code: 'VA', name: 'VARESE' },
  { code: 'VE', name: 'VENEZIA' },
  { code: 'VB', name: 'VERBANO-CUSIO-OSSOLA' },
  { code: 'VC', name: 'VERCELLI' },
  { code: 'VR', name: 'VERONA' },
  { code: 'VV', name: 'VIBO VALENTIA' },
  { code: 'VI', name: 'VICENZA' },
  { code: 'VT', name: 'VITERBO' }
];

// Comuni italiani con codici Belfiore corretti
const ITALIAN_CITIES: City[] = [
  // REGGIO CALABRIA
  { name: 'REGGIO CALABRIA', province: 'RC', belfioreCode: 'H224' },
  { name: 'VILLA SAN GIOVANNI', province: 'RC', belfioreCode: 'M016' },
  { name: 'SCILLA', province: 'RC', belfioreCode: 'I537' },
  { name: 'PALMI', province: 'RC', belfioreCode: 'G283' },
  { name: 'GIOIA TAURO', province: 'RC', belfioreCode: 'E038' },
  { name: 'LOCRI', province: 'RC', belfioreCode: 'E645' },
  { name: 'SIDERNO', province: 'RC', belfioreCode: 'I729' },
  { name: 'BOVA', province: 'RC', belfioreCode: 'B068' },
  { name: 'BOVA MARINA', province: 'RC', belfioreCode: 'B069' },
  { name: 'BRANCALEONE', province: 'RC', belfioreCode: 'B101' },
  { name: 'BRUZZANO ZEFFIRIO', province: 'RC', belfioreCode: 'B230' },
  { name: 'CONDOFURI', province: 'RC', belfioreCode: 'C962' },
  { name: 'MELITO DI PORTO SALVO', province: 'RC', belfioreCode: 'F117' },
  { name: 'MONTEBELLO JONICO', province: 'RC', belfioreCode: 'F439' },
  { name: 'MOTTA SAN GIOVANNI', province: 'RC', belfioreCode: 'F777' },
  { name: 'PALIZZI', province: 'RC', belfioreCode: 'G284' },
  { name: 'ROCCAFORTE DEL GRECO', province: 'RC', belfioreCode: 'H402' },
  { name: 'ROGHUDI', province: 'RC', belfioreCode: 'H492' },
  { name: 'SAN LORENZO', province: 'RC', belfioreCode: 'H958' },
  { name: 'SANT\'AGATA DEL BIANCO', province: 'RC', belfioreCode: 'I201' },
  { name: 'STAITI', province: 'RC', belfioreCode: 'I932' },
  { name: 'ROSARNO', province: 'RC', belfioreCode: 'H559' },
  { name: 'TAURIANOVA', province: 'RC', belfioreCode: 'L063' },
  { name: 'POLISTENA', province: 'RC', belfioreCode: 'G791' },
  { name: 'CITTANOVA', province: 'RC', belfioreCode: 'C750' },
  { name: 'OPPIDO MAMERTINA', province: 'RC', belfioreCode: 'G082' },
  { name: 'DELIANUOVA', province: 'RC', belfioreCode: 'D268' },
  { name: 'CINQUEFRONDI', province: 'RC', belfioreCode: 'C710' },
  { name: 'MAMMOLA', province: 'RC', belfioreCode: 'E864' },
  { name: 'GIOIOSA IONICA', province: 'RC', belfioreCode: 'E037' },
  { name: 'MARINA DI GIOIOSA IONICA', province: 'RC', belfioreCode: 'E948' },
  { name: 'AFRICO', province: 'RC', belfioreCode: 'A062' },
  
  // ROMA
  { name: 'ROMA', province: 'RM', belfioreCode: 'H501' },
  { name: 'GUIDONIA MONTECELIO', province: 'RM', belfioreCode: 'E263' },
  { name: 'FIUMICINO', province: 'RM', belfioreCode: 'M297' },
  { name: 'ANZIO', province: 'RM', belfioreCode: 'A323' },
  { name: 'CIVITAVECCHIA', province: 'RM', belfioreCode: 'C773' },
  { name: 'TIVOLI', province: 'RM', belfioreCode: 'L182' },
  { name: 'VELLETRI', province: 'RM', belfioreCode: 'L719' },
  { name: 'FRASCATI', province: 'RM', belfioreCode: 'D773' },
  { name: 'POMEZIA', province: 'RM', belfioreCode: 'G812' },
  { name: 'ALBANO LAZIALE', province: 'RM', belfioreCode: 'A132' },
  
  // MILANO
  { name: 'MILANO', province: 'MI', belfioreCode: 'F205' },
  { name: 'SESTO SAN GIOVANNI', province: 'MI', belfioreCode: 'I673' },
  { name: 'CINISELLO BALSAMO', province: 'MI', belfioreCode: 'C707' },
  { name: 'SAN GIULIANO MILANESE', province: 'MI', belfioreCode: 'H930' },
  { name: 'ROZZANO', province: 'MI', belfioreCode: 'H623' },
  { name: 'COLOGNO MONZESE', province: 'MI', belfioreCode: 'C896' },
  { name: 'PIOLTELLO', province: 'MI', belfioreCode: 'G692' },
  { name: 'SEGRATE', province: 'MI', belfioreCode: 'I573' },
  { name: 'OPERA', province: 'MI', belfioreCode: 'G078' },
  { name: 'BUCCINASCO', province: 'MI', belfioreCode: 'B239' },
  
  // NAPOLI
  { name: 'NAPOLI', province: 'NA', belfioreCode: 'F839' },
  { name: 'GIUGLIANO IN CAMPANIA', province: 'NA', belfioreCode: 'E054' },
  { name: 'TORRE DEL GRECO', province: 'NA', belfioreCode: 'L259' },
  { name: 'POZZUOLI', province: 'NA', belfioreCode: 'G972' },
  { name: 'CASORIA', province: 'NA', belfioreCode: 'B990' },
  { name: 'MARANO DI NAPOLI', province: 'NA', belfioreCode: 'E904' },
  { name: 'AFRAGOLA', province: 'NA', belfioreCode: 'A064' },
  { name: 'CASALNUOVO DI NAPOLI', province: 'NA', belfioreCode: 'B905' },
  { name: 'ACERRA', province: 'NA', belfioreCode: 'A024' },
  { name: 'PORTICI', province: 'NA', belfioreCode: 'G906' },
  { name: 'ERCOLANO', province: 'NA', belfioreCode: 'D422' },
  { name: 'CASTELLAMMARE DI STABIA', province: 'NA', belfioreCode: 'C129' },
  { name: 'TORRE ANNUNZIATA', province: 'NA', belfioreCode: 'L245' },
  { name: 'GRAGNANO', province: 'NA', belfioreCode: 'E131' },
  { name: 'SANT\'ANTONIO ABATE', province: 'NA', belfioreCode: 'I282' },
  { name: 'POMPEI', province: 'NA', belfioreCode: 'G813' },
  { name: 'VICO EQUENSE', province: 'NA', belfioreCode: 'L845' },
  { name: 'SORRENTO', province: 'NA', belfioreCode: 'I862' },
  { name: 'PIANO DI SORRENTO', province: 'NA', belfioreCode: 'G580' },
  { name: 'META', province: 'NA', belfioreCode: 'F162' },
  
  // TORINO
  { name: 'TORINO', province: 'TO', belfioreCode: 'L219' },
  { name: 'MONCALIERI', province: 'TO', belfioreCode: 'F335' },
  { name: 'COLLEGNO', province: 'TO', belfioreCode: 'C845' },
  { name: 'RIVOLI', province: 'TO', belfioreCode: 'H355' },
  { name: 'NICHELINO', province: 'TO', belfioreCode: 'F889' },
  { name: 'SETTIMO TORINESE', province: 'TO', belfioreCode: 'I694' },
  { name: 'VENARIA REALE', province: 'TO', belfioreCode: 'L725' },
  { name: 'GRUGLIASCO', province: 'TO', belfioreCode: 'E216' },
  { name: 'CHIERI', province: 'TO', belfioreCode: 'C628' },
  { name: 'IVREA', province: 'TO', belfioreCode: 'E379' },
  
  // PALERMO
  { name: 'PALERMO', province: 'PA', belfioreCode: 'G273' },
  { name: 'BAGHERIA', province: 'PA', belfioreCode: 'A546' },
  { name: 'CARINI', province: 'PA', belfioreCode: 'B780' },
  { name: 'MONREALE', province: 'PA', belfioreCode: 'F377' },
  { name: 'PARTINICO', province: 'PA', belfioreCode: 'G355' },
  { name: 'TERMINI IMERESE', province: 'PA', belfioreCode: 'L113' },
  { name: 'MISILMERI', province: 'PA', belfioreCode: 'F244' },
  { name: 'ALTAVILLA MILICIA', province: 'PA', belfioreCode: 'A227' },
  { name: 'CORLEONE', province: 'PA', belfioreCode: 'D006' },
  { name: 'CEFALÙ', province: 'PA', belfioreCode: 'C421' },
  { name: 'CAPACI', province: 'PA', belfioreCode: 'B648' },
  { name: 'FICARAZZI', province: 'PA', belfioreCode: 'D559' },
  { name: 'VILLABATE', province: 'PA', belfioreCode: 'L926' },
  { name: 'LERCARA FRIDDI', province: 'PA', belfioreCode: 'E542' },
  { name: 'CASTELDACCIA', province: 'PA', belfioreCode: 'C074' },
  { name: 'CASTELBUONO', province: 'PA', belfioreCode: 'C067' },
  { name: 'GANGI', province: 'PA', belfioreCode: 'D908' },
  { name: 'CACCAMO', province: 'PA', belfioreCode: 'B314' },
  { name: 'POLIZZI GENEROSA', province: 'PA', belfioreCode: 'G790' },
  { name: 'PETRALIA SOTTANA', province: 'PA', belfioreCode: 'G513' },
  
  // MESSINA
  { name: 'MESSINA', province: 'ME', belfioreCode: 'F158' },
  { name: 'BARCELLONA POZZO DI GOTTO', province: 'ME', belfioreCode: 'A647' },
  { name: 'MILAZZO', province: 'ME', belfioreCode: 'F206' },
  { name: 'PATTI', province: 'ME', belfioreCode: 'G378' },
  { name: 'TAORMINA', province: 'ME', belfioreCode: 'L042' },
  { name: 'LIPARI', province: 'ME', belfioreCode: 'E606' },
  { name: 'SANT\'AGATA DI MILITELLO', province: 'ME', belfioreCode: 'I207' },
  { name: 'CAPO D\'ORLANDO', province: 'ME', belfioreCode: 'B656' },
  { name: 'ROMETTA', province: 'ME', belfioreCode: 'H516' },
  { name: 'SPADAFORA', province: 'ME', belfioreCode: 'I877' },
  
  // TRAPANI
  { name: 'TRAPANI', province: 'TP', belfioreCode: 'L331' },
  { name: 'MARSALA', province: 'TP', belfioreCode: 'E974' },
  { name: 'CASTELVETRANO', province: 'TP', belfioreCode: 'C286' },
  { name: 'ALCAMO', province: 'TP', belfioreCode: 'A176' },
  { name: 'MAZARA DEL VALLO', province: 'TP', belfioreCode: 'F061' },
  { name: 'ERICE', province: 'TP', belfioreCode: 'D423' },
  { name: 'PARTANNA', province: 'TP', belfioreCode: 'G356' },
  { name: 'SALEMI', province: 'TP', belfioreCode: 'H708' },
  { name: 'PANTELLERIA', province: 'TP', belfioreCode: 'G315' },
  { name: 'FAVIGNANA', province: 'TP', belfioreCode: 'D518' },
  
  // GENOVA
  { name: 'GENOVA', province: 'GE', belfioreCode: 'D969' },
  { name: 'RAPALLO', province: 'GE', belfioreCode: 'H183' },
  { name: 'CHIAVARI', province: 'GE', belfioreCode: 'C623' },
  { name: 'SESTRI LEVANTE', province: 'GE', belfioreCode: 'I692' },
  { name: 'CAMOGLI', province: 'GE', belfioreCode: 'B500' },
  { name: 'SANTA MARGHERITA LIGURE', province: 'GE', belfioreCode: 'I255' },
  { name: 'PORTOFINO', province: 'GE', belfioreCode: 'G913' },
  { name: 'LAVAGNA', province: 'GE', belfioreCode: 'E482' },
  { name: 'RECCO', province: 'GE', belfioreCode: 'H212' },
  { name: 'COGOLETO', province: 'GE', belfioreCode: 'C823' },
  
  // BOLOGNA
  { name: 'BOLOGNA', province: 'BO', belfioreCode: 'A944' },
  { name: 'IMOLA', province: 'BO', belfioreCode: 'E289' },
  { name: 'CASALECCHIO DI RENO', province: 'BO', belfioreCode: 'B880' },
  { name: 'FAENZA', province: 'BO', belfioreCode: 'D458' },
  { name: 'SAN LAZZARO DI SAVENA', province: 'BO', belfioreCode: 'H945' },
  { name: 'ANZOLA DELL\'EMILIA', province: 'BO', belfioreCode: 'A324' },
  { name: 'GRANAROLO DELL\'EMILIA', province: 'BO', belfioreCode: 'E133' },
  { name: 'PIANORO', province: 'BO', belfioreCode: 'G579' },
  { name: 'ZOLA PREDOSA', province: 'BO', belfioreCode: 'M184' },
  { name: 'BUDRIO', province: 'BO', belfioreCode: 'B249' },
  
  // FIRENZE
  { name: 'FIRENZE', province: 'FI', belfioreCode: 'D612' },
  { name: 'EMPOLI', province: 'FI', belfioreCode: 'D403' },
  { name: 'SESTO FIORENTINO', province: 'FI', belfioreCode: 'I676' },
  { name: 'SCANDICCI', province: 'FI', belfioreCode: 'I496' },
  { name: 'BAGNO A RIPOLI', province: 'FI', belfioreCode: 'A547' },
  { name: 'CAMPI BISENZIO', province: 'FI', belfioreCode: 'B507' },
  { name: 'SIGNA', province: 'FI', belfioreCode: 'I736' },
  { name: 'LASTRA A SIGNA', province: 'FI', belfioreCode: 'E467' },
  { name: 'CALENZANO', province: 'FI', belfioreCode: 'B405' },
  { name: 'PONTASSIEVE', province: 'FI', belfioreCode: 'G844' },
  { name: 'FIGLINE E INCISA VALDARNO', province: 'FI', belfioreCode: 'D565' },
  { name: 'BORGO SAN LORENZO', province: 'FI', belfioreCode: 'B019' },
  { name: 'IMPRUNETA', province: 'FI', belfioreCode: 'E289' },
  { name: 'GREVE IN CHIANTI', province: 'FI', belfioreCode: 'E167' },
  { name: 'MONTELUPO FIORENTINO', province: 'FI', belfioreCode: 'F552' },
  { name: 'CAPRAIA E LIMITE', province: 'FI', belfioreCode: 'B703' },
  { name: 'CERTALDO', province: 'FI', belfioreCode: 'C541' },
  { name: 'CASTELFIORENTINO', province: 'FI', belfioreCode: 'C101' },
  { name: 'MONTESPERTOLI', province: 'FI', belfioreCode: 'F656' },
  { name: 'FUCECCHIO', province: 'FI', belfioreCode: 'D815' },
  
  // PRATO
  { name: 'PRATO', province: 'PO', belfioreCode: 'G999' },
  { name: 'MONTEMURLO', province: 'PO', belfioreCode: 'F566' },
  { name: 'POGGIO A CAIANO', province: 'PO', belfioreCode: 'G751' },
  { name: 'CARMIGNANO', province: 'PO', belfioreCode: 'B794' },
  { name: 'CANTAGALLO', province: 'PO', belfioreCode: 'B634' },
  { name: 'VAIANO', province: 'PO', belfioreCode: 'L537' },
  { name: 'VERNIO', province: 'PO', belfioreCode: 'L769' },
  
  // BARI
  { name: 'BARI', province: 'BA', belfioreCode: 'A662' },
  { name: 'ALTAMURA', province: 'BA', belfioreCode: 'A225' },
  { name: 'MOLFETTA', province: 'BA', belfioreCode: 'F280' },
  { name: 'BITONTO', province: 'BA', belfioreCode: 'A893' },
  { name: 'GRAVINA IN PUGLIA', province: 'BA', belfioreCode: 'E155' },
  { name: 'MODUGNO', province: 'BA', belfioreCode: 'F259' },
  { name: 'TRIGGIANO', province: 'BA', belfioreCode: 'L425' },
  { name: 'TERLIZZI', province: 'BA', belfioreCode: 'L115' },
  { name: 'CORATO', province: 'BA', belfioreCode: 'C983' },
  { name: 'RUVO DI PUGLIA', province: 'BA', belfioreCode: 'H643' },
  
  // CATANIA
  { name: 'CATANIA', province: 'CT', belfioreCode: 'C351' },
  { name: 'ACIREALE', province: 'CT', belfioreCode: 'A028' },
  { name: 'MISTERBIANCO', province: 'CT', belfioreCode: 'F250' },
  { name: 'PATERNÒ', province: 'CT', belfioreCode: 'G372' },
  { name: 'ADRANO', province: 'CT', belfioreCode: 'A056' },
  { name: 'BELPASSO', province: 'CT', belfioreCode: 'A767' },
  { name: 'GIARRE', province: 'CT', belfioreCode: 'E017' },
  { name: 'MASCALUCIA', province: 'CT', belfioreCode: 'F004' },
  { name: 'GRAVINA DI CATANIA', province: 'CT', belfioreCode: 'E154' },
  { name: 'SCORDIA', province: 'CT', belfioreCode: 'I549' },
  
  // VENEZIA
  { name: 'VENEZIA', province: 'VE', belfioreCode: 'L736' },
  { name: 'MESTRE', province: 'VE', belfioreCode: 'L736' },
  { name: 'MARGHERA', province: 'VE', belfioreCode: 'L736' },
  { name: 'CHIOGGIA', province: 'VE', belfioreCode: 'C638' },
  { name: 'SPINEA', province: 'VE', belfioreCode: 'I908' },
  { name: 'MIRANO', province: 'VE', belfioreCode: 'F241' },
  { name: 'DOLO', province: 'VE', belfioreCode: 'D325' },
  { name: 'JESOLO', province: 'VE', belfioreCode: 'C388' },
  { name: 'SAN DONÀ DI PIAVE', province: 'VE', belfioreCode: 'H823' },
  { name: 'PORTOGRUARO', province: 'VE', belfioreCode: 'G914' },
  
  // VERONA
  { name: 'VERONA', province: 'VR', belfioreCode: 'L781' },
  { name: 'VILLAFRANCA DI VERONA', province: 'VR', belfioreCode: 'L949' },
  { name: 'LEGNAGO', province: 'VR', belfioreCode: 'E516' },
  { name: 'BUSSOLENGO', province: 'VR', belfioreCode: 'B300' },
  { name: 'SANT\'AMBROGIO DI VALPOLICELLA', province: 'VR', belfioreCode: 'I258' },
  { name: 'BARDOLINO', province: 'VR', belfioreCode: 'A650' },
  { name: 'LAZISE', province: 'VR', belfioreCode: 'E502' },
  { name: 'PESCHIERA DEL GARDA', province: 'VR', belfioreCode: 'G489' },
  { name: 'MALCESINE', province: 'VR', belfioreCode: 'E848' },
  { name: 'GARDA', province: 'VR', belfioreCode: 'D915' },
  
  // COSENZA
  { name: 'COSENZA', province: 'CS', belfioreCode: 'D086' },
  { name: 'RENDE', province: 'CS', belfioreCode: 'H235' },
  { name: 'CASTROVILLARI', province: 'CS', belfioreCode: 'C349' },
  { name: 'ROSSANO', province: 'CS', belfioreCode: 'H574' },
  { name: 'PAOLA', province: 'CS', belfioreCode: 'G317' },
  { name: 'ACRI', province: 'CS', belfioreCode: 'A042' },
  { name: 'MONTALTO UFFUGO', province: 'CS', belfioreCode: 'F538' },
  { name: 'CASSANO ALL\'IONIO', province: 'CS', belfioreCode: 'C002' },
  { name: 'CORIGLIANO CALABRO', province: 'CS', belfioreCode: 'D004' },
  { name: 'LAMEZIA TERME', province: 'CS', belfioreCode: 'M208' },
  
  // CATANZARO
  { name: 'CATANZARO', province: 'CZ', belfioreCode: 'C352' },
  { name: 'LAMEZIA TERME', province: 'CZ', belfioreCode: 'M208' },
  { name: 'SOVERATO', province: 'CZ', belfioreCode: 'I872' },
  { name: 'SELLIA MARINA', province: 'CZ', belfioreCode: 'I587' },
  { name: 'CHIARAVALLE CENTRALE', province: 'CZ', belfioreCode: 'C615' },
  { name: 'GIRIFALCO', province: 'CZ', belfioreCode: 'E048' },
  { name: 'BORGIA', province: 'CZ', belfioreCode: 'B003' },
  { name: 'SQUILLACE', province: 'CZ', belfioreCode: 'I930' },
  { name: 'DAVOLI', province: 'CZ', belfioreCode: 'D256' },
  { name: 'BOTRICELLO', province: 'CZ', belfioreCode: 'B086' },
  
  // CROTONE
  { name: 'CROTONE', province: 'KR', belfioreCode: 'D122' },
  { name: 'CIRÒ MARINA', province: 'KR', belfioreCode: 'C725' },
  { name: 'ISOLA DI CAPO RIZZUTO', province: 'KR', belfioreCode: 'E347' },
  { name: 'CUTRO', province: 'KR', belfioreCode: 'D234' },
  { name: 'PETILIA POLICASTRO', province: 'KR', belfioreCode: 'G509' },
  { name: 'STRONGOLI', province: 'KR', belfioreCode: 'I981' },
  { name: 'ROCCABERNARDA', province: 'KR', belfioreCode: 'H382' },
  { name: 'MELISSA', province: 'KR', belfioreCode: 'F118' },
  { name: 'UMBRIATICO', province: 'KR', belfioreCode: 'L490' },
  { name: 'CRUCOLI', province: 'KR', belfioreCode: 'D189' },
  
  // VIBO VALENTIA
  { name: 'VIBO VALENTIA', province: 'VV', belfioreCode: 'L833' },
  { name: 'TROPEA', province: 'VV', belfioreCode: 'L452' },
  { name: 'PIZZO', province: 'VV', belfioreCode: 'G722' },
  { name: 'SERRA SAN BRUNO', province: 'VV', belfioreCode: 'I648' },
  { name: 'MILETO', province: 'VV', belfioreCode: 'F210' },
  { name: 'SORIANO CALABRO', province: 'VV', belfioreCode: 'I855' },
  { name: 'NICOTERA', province: 'VV', belfioreCode: 'F892' },
  { name: 'RICADI', province: 'VV', belfioreCode: 'H272' },
  { name: 'JOPPOLO', province: 'VV', belfioreCode: 'E389' },
  { name: 'BRIATICO', province: 'VV', belfioreCode: 'B162' },
  
  // PADOVA
  { name: 'PADOVA', province: 'PD', belfioreCode: 'G224' },
  { name: 'CITTADELLA', province: 'PD', belfioreCode: 'C747' },
  { name: 'ESTE', province: 'PD', belfioreCode: 'D442' },
  { name: 'MONTAGNANA', province: 'PD', belfioreCode: 'F392' },
  { name: 'MONSELICE', province: 'PD', belfioreCode: 'F382' },
  { name: 'ABANO TERME', province: 'PD', belfioreCode: 'A001' },
  { name: 'ALBIGNASEGO', province: 'PD', belfioreCode: 'A159' },
  { name: 'VIGONZA', province: 'PD', belfioreCode: 'L892' },
  { name: 'CADONEGHE', province: 'PD', belfioreCode: 'B341' },
  { name: 'SELVAZZANO DENTRO', province: 'PD', belfioreCode: 'I590' },
  
  // PESCARA
  { name: 'PESCARA', province: 'PE', belfioreCode: 'G491' },
  { name: 'CHIETI', province: 'PE', belfioreCode: 'C632' },
  { name: 'MONTESILVANO', province: 'PE', belfioreCode: 'F611' },
  { name: 'SPOLTORE', province: 'PE', belfioreCode: 'I925' },
  
  // TREVISO
  { name: 'TREVISO', province: 'TV', belfioreCode: 'L407' },
  { name: 'CONEGLIANO', province: 'TV', belfioreCode: 'C965' },
  { name: 'CASTELFRANCO VENETO', province: 'TV', belfioreCode: 'C111' },
  { name: 'VITTORIO VENETO', province: 'TV', belfioreCode: 'M089' },
  { name: 'MONTEBELLUNA', province: 'TV', belfioreCode: 'F446' },
  { name: 'ODERZO', province: 'TV', belfioreCode: 'G013' },
  { name: 'PREGANZIOL', province: 'TV', belfioreCode: 'H018' },
  { name: 'PAESE', province: 'TV', belfioreCode: 'G259' },
  { name: 'SPRESIANO', province: 'TV', belfioreCode: 'I921' },
  { name: 'PIEVE DI SOLIGO', province: 'TV', belfioreCode: 'G644' },
  { name: 'MOGLIANO VENETO', province: 'TV', belfioreCode: 'F269' },
  { name: 'ZERO BRANCO', province: 'TV', belfioreCode: 'M172' },
  { name: 'VILLORBA', province: 'TV', belfioreCode: 'M056' },
  { name: 'CARBONERA', province: 'TV', belfioreCode: 'B744' },
  { name: 'SILEA', province: 'TV', belfioreCode: 'I737' },
  { name: 'RONCADE', province: 'TV', belfioreCode: 'H526' },
  { name: 'SUSEGANA', province: 'TV', belfioreCode: 'L014' },
  { name: 'SAN BIAGIO DI CALLALTA', province: 'TV', belfioreCode: 'H781' },
  { name: 'NERVESA DELLA BATTAGLIA', province: 'TV', belfioreCode: 'F875' },
  { name: 'ISTRANA', province: 'TV', belfioreCode: 'E376' },
  
  // VICENZA
  { name: 'VICENZA', province: 'VI', belfioreCode: 'L840' },
  { name: 'BASSANO DEL GRAPPA', province: 'VI', belfioreCode: 'A703' },
  { name: 'SCHIO', province: 'VI', belfioreCode: 'I531' },
  { name: 'THIENE', province: 'VI', belfioreCode: 'L157' },
  { name: 'ARZIGNANO', province: 'VI', belfioreCode: 'A453' },
  { name: 'VALDAGNO', province: 'VI', belfioreCode: 'L551' },
  { name: 'MAROSTICA', province: 'VI', belfioreCode: 'E966' },
  { name: 'ASIAGO', province: 'VI', belfioreCode: 'A465' },
  { name: 'SANDRIGO', province: 'VI', belfioreCode: 'H492' },
  { name: 'TORRI DI QUARTESOLO', province: 'VI', belfioreCode: 'L304' },
  
  // UDINE
  { name: 'UDINE', province: 'UD', belfioreCode: 'L483' },
  { name: 'CODROIPO', province: 'UD', belfioreCode: 'C814' },
  { name: 'PALMANOVA', province: 'UD', belfioreCode: 'G288' },
  { name: 'CIVIDALE DEL FRIULI', province: 'UD', belfioreCode: 'C758' },
  { name: 'GEMONA DEL FRIULI', province: 'UD', belfioreCode: 'D961' },
  { name: 'TOLMEZZO', province: 'UD', belfioreCode: 'L192' },
  { name: 'TARVISIO', province: 'UD', belfioreCode: 'L061' },
  { name: 'LIGNANO SABBIADORO', province: 'UD', belfioreCode: 'E591' },
  { name: 'CERVIGNANO DEL FRIULI', province: 'UD', belfioreCode: 'C556' },
  { name: 'LATISANA', province: 'UD', belfioreCode: 'E471' },
  
  // TRIESTE
  { name: 'TRIESTE', province: 'TS', belfioreCode: 'L424' },
  { name: 'MUGGIA', province: 'TS', belfioreCode: 'F795' },
  { name: 'DUINO-AURISINA', province: 'TS', belfioreCode: 'D383' },
  { name: 'MONRUPINO', province: 'TS', belfioreCode: 'F383' },
  { name: 'SAN DORLIGO DELLA VALLE', province: 'TS', belfioreCode: 'H820' },
  { name: 'SGONICO', province: 'TS', belfioreCode: 'I715' },
  
  // GORIZIA
  { name: 'GORIZIA', province: 'GO', belfioreCode: 'E098' },
  { name: 'MONFALCONE', province: 'GO', belfioreCode: 'F341' },
  { name: 'GRADISCA D\'ISONZO', province: 'GO', belfioreCode: 'E121' },
  { name: 'CORMONS', province: 'GO', belfioreCode: 'D013' },
  { name: 'ROMANS D\'ISONZO', province: 'GO', belfioreCode: 'H507' },
  { name: 'GRADO', province: 'GO', belfioreCode: 'E123' },
  { name: 'STARANZANO', province: 'GO', belfioreCode: 'I937' },
  { name: 'RONCHI DEI LEGIONARI', province: 'GO', belfioreCode: 'H533' },
  
  // PORDENONE
  { name: 'PORDENONE', province: 'PN', belfioreCode: 'G888' },
  { name: 'SACILE', province: 'PN', belfioreCode: 'H657' },
  { name: 'SPILIMBERGO', province: 'PN', belfioreCode: 'I904' },
  { name: 'MANIAGO', province: 'PN', belfioreCode: 'E889' },
  { name: 'AVIANO', province: 'PN', belfioreCode: 'A515' },
  { name: 'CORDENONS', province: 'PN', belfioreCode: 'C992' },
  { name: 'FONTANAFREDDA', province: 'PN', belfioreCode: 'D673' },
  { name: 'AZZANO DECIMO', province: 'PN', belfioreCode: 'A529' },
  { name: 'BRUGNERA', province: 'PN', belfioreCode: 'B217' },
  { name: 'CANEVA', province: 'PN', belfioreCode: 'B593' },
  
  // TRENTO
  { name: 'TRENTO', province: 'TN', belfioreCode: 'L378' },
  { name: 'ROVERETO', province: 'TN', belfioreCode: 'H612' },
  { name: 'PERGINE VALSUGANA', province: 'TN', belfioreCode: 'G452' },
  { name: 'ARCO', province: 'TN', belfioreCode: 'A372' },
  { name: 'RIVA DEL GARDA', province: 'TN', belfioreCode: 'H330' },
  { name: 'LAVIS', province: 'TN', belfioreCode: 'E500' },
  { name: 'MEZZOLOMBARDO', province: 'TN', belfioreCode: 'F176' },
  { name: 'CLES', province: 'TN', belfioreCode: 'C794' },
  { name: 'CAVALESE', province: 'TN', belfioreCode: 'C372' },
  { name: 'BORGO VALSUGANA', province: 'TN', belfioreCode: 'B019' },
  
  // BOLZANO
  { name: 'BOLZANO', province: 'BZ', belfioreCode: 'A952' },
  { name: 'MERANO', province: 'BZ', belfioreCode: 'F133' },
  { name: 'BRESSANONE', province: 'BZ', belfioreCode: 'B162' },
  { name: 'BRUNICO', province: 'BZ', belfioreCode: 'B220' },
  { name: 'LAIVES', province: 'BZ', belfioreCode: 'E429' },
  { name: 'APPIANO SULLA STRADA DEL VINO', province: 'BZ', belfioreCode: 'A333' },
  { name: 'CALDARO SULLA STRADA DEL VINO', province: 'BZ', belfioreCode: 'B406' },
  { name: 'EGNA', province: 'BZ', belfioreCode: 'D391' },
  { name: 'CHIUSA', province: 'BZ', belfioreCode: 'C653' },
  { name: 'VIPITENO', province: 'BZ', belfioreCode: 'M067' },
  
  // AOSTA
  { name: 'AOSTA', province: 'AO', belfioreCode: 'A326' },
  { name: 'COURMAYEUR', province: 'AO', belfioreCode: 'D012' },
  { name: 'SAINT-VINCENT', province: 'AO', belfioreCode: 'H949' },
  { name: 'CHATILLON', province: 'AO', belfioreCode: 'C595' },
  { name: 'VERRÈS', province: 'AO', belfioreCode: 'L786' },
  { name: 'MORGEX', province: 'AO', belfioreCode: 'F728' },
  { name: 'PONT-SAINT-MARTIN', province: 'AO', belfioreCode: 'G852' },
  { name: 'SAINT-PIERRE', province: 'AO', belfioreCode: 'H951' },
  { name: 'BREUIL-CERVINIA', province: 'AO', belfioreCode: 'L750' },
  { name: 'CHAMPORCHER', province: 'AO', belfioreCode: 'C580' },
  
  // COMO
  { name: 'COMO', province: 'CO', belfioreCode: 'C933' },
  { name: 'CANTÙ', province: 'CO', belfioreCode: 'B635' },
  { name: 'ERBA', province: 'CO', belfioreCode: 'D415' },
  { name: 'MARIANO COMENSE', province: 'CO', belfioreCode: 'E949' },
  { name: 'OLGIATE COMASCO', province: 'CO', belfioreCode: 'G045' },
  { name: 'CERMENATE', province: 'CO', belfioreCode: 'C518' },
  { name: 'LOMAZZO', province: 'CO', belfioreCode: 'E665' },
  { name: 'MENAGGIO', province: 'CO', belfioreCode: 'F127' },
  { name: 'BELLAGIO', province: 'CO', belfioreCode: 'A744' },
  { name: 'TREMEZZINA', province: 'CO', belfioreCode: 'M141' },
  
  // LECCO
  { name: 'LECCO', province: 'LC', belfioreCode: 'E507' },
  { name: 'MERATE', province: 'LC', belfioreCode: 'F138' },
  { name: 'CALOLZIOCORTE', province: 'LC', belfioreCode: 'B433' },
  { name: 'MANDELLO DEL LARIO', province: 'LC', belfioreCode: 'E874' },
  { name: 'OGGIONO', province: 'LC', belfioreCode: 'G018' },
  { name: 'VALMADRERA', province: 'LC', belfioreCode: 'L632' },
  { name: 'CASATENOVO', province: 'LC', belfioreCode: 'B943' },
  { name: 'COLICO', province: 'LC', belfioreCode: 'C835' },
  { name: 'VARENNA', province: 'LC', belfioreCode: 'L680' },
  { name: 'BELLANO', province: 'LC', belfioreCode: 'A745' },
  
  // SALERNO
  { name: 'SALERNO', province: 'SA', belfioreCode: 'H703' },
  { name: 'BATTIPAGLIA', province: 'SA', belfioreCode: 'A717' },
  { name: 'SCAFATI', province: 'SA', belfioreCode: 'I483' },
  { name: 'CAVA DE\' TIRRENI', province: 'SA', belfioreCode: 'C361' },
  { name: 'NOCERA INFERIORE', province: 'SA', belfioreCode: 'F914' },
  { name: 'SARNO', province: 'SA', belfioreCode: 'I441' },
  { name: 'ANGRI', province: 'SA', belfioreCode: 'A294' },
  { name: 'PAGANI', province: 'SA', belfioreCode: 'G230' },
  { name: 'MERCATO SAN SEVERINO', province: 'SA', belfioreCode: 'F141' },
  { name: 'EBOLI', province: 'SA', belfioreCode: 'D390' },
  
  // AVELLINO
  { name: 'AVELLINO', province: 'AV', belfioreCode: 'A509' },
  { name: 'ARIANO IRPINO', province: 'AV', belfioreCode: 'A399' },
  { name: 'ATRIPALDA', province: 'AV', belfioreCode: 'A490' },
  { name: 'SOLOFRA', province: 'AV', belfioreCode: 'I805' },
  { name: 'MONTORO', province: 'AV', belfioreCode: 'F656' },
  { name: 'GROTTAMINARDA', province: 'AV', belfioreCode: 'E206' },
  { name: 'CERVINARA', province: 'AV', belfioreCode: 'C559' },
  { name: 'BAIANO', province: 'AV', belfioreCode: 'A577' },
  { name: 'MONTEFORTE IRPINO', province: 'AV', belfioreCode: 'F514' },
  { name: 'MERCOGLIANO', province: 'AV', belfioreCode: 'F142' },
  
  // CASERTA
  { name: 'CASERTA', province: 'CE', belfioreCode: 'B963' },
  { name: 'AVERSA', province: 'CE', belfioreCode: 'A512' },
  { name: 'MARCIANISE', province: 'CE', belfioreCode: 'E928' },
  { name: 'MADDALONI', province: 'CE', belfioreCode: 'E783' },
  { name: 'SANTA MARIA CAPUA VETERE', province: 'CE', belfioreCode: 'I234' },
  { name: 'CASAL DI PRINCIPE', province: 'CE', belfioreCode: 'B923' },
  { name: 'ORTA DI ATELLA', province: 'CE', belfioreCode: 'G128' },
  { name: 'CAPUA', province: 'CE', belfioreCode: 'B715' },
  { name: 'CASAGIOVE', province: 'CE', belfioreCode: 'B923' },
  { name: 'MONDRAGONE', province: 'CE', belfioreCode: 'F354' },
  
  // BENEVENTO
  { name: 'BENEVENTO', province: 'BN', belfioreCode: 'A783' },
  { name: 'MONTESARCHIO', province: 'BN', belfioreCode: 'F629' },
  { name: 'SANT\'AGATA DE\' GOTI', province: 'BN', belfioreCode: 'I202' },
  { name: 'TELESE TERME', province: 'BN', belfioreCode: 'L086' },
  { name: 'AIROLA', province: 'BN', belfioreCode: 'A109' },
  { name: 'APOLLOSA', province: 'BN', belfioreCode: 'A334' },
  { name: 'ARPAISE', province: 'BN', belfioreCode: 'A431' },
  { name: 'CEPPALONI', province: 'BN', belfioreCode: 'C478' },
  { name: 'FORCHIA', province: 'BN', belfioreCode: 'D695' },
  { name: 'SOLOPACA', province: 'BN', belfioreCode: 'I806' },
  
  // FOGGIA
  { name: 'FOGGIA', province: 'FG', belfioreCode: 'D643' },
  { name: 'CERIGNOLA', province: 'FG', belfioreCode: 'C514' },
  { name: 'MANFREDONIA', province: 'FG', belfioreCode: 'E885' },
  { name: 'SAN SEVERO', province: 'FG', belfioreCode: 'I158' },
  { name: 'LUCERA', province: 'FG', belfioreCode: 'E716' },
  { name: 'VIESTE', province: 'FG', belfioreCode: 'L858' },
  { name: 'MONTE SANT\'ANGELO', province: 'FG', belfioreCode: 'F631' },
  { name: 'BOVINO', province: 'FG', belfioreCode: 'B100' },
  { name: 'ASCOLI SATRIANO', province: 'FG', belfioreCode: 'A463' },
  { name: 'TORREMAGGIORE', province: 'FG', belfioreCode: 'L271' },
  { name: 'STORNARELLA', province: 'FG', belfioreCode: 'I964' },
  { name: 'ORTA NOVA', province: 'FG', belfioreCode: 'G135' },
  { name: 'STORNARA', province: 'FG', belfioreCode: 'I963' },
  { name: 'CANDELA', province: 'FG', belfioreCode: 'B582' },
  { name: 'DELICETO', province: 'FG', belfioreCode: 'D267' },
  { name: 'MATTINATA', province: 'FG', belfioreCode: 'F059' },
  { name: 'PESCHICI', province: 'FG', belfioreCode: 'G492' },
  { name: 'RODI GARGANICO', province: 'FG', belfioreCode: 'H472' },
  { name: 'VICO DEL GARGANO', province: 'FG', belfioreCode: 'L844' },
  
  // BARLETTA-ANDRIA-TRANI
  { name: 'BARLETTA', province: 'BT', belfioreCode: 'A669' },
  { name: 'ANDRIA', province: 'BT', belfioreCode: 'A285' },
  { name: 'TRANI', province: 'BT', belfioreCode: 'L328' },
  { name: 'BISCEGLIE', province: 'BT', belfioreCode: 'A887' },
  { name: 'CANOSA DI PUGLIA', province: 'BT', belfioreCode: 'B619' },
  { name: 'MARGHERITA DI SAVOIA', province: 'BT', belfioreCode: 'E942' },
  { name: 'MINERVINO MURGE', province: 'BT', belfioreCode: 'F221' },
  { name: 'SAN FERDINANDO DI PUGLIA', province: 'BT', belfioreCode: 'H844' },
  { name: 'SPINAZZOLA', province: 'BT', belfioreCode: 'I906' },
  { name: 'TRINITAPOLI', province: 'BT', belfioreCode: 'L431' },
  
  // LECCE
  { name: 'LECCE', province: 'LE', belfioreCode: 'E506' },
  { name: 'GALLIPOLI', province: 'LE', belfioreCode: 'D883' },
  { name: 'NARDÒ', province: 'LE', belfioreCode: 'F842' },
  { name: 'COPERTINO', province: 'LE', belfioreCode: 'C978' },
  { name: 'CASARANO', province: 'LE', belfioreCode: 'B936' },
  { name: 'GALATINA', province: 'LE', belfioreCode: 'D862' },
  { name: 'MAGLIE', province: 'LE', belfioreCode: 'E815' },
  { name: 'OTRANTO', province: 'LE', belfioreCode: 'G188' },
  { name: 'SQUINZANO', province: 'LE', belfioreCode: 'I930' },
  { name: 'TAURISANO', province: 'LE', belfioreCode: 'L062' },
  
  // BRINDISI
  { name: 'BRINDISI', province: 'BR', belfioreCode: 'B180' },
  { name: 'FRANCAVILLA FONTANA', province: 'BR', belfioreCode: 'D761' },
  { name: 'FASANO', province: 'BR', belfioreCode: 'D480' },
  { name: 'OSTUNI', province: 'BR', belfioreCode: 'G187' },
  { name: 'MESAGNE', province: 'BR', belfioreCode: 'F152' },
  { name: 'SAN VITO DEI NORMANNI', province: 'BR', belfioreCode: 'I396' },
  { name: 'CEGLIE MESSAPICA', province: 'BR', belfioreCode: 'C424' },
  { name: 'LATIANO', province: 'BR', belfioreCode: 'E471' },
  { name: 'TORRE SANTA SUSANNA', province: 'BR', belfioreCode: 'L279' },
  { name: 'ORIA', province: 'BR', belfioreCode: 'G105' },
  
  // BERGAMO
  { name: 'BERGAMO', province: 'BG', belfioreCode: 'A794' },
  { name: 'TREVIGLIO', province: 'BG', belfioreCode: 'L400' },
  { name: 'SERIATE', province: 'BG', belfioreCode: 'I625' },
  { name: 'DALMINE', province: 'BG', belfioreCode: 'D246' },
  { name: 'ROMANO DI LOMBARDIA', province: 'BG', belfioreCode: 'H511' },
  { name: 'ALBINO', province: 'BG', belfioreCode: 'A161' },
  { name: 'NEMBRO', province: 'BG', belfioreCode: 'F863' },
  { name: 'ALZANO LOMBARDO', province: 'BG', belfioreCode: 'A246' },
  { name: 'CARAVAGGIO', province: 'BG', belfioreCode: 'B729' },
  { name: 'CLUSONE', province: 'BG', belfioreCode: 'C802' },
  
  // BRESCIA
  { name: 'BRESCIA', province: 'BS', belfioreCode: 'B157' },
  { name: 'DESENZANO DEL GARDA', province: 'BS', belfioreCode: 'D284' },
  { name: 'MONTICHIARI', province: 'BS', belfioreCode: 'F566' },
  { name: 'CHIARI', province: 'BS', belfioreCode: 'C618' },
  { name: 'LUMEZZANE', province: 'BS', belfioreCode: 'E735' },
  { name: 'GARDONE VAL TROMPIA', province: 'BS', belfioreCode: 'D925' },
  { name: 'CONCESIO', province: 'BS', belfioreCode: 'C951' },
  { name: 'REZZATO', province: 'BS', belfioreCode: 'H256' },
  { name: 'GHEDI', province: 'BS', belfioreCode: 'D999' },
  { name: 'PALAZZOLO SULL\'OGLIO', province: 'BS', belfioreCode: 'G267' },
  
  // MANTOVA
  { name: 'MANTOVA', province: 'MN', belfioreCode: 'E897' },
  { name: 'CASTIGLIONE DELLE STIVIERE', province: 'MN', belfioreCode: 'C302' },
  { name: 'PORTO MANTOVANO', province: 'MN', belfioreCode: 'G924' },
  { name: 'CURTATONE', province: 'MN', belfioreCode: 'D225' },
  { name: 'GOITO', province: 'MN', belfioreCode: 'E080' },
  { name: 'SUZZARA', province: 'MN', belfioreCode: 'L017' },
  { name: 'VIADANA', province: 'MN', belfioreCode: 'L825' },
  { name: 'ASOLA', province: 'MN', belfioreCode: 'A474' },
  { name: 'GONZAGA', province: 'MN', belfioreCode: 'E087' },
  { name: 'SERMIDE E FELONICA', province: 'MN', belfioreCode: 'I637' },
  
  // CREMONA
  { name: 'CREMONA', province: 'CR', belfioreCode: 'D150' },
  { name: 'CREMA', province: 'CR', belfioreCode: 'D142' },
  { name: 'CASALMAGGIORE', province: 'CR', belfioreCode: 'B898' },
  { name: 'SORESINA', province: 'CR', belfioreCode: 'I851' },
  { name: 'CASTELLEONE', province: 'CR', belfioreCode: 'C157' },
  { name: 'PIZZIGHETTONE', province: 'CR', belfioreCode: 'G721' },
  { name: 'RIVOLTA D\'ADDA', province: 'CR', belfioreCode: 'H370' },
  { name: 'PANDINO', province: 'CR', belfioreCode: 'G305' },
  { name: 'SPINO D\'ADDA', province: 'CR', belfioreCode: 'I907' },
  { name: 'OFFANENGO', province: 'CR', belfioreCode: 'G016' },
  
  // VARESE
  { name: 'VARESE', province: 'VA', belfioreCode: 'L682' },
  { name: 'BUSTO ARSIZIO', province: 'VA', belfioreCode: 'B300' },
  { name: 'GALLARATE', province: 'VA', belfioreCode: 'D869' },
  { name: 'SARONNO', province: 'VA', belfioreCode: 'I433' },
  { name: 'LEGNANO', province: 'VA', belfioreCode: 'E517' },
  { name: 'CASTELLANZA', province: 'VA', belfioreCode: 'C167' },
  { name: 'TRADATE', province: 'VA', belfioreCode: 'L317' },
  { name: 'SOMMA LOMBARDO', province: 'VA', belfioreCode: 'I820' },
  { name: 'CASSANO MAGNAGO', province: 'VA', belfioreCode: 'C007' },
  { name: 'LUINO', province: 'VA', belfioreCode: 'E734' },
  
  // CAGLIARI
  { name: 'CAGLIARI', province: 'CA', belfioreCode: 'B354' },
  { name: 'QUARTU SANT\'ELENA', province: 'CA', belfioreCode: 'H118' },
  { name: 'ASSEMINI', province: 'CA', belfioreCode: 'A475' },
  { name: 'CAPOTERRA', province: 'CA', belfioreCode: 'B674' },
  { name: 'SELARGIUS', province: 'CA', belfioreCode: 'I580' },
  { name: 'MONSERRATO', province: 'CA', belfioreCode: 'F380' },
  { name: 'QUARTUCCIU', province: 'CA', belfioreCode: 'H119' },
  { name: 'ELMAS', province: 'CA', belfioreCode: 'D402' },
  { name: 'SESTU', province: 'CA', belfioreCode: 'I695' },
  { name: 'DECIMOMANNU', province: 'CA', belfioreCode: 'D261' },
  { name: 'SINNAI', province: 'CA', belfioreCode: 'I754' },
  { name: 'MARACALAGONIS', province: 'CA', belfioreCode: 'E905' },
  { name: 'PULA', province: 'CA', belfioreCode: 'H088' },
  { name: 'SARROCH', province: 'CA', belfioreCode: 'I447' },
  { name: 'VILLA SAN PIETRO', province: 'CA', belfioreCode: 'L998' },
  
  // SASSARI
  { name: 'SASSARI', province: 'SS', belfioreCode: 'I452' },
  { name: 'PORTO TORRES', province: 'SS', belfioreCode: 'G924' },
  { name: 'ALGHERO', province: 'SS', belfioreCode: 'A192' },
  { name: 'OZIERI', province: 'SS', belfioreCode: 'G205' },
  { name: 'SORSO', province: 'SS', belfioreCode: 'I864' },
  { name: 'CASTELSARDO', province: 'SS', belfioreCode: 'C272' },
  { name: 'THIESI', province: 'SS', belfioreCode: 'L155' },
  { name: 'ITTIRI', province: 'SS', belfioreCode: 'E378' },
  { name: 'URI', province: 'SS', belfioreCode: 'L500' },
  { name: 'STINTINO', province: 'SS', belfioreCode: 'I956' },
  { name: 'VALLEDORIA', province: 'SS', belfioreCode: 'L591' },
  { name: 'BADESI', province: 'SS', belfioreCode: 'A539' },
  { name: 'SANTA TERESA GALLURA', province: 'SS', belfioreCode: 'I312' },
  { name: 'TEMPIO PAUSANIA', province: 'SS', belfioreCode: 'L093' },
  { name: 'LA MADDALENA', province: 'SS', belfioreCode: 'E425' },
  
  // NUORO
  { name: 'NUORO', province: 'NU', belfioreCode: 'F979' },
  { name: 'SINISCOLA', province: 'NU', belfioreCode: 'I753' },
  { name: 'MACOMER', province: 'NU', belfioreCode: 'E788' },
  { name: 'DORGALI', province: 'NU', belfioreCode: 'D345' },
  { name: 'OROSEI', province: 'NU', belfioreCode: 'G130' },
  { name: 'ORGOSOLO', province: 'NU', belfioreCode: 'G101' },
  { name: 'BORORE', province: 'NU', belfioreCode: 'B055' },
  { name: 'OLLOLAI', province: 'NU', belfioreCode: 'G050' },
  { name: 'ORANI', province: 'NU', belfioreCode: 'G083' },
  { name: 'OTTANA', province: 'NU', belfioreCode: 'G192' },
  
  // ORISTANO
  { name: 'ORISTANO', province: 'OR', belfioreCode: 'G113' },
  { name: 'CARBONIA', province: 'OR', belfioreCode: 'B745' },
  { name: 'TERRALBA', province: 'OR', belfioreCode: 'L125' },
  { name: 'BOSA', province: 'OR', belfioreCode: 'B068' },
  { name: 'CABRAS', province: 'OR', belfioreCode: 'B313' },
  { name: 'GHILARZA', province: 'OR', belfioreCode: 'E002' },
  { name: 'MARRUBIU', province: 'OR', belfioreCode: 'E973' },
  { name: 'SANT\'ANTONIO DI SANTADI', province: 'OR', belfioreCode: 'I293' },
  { name: 'ALES', province: 'OR', belfioreCode: 'A180' },
  { name: 'FORDONGIANUS', province: 'OR', belfioreCode: 'D687' },
  
  // TARANTO
  { name: 'TARANTO', province: 'TA', belfioreCode: 'L049' },
  { name: 'MARTINA FRANCA', province: 'TA', belfioreCode: 'E986' },
  { name: 'GROTTAGLIE', province: 'TA', belfioreCode: 'E205' },
  { name: 'MANDURIA', province: 'TA', belfioreCode: 'E884' },
  { name: 'MASSAFRA', province: 'TA', belfioreCode: 'F027' },
  { name: 'MOTTOLA', province: 'TA', belfioreCode: 'F785' },
  { name: 'GINOSA', province: 'TA', belfioreCode: 'E041' },
  { name: 'CASTELLANETA', province: 'TA', belfioreCode: 'C136' },
  { name: 'CRISPIANO', province: 'TA', belfioreCode: 'D170' },
  { name: 'PALAGIANO', province: 'TA', belfioreCode: 'G250' },
  
  // MATERA
  { name: 'MATERA', province: 'MT', belfioreCode: 'F052' },
  { name: 'POLICORO', province: 'MT', belfioreCode: 'G788' },
  { name: 'PISTICCI', province: 'MT', belfioreCode: 'G712' },
  { name: 'BERNALDA', province: 'MT', belfioreCode: 'A801' },
  { name: 'MONTALBANO JONICO', province: 'MT', belfioreCode: 'F391' },
  { name: 'NOVA SIRI', province: 'MT', belfioreCode: 'F960' },
  { name: 'TURSI', province: 'MT', belfioreCode: 'L472' },
  { name: 'ROTONDELLA', province: 'MT', belfioreCode: 'H592' },
  { name: 'SCANZANO JONICO', province: 'MT', belfioreCode: 'I502' },
  { name: 'VALSINNI', province: 'MT', belfioreCode: 'L650' },
  
  // POTENZA
  { name: 'POTENZA', province: 'PZ', belfioreCode: 'G942' },
  { name: 'MELFI', province: 'PZ', belfioreCode: 'F104' },
  { name: 'LAVELLO', province: 'PZ', belfioreCode: 'E488' },
  { name: 'RIONERO IN VULTURE', province: 'PZ', belfioreCode: 'H326' },
  { name: 'VENOSA', province: 'PZ', belfioreCode: 'L738' },
  { name: 'LAURIA', province: 'PZ', belfioreCode: 'E478' },
  { name: 'SANT\'ARCANGELO', province: 'PZ', belfioreCode: 'I284' },
  { name: 'SENISE', province: 'PZ', belfioreCode: 'I602' },
  { name: 'RAPOLLA', province: 'PZ', belfioreCode: 'H184' },
  { name: 'GENZANO DI LUCANIA', province: 'PZ', belfioreCode: 'D971' },
  
  // AGRIGENTO
  { name: 'AGRIGENTO', province: 'AG', belfioreCode: 'A089' },
  { name: 'CANICATTÌ', province: 'AG', belfioreCode: 'B612' },
  { name: 'LICATA', province: 'AG', belfioreCode: 'E573' },
  { name: 'SCIACCA', province: 'AG', belfioreCode: 'I533' },
  { name: 'FAVARA', province: 'AG', belfioreCode: 'D518' },
  { name: 'RIBERA', province: 'AG', belfioreCode: 'H267' },
  { name: 'MENFI', province: 'AG', belfioreCode: 'F127' },
  { name: 'PORTO EMPEDOCLE', province: 'AG', belfioreCode: 'G902' },
  { name: 'CAMPOBELLO DI LICATA', province: 'AG', belfioreCode: 'B522' },
  { name: 'ARAGONA', province: 'AG', belfioreCode: 'A355' },
  
  // CALTANISSETTA
  { name: 'CALTANISSETTA', province: 'CL', belfioreCode: 'B429' },
  { name: 'GELA', province: 'CL', belfioreCode: 'D960' },
  { name: 'NISCEMI', province: 'CL', belfioreCode: 'F899' },
  { name: 'MUSSOMELI', province: 'CL', belfioreCode: 'F828' },
  { name: 'SAN CATALDO', province: 'CL', belfioreCode: 'H792' },
  { name: 'SERRADIFALCO', province: 'CL', belfioreCode: 'I636' },
  { name: 'SOMMATINO', province: 'CL', belfioreCode: 'I821' },
  { name: 'RIESI', province: 'CL', belfioreCode: 'H285' },
  { name: 'DELIA', province: 'CL', belfioreCode: 'D268' },
  { name: 'MARIANOPOLI', province: 'CL', belfioreCode: 'E951' },
  
  // ENNA
  { name: 'ENNA', province: 'EN', belfioreCode: 'C342' },
  { name: 'PIAZZA ARMERINA', province: 'EN', belfioreCode: 'G580' },
  { name: 'LEONFORTE', province: 'EN', belfioreCode: 'E537' },
  { name: 'BARRAFRANCA', province: 'EN', belfioreCode: 'A680' },
  { name: 'PIETRAPERZIA', province: 'EN', belfioreCode: 'G622' },
  { name: 'NICOSIA', province: 'EN', belfioreCode: 'F892' },
  { name: 'TROINA', province: 'EN', belfioreCode: 'L447' },
  { name: 'REGALBUTO', province: 'EN', belfioreCode: 'H220' },
  { name: 'CENTURIPE', province: 'EN', belfioreCode: 'C476' },
  { name: 'AIDONE', province: 'EN', belfioreCode: 'A102' },
  
  // MESSINA
  { name: 'MESSINA', province: 'ME', belfioreCode: 'F158' },
  { name: 'MILAZZO', province: 'ME', belfioreCode: 'F208' },
  { name: 'BARCELLONA POZZO DI GOTTO', province: 'ME', belfioreCode: 'A647' },
  { name: 'PATTI', province: 'ME', belfioreCode: 'G384' },
  { name: 'CAPO D\'ORLANDO', province: 'ME', belfioreCode: 'B696' },
  { name: 'TAORMINA', province: 'ME', belfioreCode: 'L042' },
  { name: 'SANT\'AGATA DI MILITELLO', province: 'ME', belfioreCode: 'I199' },
  { name: 'LIPARI', province: 'ME', belfioreCode: 'E606' },
  { name: 'GIARDINI NAXOS', province: 'ME', belfioreCode: 'E015' },
  { name: 'BROLO', province: 'ME', belfioreCode: 'B202' },
  
  // RAGUSA
  { name: 'RAGUSA', province: 'RG', belfioreCode: 'H163' },
  { name: 'VITTORIA', province: 'RG', belfioreCode: 'M088' },
  { name: 'MODICA', province: 'RG', belfioreCode: 'F258' },
  { name: 'COMISO', province: 'RG', belfioreCode: 'C927' },
  { name: 'POZZALLO', province: 'RG', belfioreCode: 'G953' },
  { name: 'SCICLI', province: 'RG', belfioreCode: 'I535' },
  { name: 'ISPICA', province: 'RG', belfioreCode: 'E366' },
  { name: 'SANTA CROCE CAMERINA', province: 'RG', belfioreCode: 'I178' },
  { name: 'ACATE', province: 'RG', belfioreCode: 'A014' },
  { name: 'CHIARAMONTE GULFI', province: 'RG', belfioreCode: 'C612' },
  
  // SIRACUSA
  { name: 'SIRACUSA', province: 'SR', belfioreCode: 'I754' },
  { name: 'AUGUSTA', province: 'SR', belfioreCode: 'A494' },
  { name: 'AVOLA', province: 'SR', belfioreCode: 'A522' },
  { name: 'NOTO', province: 'SR', belfioreCode: 'F943' },
  { name: 'LENTINI', province: 'SR', belfioreCode: 'E533' },
  { name: 'ROSOLINI', province: 'SR', belfioreCode: 'H574' },
  { name: 'PACHINO', province: 'SR', belfioreCode: 'G211' },
  { name: 'FLORIDIA', province: 'SR', belfioreCode: 'D636' },
  { name: 'SOLARINO', province: 'SR', belfioreCode: 'I789' },
  { name: 'PORTOPALO DI CAPO PASSERO', province: 'SR', belfioreCode: 'G920' },
  
  // TRAPANI
  { name: 'TRAPANI', province: 'TP', belfioreCode: 'L331' },
  { name: 'MARSALA', province: 'TP', belfioreCode: 'E974' },
  { name: 'MAZARA DEL VALLO', province: 'TP', belfioreCode: 'F061' },
  { name: 'ALCAMO', province: 'TP', belfioreCode: 'A176' },
  { name: 'CASTELVETRANO', province: 'TP', belfioreCode: 'C286' },
  { name: 'ERICE', province: 'TP', belfioreCode: 'D423' },
  { name: 'PANTELLERIA', province: 'TP', belfioreCode: 'G315' },
  { name: 'SALEMI', province: 'TP', belfioreCode: 'H706' },
  { name: 'PETROSINO', province: 'TP', belfioreCode: 'G514' },
  { name: 'CAMPOBELLO DI MAZARA', province: 'TP', belfioreCode: 'B521' },
  
  // COMO
  { name: 'COMO', province: 'CO', belfioreCode: 'C933' },
  { name: 'ERBA', province: 'CO', belfioreCode: 'D415' },
  { name: 'CANTÙ', province: 'CO', belfioreCode: 'B639' },
  { name: 'MARIANO COMENSE', province: 'CO', belfioreCode: 'E949' },
  { name: 'CERMENATE', province: 'CO', belfioreCode: 'C521' },
  { name: 'LOMAZZO', province: 'CO', belfioreCode: 'E665' },
  { name: 'OLGIATE COMASCO', province: 'CO', belfioreCode: 'G031' },
  { name: 'MENAGGIO', province: 'CO', belfioreCode: 'F124' },
  { name: 'BELLAGIO', province: 'CO', belfioreCode: 'A747' },
  { name: 'LECCO', province: 'CO', belfioreCode: 'E507' },
  
  // SONDRIO
  { name: 'SONDRIO', province: 'SO', belfioreCode: 'I829' },
  { name: 'TIRANO', province: 'SO', belfioreCode: 'L175' },
  { name: 'MORBEGNO', province: 'SO', belfioreCode: 'F712' },
  { name: 'CHIAVENNA', province: 'SO', belfioreCode: 'C623' },
  { name: 'BORMIO', province: 'SO', belfioreCode: 'B048' },
  { name: 'LIVIGNO', province: 'SO', belfioreCode: 'E624' },
  { name: 'PONTE IN VALTELLINA', province: 'SO', belfioreCode: 'G848' },
  { name: 'TALAMONA', province: 'SO', belfioreCode: 'L035' },
  { name: 'BERBENNO DI VALTELLINA', province: 'SO', belfioreCode: 'A786' },
  { name: 'VALDIDENTRO', province: 'SO', belfioreCode: 'L558' },
  
  // PIACENZA
  { name: 'PIACENZA', province: 'PC', belfioreCode: 'G535' },
  { name: 'CASTEL SAN GIOVANNI', province: 'PC', belfioreCode: 'C261' },
  { name: 'FIORENZUOLA D\'ARDA', province: 'PC', belfioreCode: 'D607' },
  { name: 'ROTTOFRENO', province: 'PC', belfioreCode: 'H593' },
  { name: 'BORGONOVO VAL TIDONE', province: 'PC', belfioreCode: 'B024' },
  { name: 'CADEO', province: 'PC', belfioreCode: 'B345' },
  { name: 'PODENZANO', province: 'PC', belfioreCode: 'G742' },
  { name: 'ALSENO', province: 'PC', belfioreCode: 'A232' },
  { name: 'CARPANETO PIACENTINO', province: 'PC', belfioreCode: 'B820' },
  { name: 'BOBBIO', province: 'PC', belfioreCode: 'A909' },
  
  // PARMA
  { name: 'PARMA', province: 'PR', belfioreCode: 'G337' },
  { name: 'FIDENZA', province: 'PR', belfioreCode: 'D571' },
  { name: 'SALSOMAGGIORE TERME', province: 'PR', belfioreCode: 'H720' },
  { name: 'COLLECCHIO', province: 'PR', belfioreCode: 'C851' },
  { name: 'NOCETO', province: 'PR', belfioreCode: 'F913' },
  { name: 'LANGHIRANO', province: 'PR', belfioreCode: 'E442' },
  { name: 'FONTANELLATO', province: 'PR', belfioreCode: 'D670' },
  { name: 'MEDESANO', province: 'PR', belfioreCode: 'F083' },
  { name: 'MONTECHIARUGOLO', province: 'PR', belfioreCode: 'F472' },
  { name: 'FORNOVO DI TARO', province: 'PR', belfioreCode: 'D728' },
  
  // MODENA
  { name: 'MODENA', province: 'MO', belfioreCode: 'F257' },
  { name: 'CARPI', province: 'MO', belfioreCode: 'B819' },
  { name: 'SASSUOLO', province: 'MO', belfioreCode: 'I462' },
  { name: 'FORMIGINE', province: 'MO', belfioreCode: 'D706' },
  { name: 'MIRANDOLA', province: 'MO', belfioreCode: 'F240' },
  { name: 'CASTELFRANCO EMILIA', province: 'MO', belfioreCode: 'C110' },
  { name: 'MARANELLO', province: 'MO', belfioreCode: 'E913' },
  { name: 'VIGNOLA', province: 'MO', belfioreCode: 'L885' },
  { name: 'FIORANO MODENESE', province: 'MO', belfioreCode: 'D604' },
  { name: 'PAVULLO NEL FRIGNANO', province: 'MO', belfioreCode: 'G392' },
  
  // REGGIO EMILIA
  { name: 'REGGIO EMILIA', province: 'RE', belfioreCode: 'H223' },
  { name: 'CORREGGIO', province: 'RE', belfioreCode: 'D037' },
  { name: 'SCANDIANO', province: 'RE', belfioreCode: 'I492' },
  { name: 'GUASTALLA', province: 'RE', belfioreCode: 'E253' },
  { name: 'CASTELNOVO NE\' MONTI', province: 'RE', belfioreCode: 'C218' },
  { name: 'MONTECCHIO EMILIA', province: 'RE', belfioreCode: 'F471' },
  { name: 'CAVRIAGO', province: 'RE', belfioreCode: 'C405' },
  { name: 'RUBIERA', province: 'RE', belfioreCode: 'H628' },
  { name: 'NOVELLARA', province: 'RE', belfioreCode: 'F963' },
  { name: 'LUZZARA', province: 'RE', belfioreCode: 'E772' },
  
  // FERRARA
  { name: 'FERRARA', province: 'FE', belfioreCode: 'D548' },
  { name: 'CENTO', province: 'FE', belfioreCode: 'C469' },
  { name: 'COMACCHIO', province: 'FE', belfioreCode: 'C912' },
  { name: 'ARGENTA', province: 'FE', belfioreCode: 'A393' },
  { name: 'BONDENO', province: 'FE', belfioreCode: 'A959' },
  { name: 'CODIGORO', province: 'FE', belfioreCode: 'C816' },
  { name: 'PORTOMAGGIORE', province: 'FE', belfioreCode: 'G917' },
  { name: 'MESOLA', province: 'FE', belfioreCode: 'F153' },
  { name: 'GORO', province: 'FE', belfioreCode: 'E107' },
  { name: 'VIGARANO MAINARDA', province: 'FE', belfioreCode: 'L872' },
  
  // RAVENNA
  { name: 'RAVENNA', province: 'RA', belfioreCode: 'H199' },
  { name: 'FAENZA', province: 'RA', belfioreCode: 'D458' },
  { name: 'LUGO', province: 'RA', belfioreCode: 'E730' },
  { name: 'CERVIA', province: 'RA', belfioreCode: 'C553' },
  { name: 'BAGNACAVALLO', province: 'RA', belfioreCode: 'A551' },
  { name: 'ALFONSINE', province: 'RA', belfioreCode: 'A191' },
  { name: 'RUSSI', province: 'RA', belfioreCode: 'H642' },
  { name: 'COTIGNOLA', province: 'RA', belfioreCode: 'D122' },
  { name: 'MASSA LOMBARDA', province: 'RA', belfioreCode: 'F025' },
  { name: 'FUSIGNANO', province: 'RA', belfioreCode: 'D831' },
  
  // FORLÌ-CESENA
  { name: 'FORLÌ', province: 'FC', belfioreCode: 'D704' },
  { name: 'CESENA', province: 'FC', belfioreCode: 'C573' },
  { name: 'CESENATICO', province: 'FC', belfioreCode: 'C574' },
  { name: 'SAVIGNANO SUL RUBICONE', province: 'FC', belfioreCode: 'I472' },
  { name: 'FORLIMPOPOLI', province: 'FC', belfioreCode: 'D705' },
  { name: 'MELDOLA', province: 'FC', belfioreCode: 'F105' },
  { name: 'PREDAPPIO', province: 'FC', belfioreCode: 'H016' },
  { name: 'GATTEO', province: 'FC', belfioreCode: 'D933' },
  { name: 'BERTINORO', province: 'FC', belfioreCode: 'A808' },
  { name: 'BAGNO DI ROMAGNA', province: 'FC', belfioreCode: 'A560' },
  
  // RIMINI
  { name: 'RIMINI', province: 'RN', belfioreCode: 'H294' },
  { name: 'RICCIONE', province: 'RN', belfioreCode: 'H274' },
  { name: 'CATTOLICA', province: 'RN', belfioreCode: 'C357' },
  { name: 'BELLARIA-IGEA MARINA', province: 'RN', belfioreCode: 'A747' },
  { name: 'MISANO ADRIATICO', province: 'RN', belfioreCode: 'F244' },
  { name: 'SAN GIOVANNI IN MARIGNANO', province: 'RN', belfioreCode: 'H925' },
  { name: 'SANTARCANGELO DI ROMAGNA', province: 'RN', belfioreCode: 'I304' },
  { name: 'VERUCCHIO', province: 'RN', belfioreCode: 'L802' },
  { name: 'NOVAFELTRIA', province: 'RN', belfioreCode: 'F943' },
  { name: 'PENNABILLI', province: 'RN', belfioreCode: 'G434' },
  
  // ANCONA
  { name: 'ANCONA', province: 'AN', belfioreCode: 'A271' },
  { name: 'SENIGALLIA', province: 'AN', belfioreCode: 'I608' },
  { name: 'JESI', province: 'AN', belfioreCode: 'E388' },
  { name: 'FABRIANO', province: 'AN', belfioreCode: 'D451' },
  { name: 'OSIMO', province: 'AN', belfioreCode: 'G157' },
  { name: 'FALCONARA MARITTIMA', province: 'AN', belfioreCode: 'D476' },
  { name: 'CHIARAVALLE', province: 'AN', belfioreCode: 'C614' },
  { name: 'LORETO', province: 'AN', belfioreCode: 'E690' },
  { name: 'CASTELFIDARDO', province: 'AN', belfioreCode: 'C100' },
  { name: 'CAMERANO', province: 'AN', belfioreCode: 'B468' },
  
  // MACERATA
  { name: 'MACERATA', province: 'MC', belfioreCode: 'E783' },
  { name: 'CIVITANOVA MARCHE', province: 'MC', belfioreCode: 'C770' },
  { name: 'PORTO RECANATI', province: 'MC', belfioreCode: 'G918' },
  { name: 'TOLENTINO', province: 'MC', belfioreCode: 'L191' },
  { name: 'RECANATI', province: 'MC', belfioreCode: 'H211' },
  { name: 'CORRIDONIA', province: 'MC', belfioreCode: 'D041' },
  { name: 'POTENZA PICENA', province: 'MC', belfioreCode: 'G943' },
  { name: 'MONTECASSIANO', province: 'MC', belfioreCode: 'F452' },
  { name: 'POLLENZA', province: 'MC', belfioreCode: 'G797' },
  { name: 'MORROVALLE', province: 'MC', belfioreCode: 'F749' },
  
  // ASCOLI PICENO
  { name: 'ASCOLI PICENO', province: 'AP', belfioreCode: 'A462' },
  { name: 'SAN BENEDETTO DEL TRONTO', province: 'AP', belfioreCode: 'H769' },
  { name: 'GROTTAMMARE', province: 'AP', belfioreCode: 'E209' },
  { name: 'MONTEGIORGIO', province: 'AP', belfioreCode: 'F518' },
  { name: 'FERMO', province: 'AP', belfioreCode: 'D542' },
  { name: 'PORTO SANT\'ELPIDIO', province: 'AP', belfioreCode: 'G919' },
  { name: 'SANT\'ELPIDIO A MARE', province: 'AP', belfioreCode: 'I323' },
  { name: 'AMANDOLA', province: 'AP', belfioreCode: 'A253' },
  { name: 'OFFIDA', province: 'AP', belfioreCode: 'G019' },
  { name: 'RIPATRANSONE', province: 'AP', belfioreCode: 'H330' },
  
  // PERUGIA
  { name: 'PERUGIA', province: 'PG', belfioreCode: 'G478' },
  { name: 'ASSISI', province: 'PG', belfioreCode: 'A475' },
  { name: 'FOLIGNO', province: 'PG', belfioreCode: 'D653' },
  { name: 'CITTÀ DI CASTELLO', province: 'PG', belfioreCode: 'C745' },
  { name: 'SPOLETO', province: 'PG', belfioreCode: 'I921' },
  { name: 'BASTIA UMBRA', province: 'PG', belfioreCode: 'A709' },
  { name: 'GUBBIO', province: 'PG', belfioreCode: 'E256' },
  { name: 'CASTIGLIONE DEL LAGO', province: 'PG', belfioreCode: 'C296' },
  { name: 'MARSCIANO', province: 'PG', belfioreCode: 'E975' },
  { name: 'UMBERTIDE', province: 'PG', belfioreCode: 'L492' },
  
  // TERNI
  { name: 'TERNI', province: 'TR', belfioreCode: 'L117' },
  { name: 'NARNI', province: 'TR', belfioreCode: 'F844' },
  { name: 'AMELIA', province: 'TR', belfioreCode: 'A262' },
  { name: 'ORVIETO', province: 'TR', belfioreCode: 'G148' },
  { name: 'CITTÀ DELLA PIEVE', province: 'TR', belfioreCode: 'C744' },
  { name: 'ACQUASPARTA', province: 'TR', belfioreCode: 'A044' },
  { name: 'ALLERONA', province: 'TR', belfioreCode: 'A213' },
  { name: 'ARRONE', province: 'TR', belfioreCode: 'A442' },
  { name: 'AVIGLIANO UMBRO', province: 'TR', belfioreCode: 'A520' },
  { name: 'BASCHI', province: 'TR', belfioreCode: 'A691' },
  
  // LATINA
  { name: 'LATINA', province: 'LT', belfioreCode: 'E472' },
  { name: 'APRILIA', province: 'LT', belfioreCode: 'A341' },
  { name: 'FONDI', province: 'LT', belfioreCode: 'D662' },
  { name: 'FORMIA', province: 'LT', belfioreCode: 'D707' },
  { name: 'GAETA', province: 'LT', belfioreCode: 'D843' },
  { name: 'TERRACINA', province: 'LT', belfioreCode: 'L120' },
  { name: 'CISTERNA DI LATINA', province: 'LT', belfioreCode: 'C740' },
  { name: 'SEZZE', province: 'LT', belfioreCode: 'I712' },
  { name: 'SABAUDIA', province: 'LT', belfioreCode: 'H645' },
  { name: 'SPERLONGA', province: 'LT', belfioreCode: 'I890' },
  
  // FROSINONE
  { name: 'FROSINONE', province: 'FR', belfioreCode: 'D810' },
  { name: 'CASSINO', province: 'FR', belfioreCode: 'C034' },
  { name: 'SORA', province: 'FR', belfioreCode: 'I838' },
  { name: 'ANAGNI', province: 'FR', belfioreCode: 'A269' },
  { name: 'FERENTINO', province: 'FR', belfioreCode: 'D537' },
  { name: 'ALATRI', province: 'FR', belfioreCode: 'A122' },
  { name: 'CECCANO', province: 'FR', belfioreCode: 'C414' },
  { name: 'PONTECORVO', province: 'FR', belfioreCode: 'G842' },
  { name: 'MONTE SAN GIOVANNI CAMPANO', province: 'FR', belfioreCode: 'F628' },
  { name: 'VEROLI', province: 'FR', belfioreCode: 'L779' },
  
  // RIETI
  { name: 'RIETI', province: 'RI', belfioreCode: 'H282' },
  { name: 'CITTADUCALE', province: 'RI', belfioreCode: 'C750' },
  { name: 'POGGIO BUSTONE', province: 'RI', belfioreCode: 'G758' },
  { name: 'ANTRODOCO', province: 'RI', belfioreCode: 'A315' },
  { name: 'FARA IN SABINA', province: 'RI', belfioreCode: 'D492' },
  { name: 'CANTALICE', province: 'RI', belfioreCode: 'B625' },
  { name: 'ACCUMOLI', province: 'RI', belfioreCode: 'A020' },
  { name: 'AMATRICE', province: 'RI', belfioreCode: 'A258' },
  { name: 'BORBONA', province: 'RI', belfioreCode: 'A982' },
  { name: 'BORGO VELINO', province: 'RI', belfioreCode: 'B028' },
  
  // VITERBO
  { name: 'VITERBO', province: 'VT', belfioreCode: 'M082' },
  { name: 'CIVITA CASTELLANA', province: 'VT', belfioreCode: 'C765' },
  { name: 'MONTEFIASCONE', province: 'VT', belfioreCode: 'F506' },
  { name: 'TARQUINIA', province: 'VT', belfioreCode: 'D024' },
  { name: 'TUSCANIA', province: 'VT', belfioreCode: 'L310' },
  { name: 'VETRALLA', province: 'VT', belfioreCode: 'L814' },
  { name: 'RONCIGLIONE', province: 'VT', belfioreCode: 'H531' },
  { name: 'SUTRI', province: 'VT', belfioreCode: 'L016' },
  { name: 'NEPI', province: 'VT', belfioreCode: 'F868' },
  { name: 'CAPRANICA', province: 'VT', belfioreCode: 'B709' },
  
  // PROVINCIA DI CHIETI
  { name: 'CHIETI', province: 'CH', belfioreCode: 'C632' },
  { name: 'FRANCAVILLA AL MARE', province: 'CH', belfioreCode: 'D763' },
  { name: 'LANCIANO', province: 'CH', belfioreCode: 'E432' },
  { name: 'VASTO', province: 'CH', belfioreCode: 'E372' },
  { name: 'GUARDIAGRELE', province: 'CH', belfioreCode: 'E246' },
  { name: 'ORTONA', province: 'CH', belfioreCode: 'G142' },
  { name: 'ATESSA', province: 'CH', belfioreCode: 'A482' },
  { name: 'CASOLI', province: 'CH', belfioreCode: 'B999' },
  { name: 'BUCCHIANICO', province: 'CH', belfioreCode: 'B934' },
  { name: 'SAN SALVO', province: 'CH', belfioreCode: 'I148' },
  
  // PROVINCIA DI CUNEO
  { name: 'CUNEO', province: 'CN', belfioreCode: 'D205' },
  { name: 'ALBA', province: 'CN', belfioreCode: 'A124' },
  { name: 'BRA', province: 'CN', belfioreCode: 'B076' },
  { name: 'FOSSANO', province: 'CN', belfioreCode: 'D742' },
  { name: 'SALUZZO', province: 'CN', belfioreCode: 'H727' },
  { name: 'MONDOVÌ', province: 'CN', belfioreCode: 'F351' },
  { name: 'SAVIGLIANO', province: 'CN', belfioreCode: 'I471' },
  { name: 'CHERASCO', province: 'CN', belfioreCode: 'C599' },
  { name: 'DRONERO', province: 'CN', belfioreCode: 'D372' },
  { name: 'BORGO SAN DALMAZZO', province: 'CN', belfioreCode: 'B019' },
  
  // PROVINCIA DI FERMO
  { name: 'FERMO', province: 'FM', belfioreCode: 'D542' },
  { name: 'PORTO SANT\'ELPIDIO', province: 'FM', belfioreCode: 'G924' },
  { name: 'PORTO SAN GIORGIO', province: 'FM', belfioreCode: 'G921' },
  { name: 'MONTEGRANARO', province: 'FM', belfioreCode: 'F526' },
  { name: 'SANT\'ELPIDIO A MARE', province: 'FM', belfioreCode: 'I322' },
  { name: 'MONTEGIORGIO', province: 'FM', belfioreCode: 'F518' },
  { name: 'GROTTAZZOLINA', province: 'FM', belfioreCode: 'E209' },
  { name: 'LAPEDONA', province: 'FM', belfioreCode: 'E456' },
  { name: 'MONTE VIDON CORRADO', province: 'FM', belfioreCode: 'F662' },
  { name: 'BELMONTE PICENO', province: 'FM', belfioreCode: 'A767' },
  
  // PROVINCIA DI GROSSETO
  { name: 'GROSSETO', province: 'GR', belfioreCode: 'E202' },
  { name: 'FOLLONICA', province: 'GR', belfioreCode: 'D653' },
  { name: 'ORBETELLO', province: 'GR', belfioreCode: 'G086' },
  { name: 'CASTIGLIONE DELLA PESCAIA', province: 'GR', belfioreCode: 'C315' },
  { name: 'MONTE ARGENTARIO', province: 'GR', belfioreCode: 'F448' },
  { name: 'GAVORRANO', province: 'GR', belfioreCode: 'D948' },
  { name: 'MASSA MARITTIMA', province: 'GR', belfioreCode: 'F024' },
  { name: 'SCANSANO', province: 'GR', belfioreCode: 'I493' },
  { name: 'PITIGLIANO', province: 'GR', belfioreCode: 'G716' },
  { name: 'SORANO', province: 'GR', belfioreCode: 'I841' },
  
  // PROVINCIA DI IMPERIA
  { name: 'IMPERIA', province: 'IM', belfioreCode: 'E290' },
  { name: 'SANREMO', province: 'IM', belfioreCode: 'I138' },
  { name: 'VENTIMIGLIA', province: 'IM', belfioreCode: 'L741' },
  { name: 'BORDIGHERA', province: 'IM', belfioreCode: 'A986' },
  { name: 'TAGGIA', province: 'IM', belfioreCode: 'L024' },
  { name: 'DIANO MARINA', province: 'IM', belfioreCode: 'D289' },
  { name: 'VALLECROSIA', province: 'IM', belfioreCode: 'L592' },
  { name: 'CAMPOROSSO', province: 'IM', belfioreCode: 'B569' },
  { name: 'DOLCEACQUA', province: 'IM', belfioreCode: 'D318' },
  { name: 'CERVO', province: 'IM', belfioreCode: 'C557' },
  
  // PROVINCIA DI ISERNIA
  { name: 'ISERNIA', province: 'IS', belfioreCode: 'E335' },
  { name: 'VENAFRO', province: 'IS', belfioreCode: 'L723' },
  { name: 'AGNONE', province: 'IS', belfioreCode: 'A080' },
  { name: 'MACCHIAGODENA', province: 'IS', belfioreCode: 'E784' },
  { name: 'FROSOLONE', province: 'IS', belfioreCode: 'D812' },
  { name: 'CASTEL DI SANGRO', province: 'IS', belfioreCode: 'C096' },
  { name: 'SANTA MARIA DEL MOLISE', province: 'IS', belfioreCode: 'I253' },
  { name: 'PESCOLANCIANO', province: 'IS', belfioreCode: 'G494' },
  { name: 'CAROVILLI', province: 'IS', belfioreCode: 'B825' },
  { name: 'MONTERODUNI', province: 'IS', belfioreCode: 'F610' },
  
  // PROVINCIA DI LIVORNO
  { name: 'LIVORNO', province: 'LI', belfioreCode: 'E625' },
  { name: 'PIOMBINO', province: 'LI', belfioreCode: 'G695' },
  { name: 'CECINA', province: 'LI', belfioreCode: 'C417' },
  { name: 'ROSIGNANO MARITTIMO', province: 'LI', belfioreCode: 'H574' },
  { name: 'CAMPIGLIA MARITTIMA', province: 'LI', belfioreCode: 'B506' },
  { name: 'PORTOFERRAIO', province: 'LI', belfioreCode: 'G914' },
  { name: 'COLLESALVETTI', province: 'LI', belfioreCode: 'C863' },
  { name: 'BIBBONA', province: 'LI', belfioreCode: 'A845' },
  { name: 'SUVERETO', province: 'LI', belfioreCode: 'L016' },
  { name: 'CASTAGNETO CARDUCCI', province: 'LI', belfioreCode: 'C044' },
  
  // PROVINCIA DI LODI
  { name: 'LODI', province: 'LO', belfioreCode: 'E648' },
  { name: 'CODOGNO', province: 'LO', belfioreCode: 'C816' },
  { name: 'SANT\'ANGELO LODIGIANO', province: 'LO', belfioreCode: 'I276' },
  { name: 'CASALPUSTERLENGO', province: 'LO', belfioreCode: 'B889' },
  { name: 'LODI VECCHIO', province: 'LO', belfioreCode: 'E650' },
  { name: 'SOMAGLIA', province: 'LO', belfioreCode: 'I818' },
  { name: 'TAVAZZANO CON VILLAVESCO', province: 'LO', belfioreCode: 'L068' },
  { name: 'MONTANASO LOMBARDO', province: 'LO', belfioreCode: 'F416' },
  { name: 'BORGHETTO LODIGIANO', province: 'LO', belfioreCode: 'A994' },
  { name: 'MULAZZANO', province: 'LO', belfioreCode: 'F804' },
  
  // PROVINCIA DI LUCCA
  { name: 'LUCCA', province: 'LU', belfioreCode: 'E715' },
  { name: 'VIAREGGIO', province: 'LU', belfioreCode: 'L833' },
  { name: 'CAMAIORE', province: 'LU', belfioreCode: 'B455' },
  { name: 'CAPANNORI', province: 'LU', belfioreCode: 'B648' },
  { name: 'PIETRASANTA', province: 'LU', belfioreCode: 'G628' },
  { name: 'ALTOPASCIO', province: 'LU', belfioreCode: 'A241' },
  { name: 'PORCARI', province: 'LU', belfioreCode: 'G881' },
  { name: 'MONTECARLO', province: 'LU', belfioreCode: 'F452' },
  { name: 'FORTE DEI MARMI', province: 'LU', belfioreCode: 'D730' },
  { name: 'SERAVEZZA', province: 'LU', belfioreCode: 'I623' },
  
  // PROVINCIA DI MONZA E BRIANZA
  { name: 'MONZA', province: 'MB', belfioreCode: 'F704' },
  { name: 'DESIO', province: 'MB', belfioreCode: 'D286' },
  { name: 'LISSONE', province: 'MB', belfioreCode: 'E613' },
  { name: 'CESANO MADERNO', province: 'MB', belfioreCode: 'C569' },
  { name: 'SEREGNO', province: 'MB', belfioreCode: 'I625' },
  { name: 'LIMBIATE', province: 'MB', belfioreCode: 'E590' },
  { name: 'NOVA MILANESE', province: 'MB', belfioreCode: 'F943' },
  { name: 'MUGGIÒ', province: 'MB', belfioreCode: 'F798' },
  { name: 'CARATE BRIANZA', province: 'MB', belfioreCode: 'B730' },
  { name: 'BRUGHERIO', province: 'MB', belfioreCode: 'B216' },
  
  // PROVINCIA DI MASSA-CARRARA
  { name: 'MASSA', province: 'MS', belfioreCode: 'F023' },
  { name: 'CARRARA', province: 'MS', belfioreCode: 'B832' },
  { name: 'AULLA', province: 'MS', belfioreCode: 'A496' },
  { name: 'PONTREMOLI', province: 'MS', belfioreCode: 'G870' },
  { name: 'FIVIZZANO', province: 'MS', belfioreCode: 'D626' },
  { name: 'FOSDINOVO', province: 'MS', belfioreCode: 'D735' },
  { name: 'VILLAFRANCA IN LUNIGIANA', province: 'MS', belfioreCode: 'L945' },
  { name: 'BAGNONE', province: 'MS', belfioreCode: 'A570' },
  { name: 'LICCIANA NARDI', province: 'MS', belfioreCode: 'E571' },
  { name: 'MULAZZO', province: 'MS', belfioreCode: 'F803' },
  
  // PROVINCIA DI NOVARA
  { name: 'NOVARA', province: 'NO', belfioreCode: 'F952' },
  { name: 'BORGOMANERO', province: 'NO', belfioreCode: 'B019' },
  { name: 'ARONA', province: 'NO', belfioreCode: 'A429' },
  { name: 'OLEGGIO', province: 'NO', belfioreCode: 'G023' },
  { name: 'GALLIATE', province: 'NO', belfioreCode: 'D870' },
  { name: 'CAMERI', province: 'NO', belfioreCode: 'B470' },
  { name: 'TRECATE', province: 'NO', belfioreCode: 'L347' },
  { name: 'VERBANIA', province: 'NO', belfioreCode: 'L746' },
  { name: 'DOMODOSSOLA', province: 'NO', belfioreCode: 'D332' },
  { name: 'OMEGNA', province: 'NO', belfioreCode: 'G061' },
  
  // PROVINCIA DI OGLIASTRA
  { name: 'LANUSEI', province: 'OG', belfioreCode: 'E456' },
  { name: 'TORTOLÌ', province: 'OG', belfioreCode: 'L304' },
  { name: 'JERZU', province: 'OG', belfioreCode: 'E388' },
  { name: 'BAUNEI', province: 'OG', belfioreCode: 'A715' },
  { name: 'CARDEDU', province: 'OG', belfioreCode: 'B757' },
  { name: 'GAIRO', province: 'OG', belfioreCode: 'D853' },
  { name: 'ILBONO', province: 'OG', belfioreCode: 'E284' },
  { name: 'LOCERI', province: 'OG', belfioreCode: 'E642' },
  { name: 'OSINI', province: 'OG', belfioreCode: 'G159' },
  { name: 'PERDASDEFOGU', province: 'OG', belfioreCode: 'G451' },
  
  // PROVINCIA DI OLBIA-TEMPIO
  { name: 'OLBIA', province: 'OT', belfioreCode: 'G015' },
  { name: 'TEMPIO PAUSANIA', province: 'OT', belfioreCode: 'L090' },
  { name: 'SANTA TERESA GALLURA', province: 'OT', belfioreCode: 'I312' },
  { name: 'ARZACHENA', province: 'OT', belfioreCode: 'A453' },
  { name: 'GOLFO ARANCI', province: 'OT', belfioreCode: 'E083' },
  { name: 'LOIRI PORTO SAN PAOLO', province: 'OT', belfioreCode: 'M207' },
  { name: 'PALAU', province: 'OT', belfioreCode: 'G258' },
  { name: 'BUDDUSÒ', province: 'OT', belfioreCode: 'B245' },
  { name: 'CALANGIANUS', province: 'OT', belfioreCode: 'B381' },
  { name: 'TELTI', province: 'OT', belfioreCode: 'L089' },
  
  // PROVINCIA DI PISA
  { name: 'PISA', province: 'PI', belfioreCode: 'G702' },
  { name: 'PONTEDERA', province: 'PI', belfioreCode: 'G843' },
  { name: 'VOLTERRA', province: 'PI', belfioreCode: 'M126' },
  { name: 'CASCINA', province: 'PI', belfioreCode: 'B950' },
  { name: 'SAN MINIATO', province: 'PI', belfioreCode: 'I044' },
  { name: 'VICOPISANO', province: 'PI', belfioreCode: 'L846' },
  { name: 'SANTA CROCE SULL\'ARNO', province: 'PI', belfioreCode: 'I178' },
  { name: 'CASTELFRANCO DI SOTTO', province: 'PI', belfioreCode: 'C110' },
  { name: 'PECCIOLI', province: 'PI', belfioreCode: 'G395' },
  { name: 'POMARANCE', province: 'PI', belfioreCode: 'G812' },
  
  // PROVINCIA DI PISTOIA
  { name: 'PISTOIA', province: 'PT', belfioreCode: 'G713' },
  { name: 'MONSUMMANO TERME', province: 'PT', belfioreCode: 'F383' },
  { name: 'MONTECATINI TERME', province: 'PT', belfioreCode: 'F446' },
  { name: 'QUARRATA', province: 'PT', belfioreCode: 'H109' },
  { name: 'AGLIANA', province: 'PT', belfioreCode: 'A074' },
  { name: 'SERRAVALLE PISTOIESE', province: 'PT', belfioreCode: 'I656' },
  { name: 'PIEVE A NIEVOLE', province: 'PT', belfioreCode: 'G634' },
  { name: 'BUGGIANO', province: 'PT', belfioreCode: 'B252' },
  { name: 'LAMPORECCHIO', province: 'PT', belfioreCode: 'E431' },
  { name: 'LARCIANO', province: 'PT', belfioreCode: 'E458' },
  
  // PROVINCIA DI PESARO E URBINO
  { name: 'PESARO', province: 'PU', belfioreCode: 'G482' },
  { name: 'URBINO', province: 'PU', belfioreCode: 'L500' },
  { name: 'FANO', province: 'PU', belfioreCode: 'D488' },
  { name: 'GABICCE MARE', province: 'PU', belfioreCode: 'D836' },
  { name: 'CATTOLICA', province: 'PU', belfioreCode: 'C357' },
  { name: 'MONDAVIO', province: 'PU', belfioreCode: 'F348' },
  { name: 'CAGLI', province: 'PU', belfioreCode: 'B345' },
  { name: 'PERGOLA', province: 'PU', belfioreCode: 'G452' },
  { name: 'FOSSOMBRONE', province: 'PU', belfioreCode: 'D749' },
  { name: 'VALLEFOGLIA', province: 'PU', belfioreCode: 'M330' },
  
  // PROVINCIA DI PAVIA
  { name: 'PAVIA', province: 'PV', belfioreCode: 'G388' },
  { name: 'VIGEVANO', province: 'PV', belfioreCode: 'L872' },
  { name: 'VOGHERA', province: 'PV', belfioreCode: 'M109' },
  { name: 'STRADELLA', province: 'PV', belfioreCode: 'I968' },
  { name: 'MORTARA', province: 'PV', belfioreCode: 'F759' },
  { name: 'BRONI', province: 'PV', belfioreCode: 'B201' },
  { name: 'CASALE MONFERRATO', province: 'PV', belfioreCode: 'C133' },
  { name: 'CASTEGGIO', province: 'PV', belfioreCode: 'C053' },
  { name: 'LOMELLO', province: 'PV', belfioreCode: 'E665' },
  { name: 'GARLASCO', province: 'PV', belfioreCode: 'D925' },
  
  // PROVINCIA DI ROVIGO
  { name: 'ROVIGO', province: 'RO', belfioreCode: 'H620' },
  { name: 'ADRIA', province: 'RO', belfioreCode: 'A059' },
  { name: 'PORTO TOLLE', province: 'RO', belfioreCode: 'G926' },
  { name: 'BADIA POLESINE', province: 'RO', belfioreCode: 'A535' },
  { name: 'LENDINARA', province: 'RO', belfioreCode: 'E521' },
  { name: 'OCCHIOBELLO', province: 'RO', belfioreCode: 'F998' },
  { name: 'FIESSO UMBERTIANO', province: 'RO', belfioreCode: 'D567' },
  { name: 'TAGLIO DI PO', province: 'RO', belfioreCode: 'L025' },
  { name: 'PORTO VIRO', province: 'RO', belfioreCode: 'G927' },
  { name: 'VILLADOSE', province: 'RO', belfioreCode: 'L966' },
  
  // PROVINCIA DI SIENA
  { name: 'SIENA', province: 'SI', belfioreCode: 'I726' },
  { name: 'POGGIBONSI', province: 'SI', belfioreCode: 'G752' },
  { name: 'COLLE DI VAL D\'ELSA', province: 'SI', belfioreCode: 'C847' },
  { name: 'MONTERIGGIONI', province: 'SI', belfioreCode: 'F608' },
  { name: 'CHIUSDINO', province: 'SI', belfioreCode: 'C649' },
  { name: 'ASCIANO', province: 'SI', belfioreCode: 'A462' },
  { name: 'MONTALCINO', province: 'SI', belfioreCode: 'F403' },
  { name: 'PIENZA', province: 'SI', belfioreCode: 'G604' },
  { name: 'MONTEPULCIANO', province: 'SI', belfioreCode: 'F588' },
  { name: 'CHIANCIANO TERME', province: 'SI', belfioreCode: 'C610' },
  
  // PROVINCIA DI LA SPEZIA
  { name: 'LA SPEZIA', province: 'SP', belfioreCode: 'E463' },
  { name: 'SARZANA', province: 'SP', belfioreCode: 'I449' },
  { name: 'LERICI', province: 'SP', belfioreCode: 'E542' },
  { name: 'PORTOVENERE', province: 'SP', belfioreCode: 'G925' },
  { name: 'LEVANTO', province: 'SP', belfioreCode: 'E565' },
  { name: 'MONTEROSSO AL MARE', province: 'SP', belfioreCode: 'F609' },
  { name: 'VERNAZZA', province: 'SP', belfioreCode: 'L771' },
  { name: 'RIOMAGGIORE', province: 'SP', belfioreCode: 'H302' },
  { name: 'MANAROLA', province: 'SP', belfioreCode: 'E874' },
  { name: 'CORNIGLIA', province: 'SP', belfioreCode: 'D025' },
  
  // PROVINCIA DI SAVONA
  { name: 'SAVONA', province: 'SV', belfioreCode: 'I470' },
  { name: 'ALBENGA', province: 'SV', belfioreCode: 'A145' },
  { name: 'FINALE LIGURE', province: 'SV', belfioreCode: 'D595' },
  { name: 'LOANO', province: 'SV', belfioreCode: 'E637' },
  { name: 'PIETRA LIGURE', province: 'SV', belfioreCode: 'G615' },
  { name: 'VARAZZE', province: 'SV', belfioreCode: 'L679' },
  { name: 'CAIRO MONTENOTTE', province: 'SV', belfioreCode: 'B362' },
  { name: 'CARCARE', province: 'SV', belfioreCode: 'B754' },
  { name: 'SPOTORNO', province: 'SV', belfioreCode: 'I925' },
  { name: 'BORGHETTO SANTO SPIRITO', province: 'SV', belfioreCode: 'A995' },
  
  // PROVINCIA DI TERAMO
  { name: 'TERAMO', province: 'TE', belfioreCode: 'L103' },
  { name: 'GIULIANOVA', province: 'TE', belfioreCode: 'E058' },
  { name: 'ROSETO DEGLI ABRUZZI', province: 'TE', belfioreCode: 'H572' },
  { name: 'ALBA ADRIATICA', province: 'TE', belfioreCode: 'A122' },
  { name: 'PINETO', province: 'TE', belfioreCode: 'G677' },
  { name: 'SILVI', province: 'TE', belfioreCode: 'I739' },
  { name: 'ATRI', province: 'TE', belfioreCode: 'A485' },
  { name: 'NOTARESCO', province: 'TE', belfioreCode: 'F943' },
  { name: 'MONTORIO AL VOMANO', province: 'TE', belfioreCode: 'F584' },
  { name: 'CASTELLALTO', province: 'TE', belfioreCode: 'C138' },
  
  // PROVINCIA DI VERBANO-CUSIO-OSSOLA
  { name: 'VERBANIA', province: 'VB', belfioreCode: 'L746' },
  { name: 'DOMODOSSOLA', province: 'VB', belfioreCode: 'D332' },
  { name: 'OMEGNA', province: 'VB', belfioreCode: 'G061' },
  { name: 'STRESA', province: 'VB', belfioreCode: 'I976' },
  { name: 'CANNOBIO', province: 'VB', belfioreCode: 'B614' },
  { name: 'GRAVELLONA TOCE', province: 'VB', belfioreCode: 'E154' },
  { name: 'BAVENO', province: 'VB', belfioreCode: 'A717' },
  { name: 'ARONA', province: 'VB', belfioreCode: 'A429' },
  { name: 'MERGOZZO', province: 'VB', belfioreCode: 'F147' },
  { name: 'CRODO', province: 'VB', belfioreCode: 'D180' },
  
  // PROVINCIA DI VERCELLI
  { name: 'VERCELLI', province: 'VC', belfioreCode: 'L750' },
  { name: 'BORGOSESIA', province: 'VC', belfioreCode: 'B024' },
  { name: 'VARALLO', province: 'VC', belfioreCode: 'L676' },
  { name: 'SANTHIÀ', province: 'VC', belfioreCode: 'I333' },
  { name: 'GATTINARA', province: 'VC', belfioreCode: 'D934' },
  { name: 'LIVORNO FERRARIS', province: 'VC', belfioreCode: 'E624' },
  { name: 'TRINO', province: 'VC', belfioreCode: 'L429' },
  { name: 'CRESCENTINO', province: 'VC', belfioreCode: 'D162' },
  { name: 'CIGLIANO', province: 'VC', belfioreCode: 'C677' },
  { name: 'BIANZÈ', province: 'VC', belfioreCode: 'A847' },
  
  // PROVINCIA DI MEDIO CAMPIDANO
  { name: 'VILLACIDRO', province: 'VS', belfioreCode: 'L924' },
  { name: 'GUSPINI', province: 'VS', belfioreCode: 'E272' },
  { name: 'ARBUS', province: 'VS', belfioreCode: 'A360' },
  { name: 'PABILLONIS', province: 'VS', belfioreCode: 'G210' },
  { name: 'GONNOSFANADIGA', province: 'VS', belfioreCode: 'E086' },
  { name: 'SARDARA', province: 'VS', belfioreCode: 'I438' },
  { name: 'SANLURI', province: 'VS', belfioreCode: 'I133' },
  { name: 'SERRAMANNA', province: 'VS', belfioreCode: 'I645' },
  { name: 'SAMASSI', province: 'VS', belfioreCode: 'H752' },
  { name: 'COLLINAS', province: 'VS', belfioreCode: 'C877' }
];

export async function getCountries(): Promise<Country[]> {
  return COUNTRIES;
}

export async function getProvinces(): Promise<Province[]> {
  return PROVINCES;
}

export async function getCitiesByProvince(provinceCode: string): Promise<City[]> {
  return ITALIAN_CITIES.filter(city => city.province === provinceCode);
}

export async function searchCities(query: string, provinceCode?: string): Promise<City[]> {
  const normalizedQuery = query.toUpperCase();
  let cities = ITALIAN_CITIES;
  
  if (provinceCode) {
    cities = cities.filter(city => city.province === provinceCode);
  }
  
  return cities.filter(city => 
    city.name.includes(normalizedQuery)
  ).slice(0, 20);
}

export function getCountryOptions(): Array<{ value: string; label: string }> {
  return COUNTRIES.map(country => ({
    value: country.name,
    label: country.name
  }));
}

export function getProvinceOptions(): Array<{ value: string; label: string }> {
  const provinceOptions = PROVINCES.map(province => ({
    value: province.code,
    label: province.name
  }));
  
  // Add "ESTERO" option at the beginning
  return [
    { value: 'EE', label: 'ESTERO' },
    ...provinceOptions
  ];
}

// Funzione per ottenere le province senza ESTERO (solo per residenza)
export function getItalianProvinceOptions(): Array<{ value: string; label: string }> {
  const provinceOptions = PROVINCES.map(province => ({
    value: province.code,
    label: province.name
  }));
  
  return provinceOptions;
}


export function getCityOptions(provinceCode?: string): Array<{ value: string; label: string }> {
  if (provinceCode === 'EE') {
    // Return country options for foreign births, sorted alphabetically
    return COUNTRIES.map(country => ({
      value: country.name,
      label: country.name
    })).sort((a, b) => a.label.localeCompare(b.label));
  }
  
  let cities = ITALIAN_CITIES;
  
  if (provinceCode) {
    cities = cities.filter(city => city.province === provinceCode);
  }
  
  return cities.map(city => ({
    value: city.name,
    label: city.name
  }));
}

export const GENDER_OPTIONS = [
  { value: 'M', label: 'Maschio' },
  { value: 'F', label: 'Femmina' }
];

export function getCityBelfioreCode(cityName: string): string | null {
  // First check if it's an Italian city
  const city = ITALIAN_CITIES.find(c => c.name === cityName);
  if (city) {
    return city.belfioreCode;
  }
  
  // If not found, check if it's a foreign country
  const country = COUNTRIES.find(c => c.name === cityName);
  if (country) {
    return country.code;
  }
  
  return null;
}