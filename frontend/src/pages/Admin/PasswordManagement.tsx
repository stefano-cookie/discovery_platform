import React, { useState } from 'react';
import ChangePasswordModal from '../../components/PasswordManagement/ChangePasswordModal';
import PasswordReset from '../../components/PasswordManagement/PasswordReset';
import './PasswordManagement.css';

const AdminPasswordManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'change' | 'reset'>('change');
  const [showChangeModal, setShowChangeModal] = useState(false);

  const handlePasswordChangeSuccess = () => {
    setShowChangeModal(false);
    // Could show a toast notification here
  };

  return (
    <div className="password-management-container">
      <h1>Gestione Password</h1>

      <div className="password-tabs">
        <button
          className={`tab-button ${activeTab === 'change' ? 'active' : ''}`}
          onClick={() => setActiveTab('change')}
        >
          Cambia Password
        </button>
        <button
          className={`tab-button ${activeTab === 'reset' ? 'active' : ''}`}
          onClick={() => setActiveTab('reset')}
        >
          Reset Password Utente
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'change' && (
          <div className="change-password-section">
            <p>Modifica la password del tuo account amministratore</p>
            <button
              className="btn-primary"
              onClick={() => setShowChangeModal(true)}
            >
              Cambia la mia Password
            </button>
          </div>
        )}

        {activeTab === 'reset' && <PasswordReset />}
      </div>

      <ChangePasswordModal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        onSuccess={handlePasswordChangeSuccess}
        userType="user"
      />
    </div>
  );
};

export default AdminPasswordManagement;
