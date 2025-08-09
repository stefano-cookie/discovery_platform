import React from 'react';
import { PartnerUser } from '../../../types/partner';

interface UserInfoProps {
  user: PartnerUser;
}

const UserInfo: React.FC<UserInfoProps> = ({ user }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const calculatePaymentDeadlines = (enrollmentDate: string, installments: number) => {
    const enrollment = new Date(enrollmentDate);
    const deadlines = [];

    if (installments === 1) {
      // Pagamento unico: 7 giorni da iscrizione
      const deadline = new Date(enrollment);
      deadline.setDate(deadline.getDate() + 7);
      deadlines.push({
        type: 'Pagamento Unico',
        date: deadline,
        amount: user.finalAmount
      });
    } else {
      // Determina se è TFA o Certificazione
      const isTFA = user.offerType === 'TFA_ROMANIA';
      
      let remainingAmount = user.finalAmount;
      let installmentAmount = 0;
      let baseDate = new Date(enrollment);
      baseDate.setDate(baseDate.getDate() + 7);
      
      if (isTFA) {
        // Solo TFA ha l'acconto di €1500
        const downPaymentAmount = 1500;
        deadlines.push({
          type: 'Acconto',
          date: new Date(baseDate),
          amount: downPaymentAmount
        });
        
        remainingAmount = user.finalAmount - downPaymentAmount;
        installmentAmount = Math.round(remainingAmount / installments);
        
        // Per TFA, le rate iniziano 30 giorni dopo l'acconto
        baseDate.setDate(baseDate.getDate() + 30);
      } else {
        // Per certificazioni e altri: nessun acconto, solo rate uguali
        installmentAmount = Math.round(user.finalAmount / installments);
      }
      
      // Genera le rate
      for (let i = 1; i <= installments; i++) {
        const rateDate = new Date(baseDate);
        if (i > 1) {
          rateDate.setMonth(rateDate.getMonth() + (i - 1));
          rateDate.setDate(30);
          
          // Se il 30 non esiste in quel mese, usa l'ultimo giorno del mese
          if (rateDate.getMonth() !== baseDate.getMonth() + (i - 1)) {
            rateDate.setDate(0); // Ultimo giorno del mese precedente
          }
        }
        
        const isLast = i === installments;
        let amount = installmentAmount;
        
        // Per l'ultima rata, aggiusta per eventuali arrotondamenti
        if (isLast) {
          if (isTFA) {
            amount = remainingAmount - (installmentAmount * (installments - 1));
          } else {
            amount = user.finalAmount - (installmentAmount * (installments - 1));
          }
        }
        
        deadlines.push({
          type: i === 1 ? 'Prima Rata' : `${i}° Rata`,
          date: rateDate,
          amount: amount
        });
      }
    }

    return deadlines;
  };

  const paymentDeadlines = calculatePaymentDeadlines(user.enrollmentDate, user.installments);

  return (
    <div className="space-y-6">
      {/* Dati Anagrafici */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <span className="text-blue-600 font-bold text-lg">
              {user.profile ? user.profile.nome.charAt(0) : user.email.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dati Anagrafici</h3>
            <p className="text-sm text-gray-600">Informazioni personali dell'utente</p>
          </div>
        </div>

        {user.profile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
              <p className="mt-1 text-sm text-gray-900">{user.profile.nome} {user.profile.cognome}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Codice Fiscale</label>
              <p className="mt-1 text-sm text-gray-900 font-mono">{user.profile.codiceFiscale}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefono</label>
              <p className="mt-1 text-sm text-gray-900">{user.profile.telefono}</p>
            </div>
          </div>
        ) : (
          <div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{user.email}</p>
            </div>
            <p className="mt-2 text-sm text-yellow-600">
              ⚠️ Profilo incompleto - L'utente deve completare i dati anagrafici
            </p>
          </div>
        )}
      </div>

      {/* Dettagli Iscrizione */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dettagli Corso</h3>
            <p className="text-sm text-gray-600">Informazioni sull'iscrizione</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Corso</label>
            <p className="mt-1 text-sm text-gray-900 font-medium">{user.course || 'Non specificato'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo Offerta</label>
            <p className="mt-1 text-sm text-gray-900">{user.offerType}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Iscrizione</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(user.enrollmentDate)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Partner</label>
            <p className="mt-1 text-sm text-gray-900">
              {user.isDirectUser ? 'Diretto' : `Tramite ${user.partnerName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Dettagli Pagamento */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Piano Pagamenti</h3>
            <p className="text-sm text-gray-600">Dettagli economici dell'iscrizione</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Importo Originale</label>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(user.originalAmount)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Importo Finale</label>
            <p className="mt-1 text-lg font-semibold text-green-600">{formatCurrency(user.finalAmount)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rate</label>
            <p className="mt-1 text-sm text-gray-900">{user.installments} {user.installments === 1 ? 'rata' : 'rate'}</p>
          </div>
        </div>

        {user.originalAmount !== user.finalAmount && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-800 font-medium">
                Sconto applicato: {formatCurrency(user.originalAmount - user.finalAmount)}
              </span>
            </div>
          </div>
        )}

        {/* Scadenze Pagamenti */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Scadenze Pagamenti</h4>
          <div className="space-y-3">
            {paymentDeadlines.map((deadline, index) => {
              const isOverdue = new Date(deadline.date) < new Date() && user.status !== 'COMPLETED';
              const isCurrent = new Date(deadline.date) >= new Date() && new Date(deadline.date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isOverdue 
                      ? 'bg-red-50 border-red-200' 
                      : isCurrent 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      isOverdue 
                        ? 'bg-red-100 text-red-600' 
                        : isCurrent 
                          ? 'bg-yellow-100 text-yellow-600' 
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        isOverdue ? 'text-red-900' : isCurrent ? 'text-yellow-900' : 'text-gray-900'
                      }`}>
                        {deadline.type}
                      </p>
                      <p className={`text-xs ${
                        isOverdue ? 'text-red-600' : isCurrent ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        Scadenza: {formatDate(deadline.date.toISOString())}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      isOverdue ? 'text-red-900' : isCurrent ? 'text-yellow-900' : 'text-gray-900'
                    }`}>
                      {formatCurrency(deadline.amount)}
                    </p>
                    {isOverdue && (
                      <p className="text-xs text-red-600 font-medium">In ritardo</p>
                    )}
                    {isCurrent && (
                      <p className="text-xs text-yellow-600 font-medium">In scadenza</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;