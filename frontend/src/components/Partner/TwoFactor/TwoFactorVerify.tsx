import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Link,
  Collapse,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Security,
  PhoneAndroid,
  VpnKey,
  Timer,
} from '@mui/icons-material';
import api from '../../../services/api';

interface TwoFactorVerifyProps {
  sessionToken: string;
  onSuccess: (token: string, employee: any, partnerCompany: any) => void;
  onCancel?: () => void;
}

const TwoFactorVerify: React.FC<TwoFactorVerifyProps> = ({
  sessionToken,
  onSuccess,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Recovery code mode
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  // Session timeout (5 minutes)
  const [timeLeft, setTimeLeft] = useState(300); // 300 seconds = 5 minutes
  const [sessionExpired, setSessionExpired] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setSessionExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [useRecoveryCode]);

  // Format time left
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage for countdown
  const progressPercent = (timeLeft / 300) * 100;

  // Verify TOTP code
  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Il codice deve essere di 6 cifre');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/2fa/verify', {
        sessionToken,
        code,
      });

      // Success - call onSuccess with token and user data
      onSuccess(
        response.data.token,
        response.data.employee,
        response.data.employee.partnerCompany
      );
    } catch (err: any) {
      const errorData = err.response?.data;
      setError(errorData?.error || 'Codice non valido. Riprova.');

      if (errorData?.remainingAttempts !== undefined) {
        setRemainingAttempts(errorData.remainingAttempts);
      }

      setCode(''); // Clear code on error
    } finally {
      setLoading(false);
    }
  };

  // Verify recovery code
  const handleVerifyRecoveryCode = async () => {
    if (!recoveryCode.trim()) {
      setError('Inserisci un codice di recupero');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/2fa/recovery', {
        sessionToken,
        recoveryCode: recoveryCode.replace(/\s+/g, ''), // Remove spaces
      });

      // Success
      onSuccess(
        response.data.token,
        response.data.employee,
        response.data.employee.partnerCompany
      );

      // Check if warning about remaining recovery codes
      if (response.data.warning) {
        // Could show a toast notification here
        console.warn(response.data.warning);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Codice di recupero non valido');
      setRecoveryCode('');
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (useRecoveryCode) {
        handleVerifyRecoveryCode();
      } else if (code.length === 6) {
        handleVerifyCode();
      }
    }
  };

  if (sessionExpired) {
    return (
      <Box maxWidth={500} mx="auto" py={4}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Alert severity="error">
            <Typography variant="h6" gutterBottom>
              Sessione Scaduta
            </Typography>
            <Typography variant="body2">
              La sessione di verifica è scaduta dopo 5 minuti. Riprova ad effettuare il login.
            </Typography>
            <Box mt={2}>
              {onCancel && (
                <Button variant="contained" onClick={onCancel}>
                  Torna al Login
                </Button>
              )}
            </Box>
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box maxWidth={500} mx="auto" py={4}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Security fontSize="large" color="primary" sx={{ mb: 2 }} />
          <Typography variant="h5" component="h1" align="center" gutterBottom>
            Verifica in Due Passaggi
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Inserisci il codice dalla tua app di autenticazione
          </Typography>
        </Box>

        {/* Session Timeout Indicator */}
        <Box mb={3}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary">
              <Timer fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Tempo rimanente
            </Typography>
            <Typography
              variant="caption"
              color={timeLeft < 60 ? 'error' : 'text.secondary'}
              fontWeight="bold"
            >
              {formatTime(timeLeft)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            color={timeLeft < 60 ? 'error' : 'primary'}
          />
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setError(null)}
          >
            {error}
            {remainingAttempts !== null && remainingAttempts > 0 && (
              <Typography variant="caption" display="block" mt={1}>
                Tentativi rimanenti: {remainingAttempts}
              </Typography>
            )}
          </Alert>
        )}

        <Collapse in={!useRecoveryCode}>
          <Box>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <PhoneAndroid color="action" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Apri la tua app di autenticazione
              </Typography>
            </Box>

            <TextField
              fullWidth
              inputRef={inputRef}
              label="Codice a 6 cifre"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyPress={handleKeyPress}
              placeholder="000000"
              autoComplete="one-time-code"
              inputProps={{
                maxLength: 6,
                pattern: '[0-9]*',
                inputMode: 'numeric',
                style: {
                  fontSize: '2rem',
                  textAlign: 'center',
                  letterSpacing: '1rem',
                  fontWeight: 'bold'
                }
              }}
              sx={{ mb: 3 }}
              disabled={loading}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleVerifyCode}
              disabled={loading || code.length !== 6}
              startIcon={loading && <CircularProgress size={20} />}
              sx={{ mb: 2 }}
            >
              Verifica
            </Button>
          </Box>
        </Collapse>

        <Collapse in={useRecoveryCode}>
          <Box>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <VpnKey color="action" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Inserisci un codice di recupero
              </Typography>
            </Box>

            <TextField
              fullWidth
              inputRef={inputRef}
              label="Codice di Recupero"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="XXXX-YYYY"
              inputProps={{
                style: {
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  letterSpacing: '0.2rem'
                }
              }}
              sx={{ mb: 3 }}
              disabled={loading}
              helperText="Formato: XXXX-YYYY (8 caratteri)"
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleVerifyRecoveryCode}
              disabled={loading || !recoveryCode.trim()}
              startIcon={loading && <CircularProgress size={20} />}
              sx={{ mb: 2 }}
            >
              Verifica Codice di Recupero
            </Button>
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        <Box textAlign="center">
          {!useRecoveryCode ? (
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setUseRecoveryCode(true);
                setCode('');
                setError(null);
              }}
              disabled={loading}
            >
              Non hai accesso all'app? Usa un codice di recupero
            </Link>
          ) : (
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setUseRecoveryCode(false);
                setRecoveryCode('');
                setError(null);
              }}
              disabled={loading}
            >
              ← Torna al codice dall'app
            </Link>
          )}
        </Box>

        {onCancel && (
          <Box textAlign="center" mt={2}>
            <Button onClick={onCancel} disabled={loading}>
              Annulla
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default TwoFactorVerify;
