import React, { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  FormControlLabel,
  FormHelperText,
  Switch,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import CloudIcon from '@mui/icons-material/Cloud'
import FolderIcon from '@mui/icons-material/Folder'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RefreshIcon from '@mui/icons-material/Refresh'
import InfoIcon from '@mui/icons-material/Info'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SyncIcon from '@mui/icons-material/Sync'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import api from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import type {
  StorageConfigResponse,
  StorageConfigInput,
  StorageBackendType,
  StorageMigration,
} from '../../types'
import { queryKeys } from '../../services/queryKeys'
import Page from '../../components/Page'
import StorageMigrationWizard from '../../components/StorageMigrationWizard'

const StoragePage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [migrationWizardOpen, setMigrationWizardOpen] = useState(false)
  const [showAddWizard, setShowAddWizard] = useState(false)

  // Wizard state
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<StorageConfigInput>({
    backend_type: 'local',
    local_base_path: './data/storage',
    local_serve_directly: true,
  })

  const steps = [
    t('admin.storage.stepSelectBackend'),
    t('admin.storage.stepConfigureSettings'),
    t('admin.storage.stepReviewSave'),
  ]

  const {
    data: storageData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: [...queryKeys.storageConfigs.list(), 'withSetup'],
    queryFn: async () => {
      const status = await api.getSetupStatus()
      let configs: StorageConfigResponse[] = []
      if (!status.setup_required) {
        const configList = await api.listStorageConfigs()
        configs = Array.isArray(configList) ? configList : []
      }
      return { setupStatus: status, configs }
    },
  })

  const setupStatus = storageData?.setupStatus ?? null
  const configs = storageData?.configs ?? []

  // Migration history query
  const { data: migrations = [] } = useQuery<StorageMigration[]>({
    queryKey: queryKeys.storageMigrations.list(),
    queryFn: () => api.listStorageMigrations(),
    enabled: !storageData?.setupStatus?.setup_required && configs.length > 0,
  })

  // Config action mutations
  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateStorageConfig(id),
    onSuccess: (data) => {
      setSuccess(data.message || t('admin.storage.msgActivated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.storageConfigs._def })
    },
    onError: (err) => setError(getErrorMessage(err, t('admin.storage.errActivate'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStorageConfig(id),
    onSuccess: () => {
      setSuccess(t('admin.storage.msgDeleted'))
      queryClient.invalidateQueries({ queryKey: queryKeys.storageConfigs._def })
    },
    onError: (err) => setError(getErrorMessage(err, t('admin.storage.errDelete'))),
  })

  const testMutation = useMutation({
    mutationFn: (config: StorageConfigResponse) => {
      // Build a StorageConfigInput from the response for testing
      const input: StorageConfigInput = { backend_type: config.backend_type }
      if (config.backend_type === 'local') {
        input.local_base_path = config.local_base_path
        input.local_serve_directly = config.local_serve_directly
      } else if (config.backend_type === 'azure') {
        input.azure_account_name = config.azure_account_name
        input.azure_container_name = config.azure_container_name
        input.azure_cdn_url = config.azure_cdn_url
      } else if (config.backend_type === 's3') {
        input.s3_bucket = config.s3_bucket
        input.s3_region = config.s3_region
        input.s3_endpoint = config.s3_endpoint
        input.s3_auth_method = config.s3_auth_method
      } else if (config.backend_type === 'gcs') {
        input.gcs_bucket = config.gcs_bucket
        input.gcs_project_id = config.gcs_project_id
        input.gcs_auth_method = config.gcs_auth_method
        input.gcs_endpoint = config.gcs_endpoint
      }
      return api.testStorageConfig(input)
    },
    onSuccess: (result) => {
      if (result.success) {
        setSuccess(t('admin.storage.msgTestPassed'))
      } else {
        setError(result.message || t('admin.storage.errTestFailed'))
      }
    },
    onError: (err) => setError(getErrorMessage(err, t('admin.storage.errConfigTest'))),
  })

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.storage.errLoad')))
  }

  const handleBackendChange = (type: StorageBackendType) => {
    const newFormData: StorageConfigInput = { backend_type: type }

    switch (type) {
      case 'local':
        newFormData.local_base_path = './data/storage'
        newFormData.local_serve_directly = true
        break
      case 'azure':
        newFormData.azure_account_name = ''
        newFormData.azure_account_key = ''
        newFormData.azure_container_name = ''
        break
      case 's3':
        newFormData.s3_region = 'us-east-1'
        newFormData.s3_bucket = ''
        newFormData.s3_auth_method = 'default'
        break
      case 'gcs':
        newFormData.gcs_bucket = ''
        newFormData.gcs_auth_method = 'default'
        break
    }

    setFormData(newFormData)
  }

  const handleTestConfig = async () => {
    try {
      setTesting(true)
      setError(null)
      const result = await api.testStorageConfig(formData)
      if (result.success) {
        setSuccess(t('admin.storage.msgValid'))
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.storage.errConfigTest')))
    } finally {
      setTesting(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      setError(null)
      await api.createStorageConfig(formData)
      setSuccess(t('admin.storage.msgSaved'))
      queryClient.invalidateQueries({ queryKey: queryKeys.storageConfigs._def })
      setActiveStep(0)
      setShowAddWizard(false)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.storage.errSave')))
    } finally {
      setSaving(false)
    }
  }

  const getBackendIcon = (type: StorageBackendType) => {
    switch (type) {
      case 'local':
        return <FolderIcon />
      case 'azure':
      case 's3':
      case 'gcs':
        return <CloudIcon />
      default:
        return <StorageIcon />
    }
  }

  const getBackendLabel = (type: StorageBackendType) => {
    switch (type) {
      case 'local':
        return 'Local File System'
      case 'azure':
        return 'Azure Blob Storage'
      case 's3':
        return 'Amazon S3 / S3-Compatible'
      case 'gcs':
        return 'Google Cloud Storage'
      default:
        return type
    }
  }

  const renderBackendSelection = () => (
    <Grid container spacing={3}>
      {(['local', 'azure', 's3', 'gcs'] as StorageBackendType[]).map((type) => (
        <Grid size={{ xs: 12, sm: 6 }} key={type}>
          <Card
            sx={{
              cursor: 'pointer',
              border: formData.backend_type === type ? 2 : 1,
              borderColor: formData.backend_type === type ? 'primary.main' : 'divider',
              '&:hover': { borderColor: 'primary.light' },
            }}
            onClick={() => handleBackendChange(type)}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                {getBackendIcon(type)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {getBackendLabel(type)}
                </Typography>
                {formData.backend_type === type && (
                  <CheckCircleIcon color="primary" sx={{ ml: 'auto' }} />
                )}
              </Box>
              <Typography variant="body2" color="textSecondary">
                {type === 'local' && t('admin.storage.descLocal')}
                {type === 'azure' && t('admin.storage.descAzure')}
                {type === 's3' && t('admin.storage.descS3')}
                {type === 'gcs' && t('admin.storage.descGcs')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )

  const renderLocalSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label={t('admin.storage.labelBasePath')}
        fullWidth
        value={formData.local_base_path || ''}
        onChange={(e) => setFormData({ ...formData, local_base_path: e.target.value })}
        helperText={t('admin.storage.helpBasePath')}
        required
      />
      <FormControlLabel
        control={
          <Switch
            checked={formData.local_serve_directly ?? true}
            onChange={(e) => setFormData({ ...formData, local_serve_directly: e.target.checked })}
          />
        }
        label={t('admin.storage.labelServeDirectly')}
      />
    </Box>
  )

  const renderAzureSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label={t('admin.storage.labelAccountName')}
        fullWidth
        value={formData.azure_account_name || ''}
        onChange={(e) => setFormData({ ...formData, azure_account_name: e.target.value })}
        required
        helperText={t('admin.storage.helpAccountName')}
      />
      <TextField
        label={t('admin.storage.labelAccountKey')}
        type="password"
        fullWidth
        value={formData.azure_account_key || ''}
        onChange={(e) => setFormData({ ...formData, azure_account_key: e.target.value })}
        required
        helperText={t('admin.storage.helpAccountKey')}
      />
      <TextField
        label={t('admin.storage.labelContainerName')}
        fullWidth
        value={formData.azure_container_name || ''}
        onChange={(e) => setFormData({ ...formData, azure_container_name: e.target.value })}
        required
        helperText={t('admin.storage.helpContainerName')}
      />
      <TextField
        label={t('admin.storage.labelCdnUrl')}
        fullWidth
        value={formData.azure_cdn_url || ''}
        onChange={(e) => setFormData({ ...formData, azure_cdn_url: e.target.value })}
        helperText={t('admin.storage.helpCdnUrl')}
      />
    </Box>
  )

  const renderS3Settings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label={t('admin.storage.labelBucket')}
        fullWidth
        value={formData.s3_bucket || ''}
        onChange={(e) => setFormData({ ...formData, s3_bucket: e.target.value })}
        required
        helperText={t('admin.storage.helpS3Bucket')}
      />
      <TextField
        label={t('admin.storage.labelRegion')}
        fullWidth
        value={formData.s3_region || ''}
        onChange={(e) => setFormData({ ...formData, s3_region: e.target.value })}
        required
        helperText={t('admin.storage.helpS3Region')}
      />
      <TextField
        label={t('admin.storage.labelEndpointOptional')}
        fullWidth
        value={formData.s3_endpoint || ''}
        onChange={(e) => setFormData({ ...formData, s3_endpoint: e.target.value })}
        helperText={t('admin.storage.helpS3Endpoint')}
      />
      <FormControl fullWidth>
        <InputLabel>{t('admin.storage.labelAuthMethod')}</InputLabel>
        <Select
          value={formData.s3_auth_method || 'default'}
          label={t('admin.storage.labelAuthMethod')}
          onChange={(e) => setFormData({ ...formData, s3_auth_method: e.target.value })}
        >
          <MenuItem value="default">{t('admin.storage.s3AuthDefault')}</MenuItem>
          <MenuItem value="static">{t('admin.storage.s3AuthStatic')}</MenuItem>
          <MenuItem value="oidc">{t('admin.storage.s3AuthOidc')}</MenuItem>
          <MenuItem value="assume_role">{t('admin.storage.s3AuthAssumeRole')}</MenuItem>
        </Select>
        <FormHelperText>{t('admin.storage.helpS3Auth')}</FormHelperText>
      </FormControl>

      {formData.s3_auth_method === 'static' && (
        <>
          <TextField
            label={t('admin.storage.labelAccessKeyId')}
            fullWidth
            value={formData.s3_access_key_id || ''}
            onChange={(e) => setFormData({ ...formData, s3_access_key_id: e.target.value })}
            required
            helperText={t('admin.storage.helpAccessKeyId')}
          />
          <TextField
            label={t('admin.storage.labelSecretAccessKey')}
            type="password"
            fullWidth
            value={formData.s3_secret_access_key || ''}
            onChange={(e) => setFormData({ ...formData, s3_secret_access_key: e.target.value })}
            required
            helperText={t('admin.storage.helpSecretAccessKey')}
          />
        </>
      )}

      {(formData.s3_auth_method === 'oidc' || formData.s3_auth_method === 'assume_role') && (
        <>
          <TextField
            label={t('admin.storage.labelRoleArn')}
            fullWidth
            value={formData.s3_role_arn || ''}
            onChange={(e) => setFormData({ ...formData, s3_role_arn: e.target.value })}
            required
            helperText={t('admin.storage.helpRoleArn')}
          />
          <TextField
            label={t('admin.storage.labelRoleSessionName')}
            fullWidth
            value={formData.s3_role_session_name || ''}
            onChange={(e) => setFormData({ ...formData, s3_role_session_name: e.target.value })}
          />
        </>
      )}

      {formData.s3_auth_method === 'oidc' && (
        <TextField
          label={t('admin.storage.labelWebIdentityTokenFile')}
          fullWidth
          value={formData.s3_web_identity_token_file || ''}
          onChange={(e) => setFormData({ ...formData, s3_web_identity_token_file: e.target.value })}
          helperText={t('admin.storage.helpWebIdentityTokenFile')}
        />
      )}

      {formData.s3_auth_method === 'assume_role' && (
        <TextField
          label={t('admin.storage.labelExternalId')}
          fullWidth
          value={formData.s3_external_id || ''}
          onChange={(e) => setFormData({ ...formData, s3_external_id: e.target.value })}
          helperText={t('admin.storage.helpExternalId')}
        />
      )}
    </Box>
  )

  const renderGCSSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label={t('admin.storage.labelBucket')}
        fullWidth
        value={formData.gcs_bucket || ''}
        onChange={(e) => setFormData({ ...formData, gcs_bucket: e.target.value })}
        required
      />
      <TextField
        label={t('admin.storage.labelProjectIdOptional')}
        fullWidth
        value={formData.gcs_project_id || ''}
        onChange={(e) => setFormData({ ...formData, gcs_project_id: e.target.value })}
        helperText={t('admin.storage.helpGcsProjectId')}
      />
      <FormControl fullWidth>
        <InputLabel>{t('admin.storage.labelAuthMethod')}</InputLabel>
        <Select
          value={formData.gcs_auth_method || 'default'}
          label={t('admin.storage.labelAuthMethod')}
          onChange={(e) => setFormData({ ...formData, gcs_auth_method: e.target.value })}
        >
          <MenuItem value="default">{t('admin.storage.gcsAuthDefault')}</MenuItem>
          <MenuItem value="service_account">{t('admin.storage.gcsAuthServiceAccount')}</MenuItem>
          <MenuItem value="workload_identity">
            {t('admin.storage.gcsAuthWorkloadIdentity')}
          </MenuItem>
        </Select>
        <FormHelperText>{t('admin.storage.helpGcsAuth')}</FormHelperText>
      </FormControl>

      {formData.gcs_auth_method === 'service_account' && (
        <>
          <TextField
            label={t('admin.storage.labelCredentialsFile')}
            fullWidth
            value={formData.gcs_credentials_file || ''}
            onChange={(e) => setFormData({ ...formData, gcs_credentials_file: e.target.value })}
            helperText={t('admin.storage.helpCredentialsFile')}
          />
          <TextField
            label={t('admin.storage.labelCredentialsJson')}
            fullWidth
            multiline
            rows={4}
            value={formData.gcs_credentials_json || ''}
            onChange={(e) => setFormData({ ...formData, gcs_credentials_json: e.target.value })}
            helperText={t('admin.storage.helpCredentialsJson')}
          />
        </>
      )}

      <TextField
        label={t('admin.storage.labelEndpointOptional')}
        fullWidth
        value={formData.gcs_endpoint || ''}
        onChange={(e) => setFormData({ ...formData, gcs_endpoint: e.target.value })}
        helperText={t('admin.storage.helpGcsEndpoint')}
      />
    </Box>
  )

  const renderSettingsForm = () => {
    switch (formData.backend_type) {
      case 'local':
        return renderLocalSettings()
      case 'azure':
        return renderAzureSettings()
      case 's3':
        return renderS3Settings()
      case 'gcs':
        return renderGCSSettings()
      default:
        return null
    }
  }

  const renderReview = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('admin.storage.configSummary')}
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={4}>
            <Typography variant="body2" color="textSecondary">
              {t('admin.storage.backendType')}
            </Typography>
          </Grid>
          <Grid size={8}>
            <Typography variant="body1">{getBackendLabel(formData.backend_type)}</Typography>
          </Grid>

          {formData.backend_type === 'local' && (
            <>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.labelBasePath')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.local_base_path}</Typography>
              </Grid>
            </>
          )}

          {formData.backend_type === 'azure' && (
            <>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.labelAccountName')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.azure_account_name}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.container')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.azure_container_name}</Typography>
              </Grid>
            </>
          )}

          {formData.backend_type === 's3' && (
            <>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.labelBucket')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.s3_bucket}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.labelRegion')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.s3_region}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.authMethod')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.s3_auth_method || 'default'}</Typography>
              </Grid>
            </>
          )}

          {formData.backend_type === 'gcs' && (
            <>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.labelBucket')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.gcs_bucket}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.storage.authMethod')}
                </Typography>
              </Grid>
              <Grid size={8}>
                <Typography variant="body1">{formData.gcs_auth_method || 'default'}</Typography>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
        }}
      >
        <Button
          variant="outlined"
          onClick={handleTestConfig}
          disabled={testing}
          startIcon={testing ? <CircularProgress size={20} /> : <RefreshIcon />}
        >
          {t('admin.storage.testConfiguration')}
        </Button>
      </Box>
    </Box>
  )

  const renderSetupWizard = () => (
    <Page maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        {showAddWizard ? t('admin.storage.titleAdd') : t('admin.storage.titleConfigure')}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
          marginBottom: '16px',
        }}
      >
        {showAddWizard ? t('admin.storage.subtitleAdd') : t('admin.storage.subtitleConfigure')}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        {activeStep === 0 && renderBackendSelection()}
        {activeStep === 1 && renderSettingsForm()}
        {activeStep === 2 && renderReview()}
      </Paper>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button disabled={activeStep === 0} onClick={() => setActiveStep((prev) => prev - 1)}>
            {t('admin.storage.back')}
          </Button>
          {showAddWizard && (
            <Button
              onClick={() => {
                setShowAddWizard(false)
                setActiveStep(0)
              }}
            >
              {t('admin.storage.cancel')}
            </Button>
          )}
        </Box>
        <Box>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSaveConfig}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            >
              {t('admin.storage.saveConfiguration')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setActiveStep((prev) => prev + 1)}>
              {t('admin.storage.next')}
            </Button>
          )}
        </Box>
      </Box>
    </Page>
  )

  const renderExistingConfigs = () => (
    <Page maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">{t('admin.storage.storageSettings')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {configs.length >= 2 ? (
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={() => setMigrationWizardOpen(true)}
            >
              {t('admin.storage.migrateData')}
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveStep(0)
                setShowAddWizard(true)
              }}
            >
              {t('admin.storage.addConfiguration')}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.storageConfigs._def })
            }
          >
            {t('admin.storage.refresh')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <InfoIcon sx={{ mr: 1 }} />
          {t('admin.storage.infoConfigured')}
        </Box>
      </Alert>

      {configs.length === 1 && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<SyncIcon />}>
          {t('admin.storage.infoMigrateHintBefore')}
          <strong>{t('admin.storage.addConfiguration')}</strong>
          {t('admin.storage.infoMigrateHintAfter')}
        </Alert>
      )}

      <Grid container spacing={3}>
        {configs.map((config) => (
          <Grid size={{ xs: 12, md: 6 }} key={config.id}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  {getBackendIcon(config.backend_type)}
                  <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                    {getBackendLabel(config.backend_type)}
                  </Typography>
                  <Chip
                    label={
                      config.is_active ? t('admin.storage.active') : t('admin.storage.inactive')
                    }
                    color={config.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Divider sx={{ my: 1 }} />

                {config.backend_type === 'local' && (
                  <Typography variant="body2" color="textSecondary">
                    {t('admin.storage.cardPath', { path: config.local_base_path })}
                  </Typography>
                )}

                {config.backend_type === 'azure' && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardAccount', { account: config.azure_account_name })}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardContainer', { container: config.azure_container_name })}
                    </Typography>
                  </>
                )}

                {config.backend_type === 's3' && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardBucket', { bucket: config.s3_bucket })}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardRegion', { region: config.s3_region })}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardAuth', { auth: config.s3_auth_method || 'default' })}
                    </Typography>
                  </>
                )}

                {config.backend_type === 'gcs' && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardBucket', { bucket: config.gcs_bucket })}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('admin.storage.cardAuth', { auth: config.gcs_auth_method || 'default' })}
                    </Typography>
                  </>
                )}

                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{
                    display: 'block',
                    mt: 2,
                  }}
                >
                  {t('admin.storage.cardUpdated', {
                    date: new Date(config.updated_at).toLocaleString(),
                  })}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                <Tooltip title={t('admin.storage.tooltipTestConnection')}>
                  <IconButton
                    size="small"
                    onClick={() => testMutation.mutate(config)}
                    disabled={testMutation.isPending}
                    aria-label={t('admin.storage.ariaTest', {
                      backend: getBackendLabel(config.backend_type),
                    })}
                  >
                    <PlayArrowIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {!config.is_active && (
                  <Tooltip title={t('admin.storage.tooltipActivate')}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => activateMutation.mutate(config.id)}
                      disabled={activateMutation.isPending}
                      aria-label={t('admin.storage.ariaActivate', {
                        backend: getBackendLabel(config.backend_type),
                      })}
                    >
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {!config.is_active && (
                  <Tooltip title={t('admin.storage.tooltipDelete')}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(t('admin.storage.confirmDelete'))) {
                          deleteMutation.mutate(config.id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      aria-label={t('admin.storage.ariaDelete', {
                        backend: getBackendLabel(config.backend_type),
                      })}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Migration History */}
      {migrations.length > 0 && (
        <Accordion sx={{ mt: 4 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <HistoryIcon />
              <Typography variant="h6">{t('admin.storage.migrationHistory')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.storage.thStatus')}</TableCell>
                    <TableCell>{t('admin.storage.thSource')}</TableCell>
                    <TableCell>{t('admin.storage.thTarget')}</TableCell>
                    <TableCell align="right">{t('admin.storage.thMigrated')}</TableCell>
                    <TableCell align="right">{t('admin.storage.thFailed')}</TableCell>
                    <TableCell>{t('admin.storage.thStarted')}</TableCell>
                    <TableCell>{t('admin.storage.thCompleted')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {migrations.map((m) => {
                    const src = configs.find((c) => c.id === m.source_config_id)
                    const tgt = configs.find((c) => c.id === m.target_config_id)
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Chip
                            label={m.status}
                            size="small"
                            color={
                              m.status === 'completed'
                                ? 'success'
                                : m.status === 'failed'
                                  ? 'error'
                                  : m.status === 'running'
                                    ? 'info'
                                    : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {src ? getBackendLabel(src.backend_type) : m.source_config_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {tgt ? getBackendLabel(tgt.backend_type) : m.target_config_id.slice(0, 8)}
                        </TableCell>
                        <TableCell align="right">
                          {m.migrated_artifacts} / {m.total_artifacts}
                        </TableCell>
                        <TableCell align="right">{m.failed_artifacts}</TableCell>
                        <TableCell>
                          {m.started_at ? new Date(m.started_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          {m.completed_at ? new Date(m.completed_at).toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Migration Wizard Dialog */}
      <StorageMigrationWizard
        open={migrationWizardOpen}
        onClose={() => setMigrationWizardOpen(false)}
        configs={configs}
      />
    </Page>
  )

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      ) : setupStatus?.setup_required || showAddWizard ? (
        renderSetupWizard()
      ) : (
        renderExistingConfigs()
      )}
    </Box>
  )
}

export default StoragePage
