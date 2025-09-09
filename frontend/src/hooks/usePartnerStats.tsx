import { useState, useEffect } from 'react';
import { PartnerStats } from '../types/partner';
import { partnerService } from '../services/partner';

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
    } catch (err) {
      console.error('Error fetching partner stats:', err);
      setError('Errore nel caricamento delle statistiche');
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
    refetch: fetchStats
  };
};