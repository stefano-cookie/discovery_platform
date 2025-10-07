import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  QrCode2,
  Security,
  SaveAlt,
  ContentCopy,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import api from '../../../services/api';

interface TwoFactorSetupData {
  qrCode: string; // Data URL del QR code
  secret: string; // Secret per manual entry
  recoveryCodes: string[]; // Recovery codes da salvare
}

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel?: () => void;
}

const steps = ['Scansiona QR Code', 'Verifica Codice', 'Salva Recovery Codes'];

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup data
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Recovery codes copied state
  const [codesCopied, setCodesCopied] = useState(false);
  const [codesDownloaded, setCodesDownloaded] = useState(false);

  // Step 1: Generate setup
  useEffect(() => {
    if (activeStep === 0) {
      initializeSetup();
    }
  }, [activeStep]);

  const initializeSetup = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/2fa/setup');

      setSetupData({
        qrCode: response.data.data.qrCode,
        secret: response.data.data.secret,
        recoveryCodes: response.data.data.recoveryCodes,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante inizializzazione 2FA');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and enable 2FA
  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Il codice deve essere di 6 cifre');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post('/auth/2fa/verify-setup', {
        secret: setupData!.secret,
        code: verificationCode,
        recoveryCodes: setupData!.recoveryCodes,
      });

      // Success - move to next step
      setActiveStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Codice non valido. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  // Copy secret to clipboard
  const handleCopySecret = () => {
    navigator.clipboard.writeText(setupData!.secret);
    setShowSecret(true);
  };

  // Copy recovery codes to clipboard
  const handleCopyRecoveryCodes = () => {
    const codesText = setupData!.recoveryCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCodesCopied(true);
  };

  // Download recovery codes as text file
  const handleDownloadRecoveryCodes = () => {
    const codesText = setupData!.recoveryCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'discovery-2fa-recovery-codes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCodesDownloaded(true);
  };

  // Complete setup
  const handleComplete = () => {
    onComplete();
  };

  if (!setupData && loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth={800} mx="auto" py={4}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Security fontSize="large" color="primary" sx={{ mr: 2 }} />
          <Typography variant="h4" component="h1">
            Configurazione Autenticazione a Due Fattori
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* STEP 1: Scan QR Code */}
        {activeStep === 0 && setupData && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy, Microsoft Authenticator, ecc.)
              </Typography>
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom align="center">
                      <QrCode2 sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Scansiona con App
                    </Typography>
                    <Box display="flex" justifyContent="center" my={2}>
                      <img
                        src={setupData.qrCode}
                        alt="QR Code 2FA"
                        style={{ maxWidth: '100%', height: 'auto' }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Oppure Inserisci Manualmente
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Se non riesci a scansionare il QR code, inserisci questo codice nella tua app:
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'grey.100',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        position: 'relative'
                      }}
                    >
                      <Typography variant="body2">
                        {showSecret ? setupData.secret : '••••••••••••••••'}
                      </Typography>
                      <Tooltip title="Copia Secret">
                        <IconButton
                          size="small"
                          onClick={handleCopySecret}
                          sx={{ position: 'absolute', top: 8, right: 8 }}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Account: Discovery Platform
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box display="flex" justifyContent="space-between" mt={4}>
              {onCancel && (
                <Button onClick={onCancel} disabled={loading}>
                  Annulla
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={loading}
              >
                Continua
              </Button>
            </Box>
          </Box>
        )}

        {/* STEP 2: Verify Code */}
        {activeStep === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Inserisci il codice a 6 cifre mostrato dalla tua app di autenticazione per verificare la configurazione.
            </Alert>

            <TextField
              fullWidth
              label="Codice di Verifica (6 cifre)"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              autoFocus
              inputProps={{
                maxLength: 6,
                pattern: '[0-9]*',
                inputMode: 'numeric',
                style: { fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5rem' }
              }}
              sx={{ mb: 3 }}
            />

            <Box display="flex" justifyContent="space-between">
              <Button onClick={() => setActiveStep(0)} disabled={loading}>
                Indietro
              </Button>
              <Button
                variant="contained"
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
                startIcon={loading && <CircularProgress size={20} />}
              >
                Verifica e Attiva 2FA
              </Button>
            </Box>
          </Box>
        )}

        {/* STEP 3: Save Recovery Codes */}
        {activeStep === 2 && setupData && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                ⚠️ Salva questi codici di recupero in un posto sicuro!
              </Typography>
              <Typography variant="body2">
                Ogni codice può essere usato una sola volta per accedere se perdi l'accesso alla tua app di autenticazione.
              </Typography>
            </Alert>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Codici di Recupero
                  </Typography>
                  <Box>
                    <Tooltip title="Copia Codici">
                      <IconButton onClick={handleCopyRecoveryCodes} size="small">
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Scarica Codici">
                      <IconButton onClick={handleDownloadRecoveryCodes} size="small">
                        <SaveAlt />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  {setupData.recoveryCodes.map((code, index) => (
                    <Grid item xs={6} key={index}>
                      <Box
                        sx={{
                          p: 1.5,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '1.1rem',
                          textAlign: 'center'
                        }}
                      >
                        {code}
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                {(codesCopied || codesDownloaded) && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ mr: 1 }} />
                      {codesCopied && 'Codici copiati negli appunti! '}
                      {codesDownloaded && 'Codici scaricati!'}
                    </Box>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Alert severity="info" sx={{ mb: 3 }}>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Info color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Questi codici non saranno più visibili dopo questa schermata"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Warning color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Ogni codice può essere usato una sola volta"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Security color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Conservali in un posto sicuro (password manager, cassetta sicurezza, ecc.)"
                  />
                </ListItem>
              </List>
            </Alert>

            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                size="large"
                onClick={handleComplete}
                startIcon={<CheckCircle />}
                disabled={!codesCopied && !codesDownloaded}
              >
                Completa Configurazione
              </Button>
            </Box>

            {!codesCopied && !codesDownloaded && (
              <Typography variant="caption" color="text.secondary" align="right" display="block" mt={1}>
                Devi copiare o scaricare i codici prima di continuare
              </Typography>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default TwoFactorSetup;
