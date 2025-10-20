import React, { useState } from 'react';
import axios from 'axios';
import './ChangePasswordModal.css';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userType: 'user' | 'partner';
  userId?: string; // For partner employees
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userType,
  userId
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const passwordRequirements = [
    { text: 'Almeno 8 caratteri', valid: newPassword.length >= 8 },
    { text: 'Almeno una lettera maiuscola', valid: /[A-Z]/.test(newPassword) },
    { text: 'Almeno una lettera minuscola', valid: /[a-z]/.test(newPassword) },
    { text: 'Almeno un numero', valid: /\d/.test(newPassword) }
  ];

  const isValidPassword = passwordRequirements.every(req => req.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Compila tutti i campi');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (!isValidPassword) {
      setError('La nuova password non soddisfa i requisiti di sicurezza');
      return;
    }

    setLoading(true);

    try {
      const endpoint = userType === 'user'
        ? '/password/user/change-password'
        : '/password/partner/change-password';

      const payload = userType === 'user'
        ? { currentPassword, newPassword }
        : { currentPassword, newPassword, partnerEmployeeId: userId };

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}${endpoint}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        setShowSuccess(true);
        // Auto-close success modal after 2 seconds
        setTimeout(() => {
          setShowSuccess(false);
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Errore durante il cambio password. Riprova più tardi.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="change-password-modal-overlay" onClick={handleClose}>
      <div className="change-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cambia Password</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="change-password-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="currentPassword">Password Corrente</label>
            <input
              id="currentPassword"
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Inserisci la password corrente"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">Nuova Password</label>
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Inserisci la nuova password"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Conferma Nuova Password</label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Conferma la nuova password"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label flex-1">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Mostra password
            </label>
          </div>

          {newPassword && (
            <div className="password-requirements">
              <h4>Requisiti password:</h4>
              <ul>
                {passwordRequirements.map((req, index) => (
                  <li key={index} className={req.valid ? 'valid' : 'invalid'}>
                    <span className="icon">{req.valid ? '✓' : '○'}</span>
                    {req.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="info-box">
            <p>
              <strong>Nota importante:</strong> La nuova password scadrà tra <strong>90 giorni</strong>.
              Riceverai promemoria via email quando sarà prossima alla scadenza.
            </p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn-cancel"
              disabled={loading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading || !isValidPassword || newPassword !== confirmPassword}
            >
              {loading ? 'Salvataggio...' : 'Cambia Password'}
            </button>
          </div>
        </form>

        {/* Success Modal Overlay */}
        {showSuccess && (
          <div className="success-overlay">
            <div className="success-modal">
              <div className="success-icon">
                <svg className="checkmark" viewBox="0 0 52 52">
                  <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                  <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
              <h3 className="success-title">Password Modificata!</h3>
              <p className="success-message">
                La tua password è stata cambiata con successo.
                <br />
                La nuova password scadrà tra 90 giorni.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
