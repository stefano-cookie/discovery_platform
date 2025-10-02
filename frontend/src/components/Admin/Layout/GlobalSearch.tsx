import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Building2,
  User,
  FileText,
  Users,
  BookOpen,
  Loader2,
  Crown,
  Mail,
  ChevronRight,
  Filter,
} from 'lucide-react';
import api from '../../../services/api';

interface SearchResult {
  type: 'company' | 'user' | 'registration' | 'employee' | 'course';
  id: string;
  [key: string]: any;
}

interface SearchResponse {
  query: string;
  category: string;
  totalResults: number;
  results: {
    companies: SearchResult[];
    users: SearchResult[];
    registrations: SearchResult[];
    employees: SearchResult[];
    courses: SearchResult[];
  };
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories = [
  { id: 'all', label: 'Tutto', icon: Search },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'users', label: 'Utenti', icon: User },
  { id: 'registrations', label: 'Iscrizioni', icon: FileText },
  { id: 'employees', label: 'Dipendenti', icon: Users },
  { id: 'courses', label: 'Corsi', icon: BookOpen },
];

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const performSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<SearchResponse>('/admin/search', {
        params: {
          q: query,
          category: selectedCategory,
          limit: 10,
        },
      });

      setResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la ricerca');
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length >= 2) {
      // Debounce search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        performSearch();
      }, 300);
    } else {
      setResults(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, selectedCategory, performSearch]);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'company':
        return <Building2 className="w-5 h-5" />;
      case 'user':
        return <User className="w-5 h-5" />;
      case 'registration':
        return <FileText className="w-5 h-5" />;
      case 'employee':
        return <Users className="w-5 h-5" />;
      case 'course':
        return <BookOpen className="w-5 h-5" />;
      default:
        return <Search className="w-5 h-5" />;
    }
  };

  const getResultColor = (type: string) => {
    switch (type) {
      case 'company':
        return 'bg-indigo-50 text-indigo-600';
      case 'user':
        return 'bg-blue-50 text-blue-600';
      case 'registration':
        return 'bg-green-50 text-green-600';
      case 'employee':
        return 'bg-purple-50 text-purple-600';
      case 'course':
        return 'bg-orange-50 text-orange-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const renderResultCard = (result: SearchResult) => {
    switch (result.type) {
      case 'company':
        return (
          <div
            key={result.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-indigo-500"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getResultColor(result.type)}`}>
                {getResultIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">{result.name}</h4>
                  {result.isPremium && <Crown className="w-4 h-4 text-yellow-500" />}
                </div>
                <p className="text-sm text-gray-600 font-mono">{result.referralCode}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{result.registrationsCount} iscrizioni</span>
                  <span>•</span>
                  <span>{result.employeesCount} dipendenti</span>
                  <span>•</span>
                  <span className={result.isActive ? 'text-green-600' : 'text-red-600'}>
                    {result.isActive ? 'Attiva' : 'Disattivata'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        );

      case 'user':
        return (
          <div
            key={result.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-blue-500"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getResultColor(result.type)}`}>
                {getResultIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">
                  {result.nome} {result.cognome}
                </h4>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {result.email}
                </p>
                {result.codiceFiscale && (
                  <p className="text-xs text-gray-500 mt-1 font-mono">CF: {result.codiceFiscale}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {result.registrationsCount} iscrizioni
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        );

      case 'registration':
        return (
          <div
            key={result.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-green-500"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getResultColor(result.type)}`}>
                {getResultIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 text-sm truncate">
                    {result.userName || result.userEmail}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      result.status === 'ENROLLED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{result.companyName}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="font-semibold text-green-600">
                    {formatCurrency(result.finalAmount)}
                  </span>
                  <span>•</span>
                  <span>{result.offerType}</span>
                  <span>•</span>
                  <span className="font-mono text-xs">{result.id.substring(0, 8)}...</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        );

      case 'employee':
        return (
          <div
            key={result.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-purple-500"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getResultColor(result.type)}`}>
                {getResultIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">
                    {result.firstName} {result.lastName}
                  </h4>
                  {result.isOwner && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                      Owner
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{result.email}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{result.companyName}</span>
                  <span>•</span>
                  <span>{result.role}</span>
                  <span>•</span>
                  <span className={result.isActive ? 'text-green-600' : 'text-red-600'}>
                    {result.isActive ? 'Attivo' : 'Disattivato'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        );

      case 'course':
        return (
          <div
            key={result.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-orange-500"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getResultColor(result.type)}`}>
                {getResultIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">{result.name}</h4>
                <p className="text-sm text-gray-600 line-clamp-2">{result.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{result.templateType}</span>
                  <span>•</span>
                  <span>{result.offersCount} offerte</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getAllResults = () => {
    if (!results) return [];

    return [
      ...results.results.companies,
      ...results.results.users,
      ...results.results.registrations,
      ...results.results.employees,
      ...results.results.courses,
    ];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Search Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca companies, utenti, iscrizioni, corsi..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              {loading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 animate-spin" />
              )}
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-6 text-center text-red-600">
              <p>{error}</p>
            </div>
          )}

          {!query.trim() && (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Inizia a digitare per cercare...</p>
              <p className="text-sm text-gray-400 mt-2">
                Cerca per nome, email, codice fiscale, referral code, e altro
              </p>
            </div>
          )}

          {query.trim() && !loading && results && results.totalResults === 0 && (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nessun risultato trovato per "{query}"</p>
              <p className="text-sm text-gray-400 mt-2">
                Prova con termini di ricerca diversi
              </p>
            </div>
          )}

          {query.trim() && !loading && results && results.totalResults > 0 && (
            <div>
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{results.totalResults}</span> risultati trovati
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {getAllResults().map((result) => renderResultCard(result))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Suggerimento: Usa <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">⌘K</kbd> o{' '}
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Ctrl+K</kbd> per aprire la ricerca
          </p>
        </div>
      </div>
    </div>
  );
};