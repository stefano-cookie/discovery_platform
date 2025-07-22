import { getCityBelfioreCode, searchCities } from './geoService';

class BelfioreService {
  private static instance: BelfioreService;
  private cache: Map<string, string> = new Map();
  private reverseCache: Map<string, string> = new Map();
  
  public static getInstance(): BelfioreService {
    if (!BelfioreService.instance) {
      BelfioreService.instance = new BelfioreService();
    }
    return BelfioreService.instance;
  }

  private normalizeString(str: string): string {
    return str
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getBelfioreCode(place: string): Promise<string> {
    const normalizedPlace = this.normalizeString(place);
    
    if (this.cache.has(normalizedPlace)) {
      return this.cache.get(normalizedPlace)!;
    }

    try {
      let belfioreCode = getCityBelfioreCode(place);
      
      if (belfioreCode) {
        this.cache.set(normalizedPlace, belfioreCode);
        return belfioreCode;
      }

      const cities = await searchCities(place);
      if (cities.length > 0) {
        const exactMatch = cities.find(city => 
          this.normalizeString(city.name) === normalizedPlace
        );
        
        const selectedCity = exactMatch || cities[0];
        belfioreCode = selectedCity.belfioreCode;
        
        this.cache.set(normalizedPlace, belfioreCode);
        return belfioreCode;
      }

      const fallbackCode = 'Z999';
      this.cache.set(normalizedPlace, fallbackCode);
      return fallbackCode;

    } catch (error) {
      const fallbackCode = 'Z999';
      this.cache.set(normalizedPlace, fallbackCode);
      return fallbackCode;
    }
  }

  async getPlaceFromBelfioreCode(belfioreCode: string): Promise<string> {
    const normalizedCode = belfioreCode.toUpperCase().trim();
    
    if (this.reverseCache.has(normalizedCode)) {
      return this.reverseCache.get(normalizedCode)!;
    }

    try {
      const placeName = normalizedCode;
      this.reverseCache.set(normalizedCode, placeName);
      return placeName;

    } catch (error) {
      this.reverseCache.set(normalizedCode, normalizedCode);
      return normalizedCode;
    }
  }

  async isValidBelfioreCode(belfioreCode: string): Promise<boolean> {
    try {
      return belfioreCode.length === 4 && /^[A-Z]\d{3}$/.test(belfioreCode);
    } catch (error) {
      return false;
    }
  }

  async searchPlaces(query: string, maxResults: number = 10): Promise<Array<{name: string, code: string, type: 'city' | 'country'}>> {
    const results: Array<{name: string, code: string, type: 'city' | 'country'}> = [];
    
    try {
      const cities = await searchCities(query);
      for (const city of cities.slice(0, maxResults)) {
        results.push({
          name: city.name,
          code: city.belfioreCode,
          type: 'city'
        });
      }

    } catch (error) {
      return results;
    }

    return results;
  }

  async getPlaceInfo(belfioreCode: string): Promise<{
    name: string;
    code: string;
    type: 'city' | 'country';
    province?: string;
    continent?: string;
  } | null> {
    try {
      const placeName = belfioreCode;
      
      if (!placeName) {
        return null;
      }

      const isCountry = belfioreCode.startsWith('Z');
      
      if (isCountry) {
        return {
          name: placeName,
          code: belfioreCode,
          type: 'country'
        };
      } else {
        const cities = await searchCities(placeName);
        const city = cities.find((c: any) => c.belfioreCode === belfioreCode);
        
        return {
          name: placeName,
          code: belfioreCode,
          type: 'city',
          province: city?.province
        };
      }

    } catch (error) {
      return null;
    }
  }

  async validateAndNormalizePlaceName(place: string): Promise<{
    isValid: boolean;
    normalizedName: string;
    belfioreCode: string;
    suggestions?: string[];
  }> {
    try {
      const belfioreCode = await this.getBelfioreCode(place);
      const normalizedName = await this.getPlaceFromBelfioreCode(belfioreCode);
      
      const isExactMatch = this.normalizeString(place) === this.normalizeString(normalizedName);
      
      const result = {
        isValid: true,
        normalizedName,
        belfioreCode,
        suggestions: undefined as string[] | undefined
      };

      if (!isExactMatch) {
        const searchResults = await this.searchPlaces(place, 5);
        result.suggestions = searchResults.map(r => r.name);
      }

      return result;

    } catch (error) {
      return {
        isValid: false,
        normalizedName: place,
        belfioreCode: 'Z999',
        suggestions: []
      };
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.reverseCache.clear();
  }

  addToCache(place: string, code: string): void {
    const normalized = this.normalizeString(place);
    this.cache.set(normalized, code);
    this.reverseCache.set(code, place);
  }

  getCacheStats(): {
    forwardCacheSize: number;
    reverseCacheSize: number;
  } {
    return {
      forwardCacheSize: this.cache.size,
      reverseCacheSize: this.reverseCache.size
    };
  }

  async preloadCommonPlaces(): Promise<void> {
    const commonPlaces = [
      'ROMA', 'MILANO', 'NAPOLI', 'TORINO', 'PALERMO', 'GENOVA', 'BOLOGNA', 'FIRENZE',
      'BARI', 'CATANIA', 'VENEZIA', 'VERONA', 'MESSINA', 'PADOVA', 'TRIESTE',
      'FRANCIA', 'GERMANIA', 'SPAGNA', 'REGNO UNITO', 'STATI UNITI D\'AMERICA'
    ];

    const promises = commonPlaces.map(place => this.getBelfioreCode(place));
    
    try {
      await Promise.all(promises);
    } catch (error) {
      return;
    }
  }
}

export default BelfioreService.getInstance();