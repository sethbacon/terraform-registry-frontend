import { Snackbar, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

/** Persistent top-of-viewport warning shown while the browser reports it is offline. */
const OfflineBanner: React.FC = () => {
  const { t } = useTranslation()
  const isOnline = useOnlineStatus()

  return (
    <Snackbar
      open={!isOnline}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: { xs: 8, sm: 16 } }}
    >
      <Alert severity="warning" variant="filled" role="status">
        {t('common.offlineWarning')}
      </Alert>
    </Snackbar>
  )
}

export default OfflineBanner
