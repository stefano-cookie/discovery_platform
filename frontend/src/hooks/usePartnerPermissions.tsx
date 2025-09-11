import { useMemo } from 'react';
import { usePartnerAuth } from './usePartnerAuth';

export interface PartnerPermissions {
  // Visualizzazione dati economici
  canViewRevenue: boolean;
  canViewCommissions: boolean;
  canViewPayments: boolean;
  canViewFinancialMetrics: boolean;
  
  // Gestione collaboratori
  canInviteCollaborators: boolean;
  canManageCollaborators: boolean;
  
  // Operazioni su utenti
  canExportUsers: boolean;
  canViewAllUsers: boolean;
  canManageUserDocuments: boolean;
  canProcessPayments: boolean;
  
  // Gestione offerte
  canViewOffers: boolean;
  canManageOffers: boolean;
  canCreateOffers: boolean;
  canEditOffers: boolean;
  
  // Dashboard sections
  canViewRevenueChart: boolean;
  canViewQuickMetrics: boolean;
  canViewFinancialCards: boolean;
}

export const usePartnerPermissions = (): PartnerPermissions => {
  const { partnerEmployee } = usePartnerAuth();
  
  const permissions = useMemo((): PartnerPermissions => {
    const isAdministrative = partnerEmployee?.role === 'ADMINISTRATIVE';
    
    return {
      // ADMINISTRATIVE ha accesso completo, COMMERCIAL ha accesso limitato
      canViewRevenue: isAdministrative,
      canViewCommissions: isAdministrative,
      canViewPayments: isAdministrative,
      canViewFinancialMetrics: isAdministrative,
      
      // Solo ADMINISTRATIVE può gestire collaboratori
      canInviteCollaborators: isAdministrative,
      canManageCollaborators: isAdministrative,
      
      // Entrambi possono gestire utenti ma con limitazioni
      canExportUsers: true, // Entrambi possono esportare
      canViewAllUsers: true, // Entrambi possono vedere utenti
      canManageUserDocuments: true, // Entrambi possono gestire documenti
      canProcessPayments: isAdministrative, // Solo ADMINISTRATIVE per pagamenti
      
      // Gestione offerte - ENTRAMBI possono gestire
      canViewOffers: true, // Entrambi possono vedere offerte
      canManageOffers: true, // Entrambi possono gestire offerte
      canCreateOffers: true, // Entrambi possono creare offerte
      canEditOffers: true, // Entrambi possono modificare offerte
      
      // Dashboard sections - economia solo per ADMINISTRATIVE
      canViewRevenueChart: isAdministrative,
      canViewQuickMetrics: isAdministrative,
      canViewFinancialCards: isAdministrative,
    };
  }, [partnerEmployee?.role]);
  
  return permissions;
};