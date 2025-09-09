import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PartnerStats } from '../../types/partner';
import { PartnerAnalytics } from '../../hooks/usePartnerAnalytics';

interface PriorityAlertsProps {
  analytics: PartnerAnalytics | null;
  stats: PartnerStats | null;
}

const PriorityAlerts: React.FC<PriorityAlertsProps> = ({ analytics, stats }) => {
  const navigate = useNavigate();
  
  const handleActionClick = (actionType: string) => {
    switch (actionType) {
      case 'Gestisci Documenti':
        navigate('/dashboard/users');
        break;
      case 'Vedi Contratti':
        navigate('/dashboard/users');
        break;
      case 'Vedi Dettagli':
        // Per ora resta sulla dashboard principale
        break;
      default:
        navigate('/dashboard/users');
    }
  };

  const getAlerts = () => {
    const alerts = [];
    
    // Check for pending documents
    if ((analytics?.pendingActions?.documentsToApprove || 0) > 0) {
      alerts.push({
        type: 'warning' as const,
        title: 'Documenti in attesa',
        message: `${analytics?.pendingActions?.documentsToApprove || 0} utenti hanno documenti da approvare`,
        action: 'Gestisci Documenti',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      });
    }
    
    // Check for high revenue month
    if (stats && stats.monthlyRevenue && stats.monthlyRevenue > 5000) {
      alerts.push({
        type: 'success' as const,
        title: 'Ottimo mese!',
        message: `Hai superato l'obiettivo mensile con €${stats.monthlyRevenue.toLocaleString()}`,
        action: 'Vedi Dettagli',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      });
    }
    
    // Check for contracts to sign
    if ((analytics?.pendingActions?.contractsToSign || 0) > 0) {
      alerts.push({
        type: 'info' as const,
        title: 'Contratti generati',
        message: `${analytics?.pendingActions?.contractsToSign || 0} contratti sono pronti per la firma`,
        action: 'Vedi Contratti',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      });
    }
    
    return alerts.slice(0, 2); // Show max 2 alerts
  };

  const alerts = getAlerts();
  
  if (alerts.length === 0) return null;

  const getAlertStyles = (type: 'success' | 'warning' | 'info') => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-200',
          text: 'text-emerald-800',
          icon: 'text-emerald-600',
          button: 'text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200',
          text: 'text-amber-800',
          icon: 'text-amber-600',
          button: 'text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200'
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600',
          button: 'text-blue-700 hover:text-blue-800 bg-blue-100 hover:bg-blue-200'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200',
          text: 'text-slate-800',
          icon: 'text-slate-600',
          button: 'text-slate-700 hover:text-slate-800 bg-slate-100 hover:bg-slate-200'
        };
    }
  };

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert, index) => {
          const styles = getAlertStyles(alert.type);
          return (
            <div
              key={index}
              className={`relative overflow-hidden rounded-2xl border-2 ${styles.bg} p-6 transition-all duration-200 hover:shadow-lg`}
            >
              <div className="flex items-start">
                <div className={`flex-shrink-0 ${styles.icon} mr-4`}>
                  {alert.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-lg font-semibold ${styles.text} mb-1`}>
                    {alert.title}
                  </h4>
                  <p className={`text-sm ${styles.text} opacity-80 mb-4`}>
                    {alert.message}
                  </p>
                  <button 
                    onClick={() => handleActionClick(alert.action)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${styles.button}`}
                  >
                    {alert.action}
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Decorative element */}
              <div className={`absolute top-0 right-0 w-20 h-20 transform translate-x-8 -translate-y-8 ${styles.icon} opacity-10`}>
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriorityAlerts;