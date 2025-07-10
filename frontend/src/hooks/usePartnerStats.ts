import { useState, useEffect } from 'react';
import { partnerService } from '../services/partner';
import { PartnerStats } from '../types/partner';

export const usePartnerStats = () => {
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await partnerService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento statistiche');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
};