import { useState, useEffect } from 'react';
import { PartnerEmployee, PartnerEmployeeRole } from '../types/partner';

// API service per collaboratori
class PartnerEmployeeService {
  private getToken(): string | null {
    return localStorage.getItem('partnerToken');
  }

  private getHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  // Lista collaboratori
  async getEmployees(): Promise<{ collaborators: PartnerEmployee[] }> {
    const response = await fetch('/api/partner-employees/collaborators', {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Errore nel caricamento collaboratori');
    }

    return response.json();
  }

  // Invita collaboratore
  async inviteEmployee(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: PartnerEmployeeRole;
  }): Promise<{ message: string; collaborator: PartnerEmployee }> {
    const response = await fetch('/api/partner-employees/invite', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Errore nell\'invito collaboratore');
    }

    return response.json();
  }

  // Reinvia invito
  async resendInvite(id: string): Promise<{ message: string }> {
    const response = await fetch(`/api/partner-employees/collaborators/${id}/resend-invite`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Errore nel reinvio invito');
    }

    return response.json();
  }

  // Aggiorna collaboratore
  async updateEmployee(id: string, data: {
    role?: PartnerEmployeeRole;
    isActive?: boolean;
  }): Promise<{ message: string; collaborator: PartnerEmployee }> {
    const response = await fetch(`/api/partner-employees/collaborators/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Errore nell\'aggiornamento collaboratore');
    }

    return response.json();
  }

  // Rimuovi collaboratore
  async removeEmployee(id: string): Promise<{ message: string }> {
    const response = await fetch(`/api/partner-employees/collaborators/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Errore nella rimozione collaboratore');
    }

    return response.json();
  }
}

const partnerEmployeeService = new PartnerEmployeeService();

// Hook principale
export const usePartnerEmployees = () => {
  const [employees, setEmployees] = useState<PartnerEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carica lista collaboratori
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await partnerEmployeeService.getEmployees();
      setEmployees(data.collaborators);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento collaboratori');
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Invita collaboratore
  const inviteEmployee = async (data: {
    email: string;
    firstName: string;
    lastName: string;
    role: PartnerEmployeeRole;
  }) => {
    try {
      setError(null);
      const result = await partnerEmployeeService.inviteEmployee(data);
      
      // Ricarica la lista per includere il nuovo collaboratore
      await fetchEmployees();
      
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Reinvia invito
  const resendInvite = async (id: string) => {
    try {
      setError(null);
      await partnerEmployeeService.resendInvite(id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Aggiorna collaboratore
  const updateEmployee = async (id: string, data: {
    role?: PartnerEmployeeRole;
    isActive?: boolean;
  }) => {
    try {
      setError(null);
      const result = await partnerEmployeeService.updateEmployee(id, data);
      
      // Aggiorna nella lista locale
      setEmployees(prev => prev.map(emp => 
        emp.id === id ? { ...emp, ...data } : emp
      ));
      
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Rimuovi collaboratore
  const removeEmployee = async (id: string) => {
    try {
      setError(null);
      await partnerEmployeeService.removeEmployee(id);
      
      // Rimuovi dalla lista locale
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Carica automaticamente all'inizio
  useEffect(() => {
    fetchEmployees();
  }, []);

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees,
    inviteEmployee,
    updateEmployee,
    resendInvite,
    removeEmployee
  };
};

export default usePartnerEmployees;