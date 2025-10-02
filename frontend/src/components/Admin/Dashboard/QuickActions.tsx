import React from 'react';
import {
  Building2,
  FileText,
  Download,
  RefreshCw,
  Mail,
  TrendingUp,
  AlertCircle,
  Database,
} from 'lucide-react';

interface QuickActionsProps {
  onAction?: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const actions = [
    {
      id: 'create-company',
      label: 'Crea Company',
      icon: Building2,
      color: 'indigo',
      description: 'Aggiungi nuova company',
      enabled: true,
    },
    {
      id: 'export-data',
      label: 'Export Dati',
      icon: Download,
      color: 'green',
      description: 'Esporta iscrizioni e revenue',
      enabled: true,
    },
    {
      id: 'bulk-email',
      label: 'Email Massiva',
      icon: Mail,
      color: 'blue',
      description: 'Invia comunicazioni',
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'sync-data',
      label: 'Sincronizza',
      icon: RefreshCw,
      color: 'purple',
      description: 'Aggiorna dati piattaforma',
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'revenue-report',
      label: 'Report Revenue',
      icon: TrendingUp,
      color: 'yellow',
      description: 'Genera report mensile',
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'pending-actions',
      label: 'Azioni Pending',
      icon: AlertCircle,
      color: 'red',
      description: 'Gestisci azioni in sospeso',
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'database-backup',
      label: 'Backup DB',
      icon: Database,
      color: 'gray',
      description: 'Backup database',
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: FileText,
      color: 'slate',
      description: 'Visualizza log attività',
      enabled: false,
      comingSoon: true,
    },
  ];

  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200',
    green: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
    yellow: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-yellow-200',
    red: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
    gray: 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200',
    slate: 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200',
  };

  const handleClick = (actionId: string, enabled: boolean) => {
    if (!enabled) return;
    onAction?.(actionId);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Azioni Rapide
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const colorClass = colorClasses[action.color as keyof typeof colorClasses];

          return (
            <button
              key={action.id}
              onClick={() => handleClick(action.id, action.enabled)}
              disabled={!action.enabled}
              className={`
                relative p-4 rounded-lg border-2 transition-all duration-200
                ${action.enabled
                  ? `${colorClass} cursor-pointer transform hover:scale-105 hover:shadow-md`
                  : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                }
              `}
            >
              {/* Coming Soon Badge */}
              {action.comingSoon && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                  Presto
                </span>
              )}

              <div className="flex flex-col items-center text-center gap-2">
                <Icon className="w-8 h-8" strokeWidth={2} />
                <div>
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className="text-xs opacity-75 mt-1">{action.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Funzionalità in sviluppo
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Le azioni contrassegnate con "Presto" saranno disponibili nei prossimi aggiornamenti.
              Per ora sono disponibili la creazione di company e l'export dei dati.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};