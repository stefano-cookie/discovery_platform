import belfioreService from '../services/belfioreService';

interface PersonData {
  lastName: string;
  firstName: string;
  birthDate: string;
  birthPlace: string;
  gender?: 'M' | 'F';
}

const MONTHS: { [key: string]: string } = {
  '01': 'A', '02': 'B', '03': 'C', '04': 'D',
  '05': 'E', '06': 'H', '07': 'L', '08': 'M',
  '09': 'P', '10': 'R', '11': 'S', '12': 'T'
};

const ODD_POSITIONS: { [key: string]: number } = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};

const EVEN_POSITIONS: { [key: string]: number } = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
  'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};

const REMAINDER_CHARS: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

function normalizeString(str: string): string {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
}

function extractConsonants(str: string): string {
  return str.replace(/[AEIOU]/g, '');
}

function extractVowels(str: string): string {
  return str.replace(/[^AEIOU]/g, '');
}

function generateLastNameCode(lastName: string): string {
  const normalized = normalizeString(lastName);
  const consonants = extractConsonants(normalized);
  const vowels = extractVowels(normalized);
  
  let code = '';
  
  if (consonants.length >= 3) {
    code = consonants.substring(0, 3);
  } else {
    code = consonants + vowels.substring(0, 3 - consonants.length);
  }
  
  while (code.length < 3) {
    code += 'X';
  }
  
  return code.substring(0, 3);
}

function generateFirstNameCode(firstName: string): string {
  const normalized = normalizeString(firstName);
  const consonants = extractConsonants(normalized);
  const vowels = extractVowels(normalized);
  
  let code = '';
  
  if (consonants.length >= 4) {
    code = consonants[0] + consonants[2] + consonants[3];
  } else if (consonants.length === 3) {
    code = consonants;
  } else {
    code = consonants + vowels.substring(0, 3 - consonants.length);
  }
  
  while (code.length < 3) {
    code += 'X';
  }
  
  return code.substring(0, 3);
}

function generateDateGenderCode(birthDate: string, gender: 'M' | 'F' = 'M'): string {
  const [year, month, day] = birthDate.split('-');
  
  const yearCode = year.substring(2);
  
  const monthCode = MONTHS[month];
  if (!monthCode) {
    throw new Error(`Mese non valido: ${month}`);
  }
  
  let dayNumber = parseInt(day);
  if (gender === 'F') {
    dayNumber += 40;
  }
  
  const dayCode = dayNumber.toString().padStart(2, '0');
  
  return yearCode + monthCode + dayCode;
}

async function getBelfioreCode(birthPlace: string): Promise<string> {
  return await belfioreService.getBelfioreCode(birthPlace);
}

function calculateControlCharacter(code: string): string {
  if (code.length !== 15) {
    throw new Error(`Codice deve essere di 15 caratteri, ricevuto: ${code.length}`);
  }
  
  let sum = 0;
  
  for (let i = 0; i < 15; i++) {
    const character = code[i];
    
    if (i % 2 === 0) {
      sum += ODD_POSITIONS[character] || 0;
    } else {
      sum += EVEN_POSITIONS[character] || 0;
    }
  }
  
  const remainder = sum % 26;
  
  return REMAINDER_CHARS[remainder];
}

function deduceGender(firstName: string): 'M' | 'F' {
  const normalizedName = normalizeString(firstName);
  
  const femaleEndings = ['A', 'E', 'I', 'IA', 'RA', 'NA', 'LA', 'CA', 'GA', 'TA', 'SA'];
  
  const femaleNames = ['BEATRICE', 'MARGHERITA', 'ELISABETTA', 'CAROL', 'CARMEN', 'DOLORES', 'MERCEDES', 'PILAR'];
  
  const maleNamesEndingWithA = ['ANDREA', 'LUCA', 'NICOLA', 'MATTIA', 'GIOSUÈ', 'BARNABA', 'ELIA'];
  
  if (maleNamesEndingWithA.includes(normalizedName)) {
    return 'M';
  }
  
  if (femaleNames.includes(normalizedName)) {
    return 'F';
  }
  
  for (const ending of femaleEndings) {
    if (normalizedName.endsWith(ending)) {
      return 'F';
    }
  }
  
  return 'M';
}

