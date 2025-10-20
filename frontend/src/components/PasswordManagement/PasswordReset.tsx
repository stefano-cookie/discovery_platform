import React, { useState } from 'react';
import axios from 'axios';
import './PasswordReset.css';

const PasswordReset: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !email.includes('@')) {
      setError('Inserisci un indirizzo email valido');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/password-management/reset-user-password',
        { email },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccess(response.data.message || 'Email di reset password inviata con successo');
      setEmail('');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(
        err.response?.data?.error || 'Errore durante il reset della password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-reset-container">
      <div className="password-reset-card">
        <h2>Reset Password Utente</h2>
        <p className="description">
          Invia un'email di reset password a un utente. L'utente riceverà un link per
          reimpostare la propria password.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Utente</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="utente@example.com"
              className="form-input"
              required
            />
          </div>

          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <span className="alert-icon">✓</span>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Invio in corso...
              </>
            ) : (
              'Invia Email di Reset'
            )}
          </button>
        </form>

        <div className="info-box">
          <strong>📧 Nota:</strong>
          <p>
            L'email conterrà un link valido per 1 ora. Se l'utente non riceve l'email,
            controlla la cartella spam o verifica che l'indirizzo email sia corretto.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;
