import React from 'react';
import { Box, Typography, Alert, AlertTitle, TextField, InputAdornment, CircularProgress, Button } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSetupWizard } from '../../../contexts/SetupWizardContext';

const AuthenticateStep: React.FC = () => {
  const { setupToken, setSetupToken, tokenValidating, tokenValid, validateToken } = useSetupWizard();
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">Setup Token</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the setup token that was printed to the server logs when the registry started.
        Look for a line containing <code>tfr_setup_</code> in your server output.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Finding your setup token</AlertTitle>
        The token is printed once at startup in a framed box. It looks like:{' '}
        <Box component="code" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
          tfr_setup_aBcDeFgHiJkLmNoPqRsTuVwXyZ...
        </Box>
        If <code>SETUP_TOKEN_FILE</code> is set, it&apos;s also written to that file.
      </Alert>

      <TextField
        fullWidth
        label="Setup Token"
        value={setupToken}
        onChange={(e) => setSetupToken(e.target.value)}
        placeholder="tfr_setup_..."
        type="password"
        sx={{ mb: 2 }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {tokenValid && <CheckCircleIcon color="success" />}
            </InputAdornment>
          ),
        }}
      />

      <Button
        variant="contained"
        onClick={validateToken}
        disabled={!setupToken.trim() || tokenValidating}
        fullWidth
        size="large"
      >
        {tokenValidating ? <CircularProgress size={24} /> : 'Verify Token'}
      </Button>
    </Box>
  );
};

export default AuthenticateStep;