export async function generateCodiceFiscale(data: PersonData): Promise<string> {
  try {
    if (!data.lastName || !data.firstName || !data.birthDate || !data.birthPlace) {
      throw new Error('Tutti i campi sono obbligatori');
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.birthDate)) {
      throw new Error('Formato data non valido. Utilizzare YYYY-MM-DD');
    }
    
    const gender = data.gender || deduceGender(data.firstName);
    
    const lastNameCode = generateLastNameCode(data.lastName);
    const firstNameCode = generateFirstNameCode(data.firstName);
    const dateGenderCode = generateDateGenderCode(data.birthDate, gender);
    const belfioreCode = await getBelfioreCode(data.birthPlace);
    
    const partialCode = lastNameCode + firstNameCode + dateGenderCode + belfioreCode;
    
    if (partialCode.length !== 15) {
      throw new Error(`Errore nella generazione: codice parziale di ${partialCode.length} caratteri invece di 15`);
    }
    
    const controlChar = calculateControlCharacter(partialCode);
    
    return partialCode + controlChar;
    
  } catch (error) {
    throw error;
  }
}

export function validateFiscalCode(fiscalCode: string): boolean {
  try {
    const regex = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
    if (!regex.test(fiscalCode)) {
      return false;
    }
    
    const partialCode = fiscalCode.substring(0, 15);
    
    const expectedControlChar = calculateControlCharacter(partialCode);
    
    return expectedControlChar === fiscalCode[15];
    
  } catch (error) {
    return false;
  }
}

interface DecodedFiscalCode {
  lastNameCode: string;
  firstNameCode: string;
  birthDate: string;
  birthPlace: string;
  gender: 'M' | 'F';
  isValid: boolean;
  controlCharacter: string;
}

const REVERSE_MONTHS: { [key: string]: string } = {
  'A': '01', 'B': '02', 'C': '03', 'D': '04', 'E': '05', 'H': '06',
  'L': '07', 'M': '08', 'P': '09', 'R': '10', 'S': '11', 'T': '12'
};

async function getPlaceFromBelfioreCode(belfioreCode: string): Promise<string> {
  return belfioreCode;
}

export async function decodeFiscalCode(fiscalCode: string): Promise<DecodedFiscalCode> {
  try {
    if (!fiscalCode || fiscalCode.length !== 16) {
      return {
        lastNameCode: '',
        firstNameCode: '',
        birthDate: '',
        birthPlace: '',
        gender: 'M',
        isValid: false,
        controlCharacter: ''
      };
    }
    
    const normalizedCode = fiscalCode.toUpperCase();
    
    if (!validateFiscalCode(normalizedCode)) {
      return {
        lastNameCode: '',
        firstNameCode: '',
        birthDate: '',
        birthPlace: '',
        gender: 'M',
        isValid: false,
        controlCharacter: ''
      };
    }
    
    const lastNameCode = normalizedCode.substring(0, 3);
    const firstNameCode = normalizedCode.substring(3, 6);
    const yearCode = normalizedCode.substring(6, 8);
    const monthCode = normalizedCode.substring(8, 9);
    const dayCode = normalizedCode.substring(9, 11);
    const belfioreCode = normalizedCode.substring(11, 15);
    const controlCharacter = normalizedCode.substring(15, 16);
    
    const month = REVERSE_MONTHS[monthCode];
    if (!month) {
      throw new Error(`Codice mese non valido: ${monthCode}`);
    }
    
    let day = parseInt(dayCode);
    let gender: 'M' | 'F' = 'M';
    
    if (day > 40) {
      gender = 'F';
      day -= 40;
    }
    
    const yearNum = parseInt(yearCode);
    const currentYear = new Date().getFullYear();
    const currentYearShort = currentYear % 100;
    
    let fullYear: number;
    if (yearNum <= currentYearShort) {
      fullYear = 2000 + yearNum;
    } else {
      fullYear = 1900 + yearNum;
    }
    
    const birthDate = `${fullYear}-${month}-${day.toString().padStart(2, '0')}`;
    
    const birthPlace = await getPlaceFromBelfioreCode(belfioreCode);
    
    return {
      lastNameCode,
      firstNameCode,
      birthDate,
      birthPlace,
      gender,
      isValid: true,
      controlCharacter
    };
    
  } catch (error) {
    return {
      lastNameCode: '',
      firstNameCode: '',
      birthDate: '',
      birthPlace: '',
      gender: 'M',
      isValid: false,
      controlCharacter: ''
    };
  }
}

export function addCity(_name: string, _code: string): void {
}

export {
  generateLastNameCode,
  generateFirstNameCode,
  generateDateGenderCode,
  calculateControlCharacter,
  deduceGender
};