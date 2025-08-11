import { useState, useEffect } from 'react';
import { partnerService } from '../services/partner';

export interface PartnerAnalytics {
  revenueChart: Array<{
    month: string;
    revenue: number;
    target: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  userGrowth: Array<{
    month: string;
    users: number;
  }>;
  metrics: {
    conversionRate: number;
    avgRevenuePerUser: number;
    growthRate: number;
  };
  pendingActions: {
    documentsToApprove: number;
    contractsToSign: number;
    paymentsInProgress: number;
    completedEnrollments: number;
  };
}

export const usePartnerAnalytics = () => {
  const [analytics, setAnalytics] = useState<PartnerAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await partnerService.getAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
};