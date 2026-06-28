import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  SelectChangeEvent,
  Card,
  CardActionArea,
  CardContent,
  LinearProgress,
} from '@mui/material'
import CloudUpload from '@mui/icons-material/CloudUpload'
import CloudDownload from '@mui/icons-material/CloudDownload'
import ArrowBack from '@mui/icons-material/ArrowBack'
import api from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/Extension'
import FileDropZone from '../../components/FileDropZone'

type ProviderMethod = 'choose' | 'upload' | 'mirror'

const ProviderUploadPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as {
    providerData?: { namespace: string; type: string }
    method?: ProviderMethod
  }
  const prefilledProvider = state?.providerData

  const [providerMethod, setProviderMethod] = useState<ProviderMethod>(
    state?.method ?? (prefilledProvider ? 'upload' : 'choose'),
  )

  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Provider upload state
  const [providerFile, setProviderFile] = useState<File | null>(null)
  const [providerNamespace, setProviderNamespace] = useState(prefilledProvider?.namespace || '')
  const [providerName, setProviderName] = useState(prefilledProvider?.type || '')
  const [providerVersion, setProviderVersion] = useState('')
  const [providerOS, setProviderOS] = useState('')
  const [providerArch, setProviderArch] = useState('')

  const handleProviderFileSelected = (file: File) => {
    setProviderFile(file)
    setError(null)
  }

  const handleProviderUpload = async () => {
    if (
      !providerFile ||
      !providerNamespace ||
      !providerName ||
      !providerVersion ||
      !providerOS ||
      !providerArch
    ) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(null)

      const formData = new FormData()
      formData.append('namespace', providerNamespace)
      formData.append('type', providerName)
      formData.append('version', providerVersion)
      formData.append('os', providerOS)
      formData.append('arch', providerArch)
      formData.append('file', providerFile)

      setUploadPercent(0)
      await api.uploadProvider(formData, {
        onUploadProgress: (percent) => setUploadPercent(percent),
      })

      navigate(`/providers/${providerNamespace}/${providerName}`)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload provider. Please try again.'))
      setUploading(false)
      setUploadPercent(null)
    }
  }

  const renderProviderMethodChooser = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('admin.providerUpload.chooseTitle')}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t('admin.providerUpload.chooseSubtitle')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea sx={{ height: '100%' }} onClick={() => setProviderMethod('upload')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('admin.providerUpload.manualUpload')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.providerUpload.manualUploadDesc')}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'secondary.main', boxShadow: 2 } }}
        >
          <CardActionArea
            sx={{ height: '100%' }}
            onClick={() => navigate('/admin/mirrors?action=add')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CloudDownload sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('admin.providerUpload.providerMirror')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.providerUpload.providerMirrorDesc')}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  )

  const renderFileUploadForm = () => (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => {
          setProviderMethod('choose')
          setError(null)
          setSuccess(null)
        }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>
      <Typography variant="h6" gutterBottom>
        {t('admin.providerUpload.formTitle')}
      </Typography>
      <Box
        sx={{
          mb: 3,
          p: 2,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50'),
          borderRadius: 1,
        }}
      >
        <Typography
          variant="body2"
          gutterBottom
          sx={{
            color: 'text.secondary',
          }}
        >
          <strong>Requirements:</strong>
        </Typography>
        <Typography
          variant="body2"
          component="div"
          sx={{
            color: 'text.secondary',
          }}
        >
          • Package provider binary as a <strong>.zip</strong> file
          <br />
          • Upload each OS/Architecture combination separately
          <br />
          • Use semantic versioning matching the binary version
          <br />• Filename should be: <strong>terraform-provider-NAME_VERSION_OS_ARCH.zip</strong>
          <br />• Provider address format: <strong>namespace/type</strong>
        </Typography>
      </Box>

      <Stack spacing={3}>
        <TextField
          label={t('admin.providerUpload.labelNamespace')}
          value={providerNamespace}
          onChange={(e) => setProviderNamespace(e.target.value)}
          placeholder="e.g., myorg"
          required
          fullWidth
          helperText={t('admin.providerUpload.helpNamespace')}
        />
        <TextField
          label={t('admin.providerUpload.labelProviderName')}
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="e.g., custom-api"
          required
          fullWidth
          helperText={t('admin.providerUpload.helpProviderName')}
        />
        <TextField
          label={t('admin.providerUpload.labelVersion')}
          value={providerVersion}
          onChange={(e) => setProviderVersion(e.target.value)}
          placeholder="e.g., 1.0.0"
          required
          fullWidth
          helperText={t('admin.providerUpload.helpVersion')}
        />

        <FormControl fullWidth required>
          <InputLabel>{t('admin.providerUpload.labelOperatingSystem')}</InputLabel>
          <Select
            value={providerOS}
            label={t('admin.providerUpload.labelOperatingSystem')}
            onChange={(e: SelectChangeEvent) => setProviderOS(e.target.value)}
          >
            <MenuItem value="linux">Linux</MenuItem>
            <MenuItem value="darwin">macOS (Darwin)</MenuItem>
            <MenuItem value="windows">Windows</MenuItem>
          </Select>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              mt: 0.5,
              ml: 1.75,
            }}
          >
            {t('admin.providerUpload.helpOsCaption')}
          </Typography>
        </FormControl>

        <FormControl fullWidth required>
          <InputLabel>{t('admin.providerUpload.labelArchitecture')}</InputLabel>
          <Select
            value={providerArch}
            label={t('admin.providerUpload.labelArchitecture')}
            onChange={(e: SelectChangeEvent) => setProviderArch(e.target.value)}
          >
            <MenuItem value="amd64">AMD64 (x86_64)</MenuItem>
            <MenuItem value="arm64">ARM64</MenuItem>
            <MenuItem value="386">386 (x86)</MenuItem>
          </Select>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              mt: 0.5,
              ml: 1.75,
            }}
          >
            {t('admin.providerUpload.helpArchCaption')}
          </Typography>
        </FormControl>

        <FileDropZone
          file={providerFile}
          onFileSelected={handleProviderFileSelected}
          onClear={() => setProviderFile(null)}
          acceptedExtensions={['.zip']}
          disabled={uploading}
          data-testid="provider-upload-dropzone"
        />

        {uploading && uploadPercent !== null && (
          <Box data-testid="provider-upload-progress">
            <LinearProgress variant="determinate" value={uploadPercent} />
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Uploading… {uploadPercent}%
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Button
          variant="contained"
          onClick={handleProviderUpload}
          disabled={uploading || !providerFile}
          startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
          size="large"
        >
          {uploading
            ? t('admin.providerUpload.uploading')
            : t('admin.providerUpload.uploadProvider')}
        </Button>
      </Stack>
    </Box>
  )

  return (
    <Page maxWidth="md">
      <PageHeader
        icon={<PageTitleIcon />}
        title={t('admin.providerUpload.pageTitle')}
        description={t('admin.providerUpload.pageSubtitle')}
      />
      <Paper sx={{ width: '100%' }}>
        {providerMethod === 'choose' && renderProviderMethodChooser()}
        {providerMethod === 'upload' && renderFileUploadForm()}
      </Paper>
    </Page>
  )
}

export default ProviderUploadPage
