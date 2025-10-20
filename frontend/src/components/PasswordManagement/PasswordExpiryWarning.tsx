import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './PasswordExpiryWarning.css';

interface PasswordExpiryWarningProps {
  onChangePasswordClick: () => void;
}

interface PasswordExpiryInfo {
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  isExpired: boolean;
  requiresChange: boolean;
}

const PasswordExpiryWarning: React.FC<PasswordExpiryWarningProps> = ({
  onChangePasswordClick
}) => {
  const [expiryInfo, setExpiryInfo] = useState<PasswordExpiryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkPasswordExpiration();
  }, []);

  const checkPasswordExpiration = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/password/check-expiration`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setExpiryInfo(response.data);
    } catch (error) {
      console.error('Error checking password expiration:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !expiryInfo || dismissed) {
    return null;
  }

  const { daysUntilExpiry, isExpired } = expiryInfo;

  // Don't show warning if password is not expiring soon (more than 30 days)
  if (!isExpired && (daysUntilExpiry === null || daysUntilExpiry > 30)) {
    return null;
  }

  const getWarningLevel = () => {
    if (isExpired) return 'critical';
    if (daysUntilExpiry !== null && daysUntilExpiry <= 3) return 'urgent';
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7) return 'high';
    return 'normal';
  };

  const warningLevel = getWarningLevel();

  const getWarningMessage = () => {
    if (isExpired) {
      return {
        title: 'Password Scaduta',
        message: 'La tua password è scaduta. Devi modificarla immediatamente per continuare ad accedere alla piattaforma.'
      };
    }

    if (daysUntilExpiry === 1) {
      return {
        title: 'Password in scadenza DOMANI',
        message: 'La tua password scadrà domani. Modificala ora per evitare interruzioni nell\'accesso.'
      };
    }

    return {
      title: `Password in scadenza tra ${daysUntilExpiry} giorni`,
      message: `La tua password scadrà tra ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'giorno' : 'giorni'}. Ti consigliamo di modificarla al più presto.`
    };
  };

  const warningContent = getWarningMessage();

  return (
    <div className={`password-expiry-warning ${warningLevel}`}>
      <div className="warning-content">
        <div className="warning-text">
          <h4>{warningContent.title}</h4>
          <p>{warningContent.message}</p>
        </div>
      </div>
      <div className="warning-actions">
        <button
          className="btn-change-password"
          onClick={onChangePasswordClick}
        >
          Cambia Password Ora
        </button>
        {!isExpired && (
          <button
            className="btn-dismiss"
            onClick={() => setDismissed(true)}
            title="Ricordami più tardi"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default PasswordExpiryWarning;
