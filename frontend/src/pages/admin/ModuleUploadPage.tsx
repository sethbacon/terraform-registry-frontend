import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  Stack,
  CircularProgress,
  Card,
  CardActionArea,
  CardContent,
  LinearProgress,
} from '@mui/material'
import CloudUpload from '@mui/icons-material/CloudUpload'
import SCMIcon from '@mui/icons-material/AccountTree'
import ArrowBack from '@mui/icons-material/ArrowBack'
import api from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { isValidRegistrySegment, REGISTRY_SEGMENT_HELP } from '../../utils/registrySegment'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/ViewModule'
import PublishFromSCMWizard from '../../components/PublishFromSCMWizard'
import FileDropZone from '../../components/FileDropZone'
import PolicyResultsPanel from '../../components/PolicyResultsPanel'
import { PolicyResult } from '../../types'

type ModuleMethod = 'choose' | 'upload' | 'scm'

const ModuleUploadPage: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as {
    moduleData?: { namespace: string; name: string; provider: string }
    method?: ModuleMethod
  }
  const prefilledModule = state?.moduleData

  const [moduleMethod, setModuleMethod] = useState<ModuleMethod>(state?.method ?? 'choose')

  // SCM new-module metadata (before wizard)
  const [scmNamespace, setScmNamespace] = useState(prefilledModule?.namespace || '')
  const [scmName, setScmName] = useState(prefilledModule?.name || '')
  const [scmSystem, setScmSystem] = useState(prefilledModule?.provider || '')
  const [scmDescription, setScmDescription] = useState('')
  const [scmModuleId, setScmModuleId] = useState<string | null>(null)
  const [scmCreating, setScmCreating] = useState(false)
  const [scmError, setScmError] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [policyResult, setPolicyResult] = useState<PolicyResult | null>(null)

  // Module upload state
  const [moduleFile, setModuleFile] = useState<File | null>(null)
  const [moduleNamespace, setModuleNamespace] = useState(prefilledModule?.namespace || '')
  const [moduleName, setModuleName] = useState(prefilledModule?.name || '')
  const [moduleProvider, setModuleProvider] = useState(prefilledModule?.provider || '')
  const [moduleVersion, setModuleVersion] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')

  const handleModuleFileSelected = (file: File) => {
    setModuleFile(file)
    setError(null)
  }

  const handleModuleUpload = async () => {
    if (!moduleFile || !moduleNamespace || !moduleName || !moduleProvider || !moduleVersion) {
      setError('Please fill in all required fields')
      return
    }
    for (const [label, val] of [
      ['Namespace', moduleNamespace],
      ['Module Name', moduleName],
      ['Provider', moduleProvider],
    ] as const) {
      if (!isValidRegistrySegment(val)) {
        setError(`${label} is not a valid Terraform registry segment. ${REGISTRY_SEGMENT_HELP}`)
        return
      }
    }

    try {
      setUploading(true)
      setUploadPercent(0)
      setError(null)
      setSuccess(null)
      setPolicyResult(null)

      const formData = new FormData()
      formData.append('namespace', moduleNamespace)
      formData.append('name', moduleName)
      formData.append('system', moduleProvider)
      formData.append('version', moduleVersion)
      if (moduleDescription) formData.append('description', moduleDescription)
      formData.append('file', moduleFile)

      const result = await api.uploadModule(formData, {
        onUploadProgress: (percent) => setUploadPercent(percent),
      })

      const pr: PolicyResult | undefined = result?.policy_result
      if (pr) {
        setPolicyResult(pr)
        setUploading(false)
        setUploadPercent(null)
        if (pr.allowed) {
          setSuccess('Module uploaded successfully.')
        }
      } else {
        navigate(`/modules/${moduleNamespace}/${moduleName}/${moduleProvider}`)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload module. Please try again.'))
      setUploading(false)
      setUploadPercent(null)
    }
  }

  const handleScmProceed = async () => {
    if (!scmNamespace || !scmName || !scmSystem) {
      setScmError('Namespace, name, and provider are required')
      return
    }
    for (const [label, val] of [
      ['Namespace', scmNamespace],
      ['Module Name', scmName],
      ['Provider', scmSystem],
    ] as const) {
      if (!isValidRegistrySegment(val)) {
        setScmError(`${label} is not a valid Terraform registry segment. ${REGISTRY_SEGMENT_HELP}`)
        return
      }
    }
    try {
      setScmCreating(true)
      setScmError(null)
      const module = await api.createModuleRecord({
        namespace: scmNamespace,
        name: scmName,
        system: scmSystem,
        description: scmDescription || undefined,
      })
      setScmModuleId(module.id)
    } catch (err: unknown) {
      setScmError(getErrorMessage(err, 'Failed to create module record'))
    } finally {
      setScmCreating(false)
    }
  }

  const renderModuleMethodChooser = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('admin.moduleUpload.chooseTitle')}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t('admin.moduleUpload.chooseSubtitle')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea sx={{ height: '100%' }} onClick={() => setModuleMethod('upload')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('admin.moduleUpload.uploadFromFile')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.moduleUpload.uploadFromFileDesc')}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea sx={{ height: '100%' }} onClick={() => setModuleMethod('scm')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <SCMIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('admin.moduleUpload.linkFromScm')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.moduleUpload.linkFromScmDesc')}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  )

  const renderScmMetadataForm = () => (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => {
          setModuleMethod('choose')
          setScmError(null)
          setScmModuleId(null)
        }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>
      <Typography variant="h6" gutterBottom>
        {t('admin.moduleUpload.formScmTitle')}
      </Typography>

      {scmModuleId ? (
        <PublishFromSCMWizard
          moduleId={scmModuleId}
          moduleSystem={scmSystem}
          onComplete={() => {
            navigate(`/modules/${scmNamespace}/${scmName}/${scmSystem}`)
          }}
          onCancel={() => {
            setModuleMethod('choose')
            setScmModuleId(null)
          }}
        />
      ) : (
        <>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 3,
            }}
          >
            {t('admin.moduleUpload.scmSubtitle')}
          </Typography>
          <Stack spacing={3} sx={{ maxWidth: 500 }}>
            <TextField
              label={t('admin.moduleUpload.labelNamespace')}
              value={scmNamespace}
              onChange={(e) => setScmNamespace(e.target.value)}
              placeholder="e.g., bconline"
              required
              fullWidth
              error={!!scmNamespace && !isValidRegistrySegment(scmNamespace)}
              helperText={
                scmNamespace && !isValidRegistrySegment(scmNamespace)
                  ? REGISTRY_SEGMENT_HELP
                  : t('admin.moduleUpload.helpNamespace')
              }
            />
            <TextField
              label={t('admin.moduleUpload.labelModuleName')}
              value={scmName}
              onChange={(e) => setScmName(e.target.value)}
              placeholder="e.g., networking-vpc"
              required
              fullWidth
              error={!!scmName && !isValidRegistrySegment(scmName)}
              helperText={
                scmName && !isValidRegistrySegment(scmName) ? REGISTRY_SEGMENT_HELP : undefined
              }
            />
            <TextField
              label={t('admin.moduleUpload.labelProvider')}
              value={scmSystem}
              onChange={(e) => setScmSystem(e.target.value)}
              placeholder="e.g., aws"
              required
              fullWidth
              error={!!scmSystem && !isValidRegistrySegment(scmSystem)}
              helperText={
                scmSystem && !isValidRegistrySegment(scmSystem)
                  ? REGISTRY_SEGMENT_HELP
                  : 'Cloud provider this module targets (aws, azure, google, etc.)'
              }
            />
            <TextField
              label={t('admin.moduleUpload.labelDescriptionOptional')}
              value={scmDescription}
              onChange={(e) => setScmDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            {scmError && <Alert severity="error">{scmError}</Alert>}

            <Button
              variant="contained"
              onClick={handleScmProceed}
              disabled={
                scmCreating ||
                !scmNamespace ||
                !scmName ||
                !scmSystem ||
                !isValidRegistrySegment(scmNamespace) ||
                !isValidRegistrySegment(scmName) ||
                !isValidRegistrySegment(scmSystem)
              }
              startIcon={scmCreating ? <CircularProgress size={18} /> : <SCMIcon />}
              size="large"
            >
              {scmCreating
                ? t('admin.moduleUpload.creating')
                : t('admin.moduleUpload.continueToRepo')}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  )

  const renderFileUploadForm = () => (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => {
          setModuleMethod('choose')
          setError(null)
          setSuccess(null)
        }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>
      <Typography variant="h6" gutterBottom>
        {t('admin.moduleUpload.formUploadTitle')}
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
          • Package your module as a <strong>.tar.gz</strong> or <strong>.tgz</strong> file
          <br />• Include all <strong>.tf</strong> files (main.tf, variables.tf, outputs.tf)
          <br />• Add a <strong>README.md</strong> with usage documentation
          <br />
          • Use semantic versioning (1.0.0, 2.1.3, etc.)
          <br />• Module address format: <strong>namespace/name/provider</strong>
        </Typography>
      </Box>

      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            alignItems: 'flex-start',
          }}
        >
          <TextField
            label={t('admin.moduleUpload.labelNamespace')}
            value={moduleNamespace}
            onChange={(e) => setModuleNamespace(e.target.value)}
            placeholder="e.g., bconline"
            required
            fullWidth
            disabled={uploading}
            error={!!moduleNamespace && !isValidRegistrySegment(moduleNamespace)}
            helperText={
              moduleNamespace && !isValidRegistrySegment(moduleNamespace)
                ? REGISTRY_SEGMENT_HELP
                : t('admin.moduleUpload.helpNamespace')
            }
          />
          <TextField
            label={t('admin.moduleUpload.labelModuleName')}
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            placeholder="e.g., networking-vpc"
            required
            fullWidth
            disabled={uploading}
            error={!!moduleName && !isValidRegistrySegment(moduleName)}
            helperText={
              moduleName && !isValidRegistrySegment(moduleName)
                ? REGISTRY_SEGMENT_HELP
                : t('admin.moduleUpload.helpModuleName')
            }
          />
          <TextField
            label={t('admin.moduleUpload.labelProvider')}
            value={moduleProvider}
            onChange={(e) => setModuleProvider(e.target.value)}
            placeholder="e.g., aws"
            required
            fullWidth
            disabled={uploading}
            error={!!moduleProvider && !isValidRegistrySegment(moduleProvider)}
            helperText={
              moduleProvider && !isValidRegistrySegment(moduleProvider)
                ? REGISTRY_SEGMENT_HELP
                : t('admin.moduleUpload.helpProvider')
            }
          />
        </Stack>
        <TextField
          label={t('admin.moduleUpload.labelVersion')}
          value={moduleVersion}
          onChange={(e) => setModuleVersion(e.target.value)}
          placeholder="e.g., 1.0.0"
          required
          fullWidth
          disabled={uploading}
          helperText={t('admin.moduleUpload.helpVersion')}
        />

        <FileDropZone
          file={moduleFile}
          onFileSelected={handleModuleFileSelected}
          onClear={() => setModuleFile(null)}
          acceptedExtensions={['.tar.gz', '.tgz']}
          disabled={uploading}
          data-testid="module-upload-dropzone"
        />

        <TextField
          label={t('admin.moduleUpload.labelDescription')}
          value={moduleDescription}
          onChange={(e) => setModuleDescription(e.target.value)}
          placeholder="e.g., Creates a VPC with public and private subnets"
          fullWidth
          multiline
          rows={3}
          disabled={uploading}
          helperText={t('admin.moduleUpload.helpDescription')}
        />

        {uploading && uploadPercent !== null && (
          <Box data-testid="module-upload-progress">
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

        {policyResult && <PolicyResultsPanel policyResult={policyResult} />}

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={handleModuleUpload}
            disabled={
              uploading ||
              !moduleFile ||
              (policyResult?.mode === 'block' && !policyResult?.allowed) ||
              !isValidRegistrySegment(moduleNamespace) ||
              !isValidRegistrySegment(moduleName) ||
              !isValidRegistrySegment(moduleProvider)
            }
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
            size="large"
          >
            {uploading ? t('admin.moduleUpload.uploading') : t('admin.moduleUpload.uploadModule')}
          </Button>
          {policyResult?.allowed && (
            <Button
              variant="outlined"
              size="large"
              onClick={() =>
                navigate(`/modules/${moduleNamespace}/${moduleName}/${moduleProvider}`)
              }
            >
              {t('admin.moduleUpload.viewModule')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  )

  return (
    <Page maxWidth="md">
      <PageHeader
        icon={<PageTitleIcon />}
        title={t('admin.moduleUpload.pageTitle')}
        description={t('admin.moduleUpload.pageSubtitle')}
      />
      <Paper sx={{ width: '100%' }}>
        {moduleMethod === 'choose' && renderModuleMethodChooser()}
        {moduleMethod === 'upload' && renderFileUploadForm()}
        {moduleMethod === 'scm' && renderScmMetadataForm()}
      </Paper>
    </Page>
  )
}

export default ModuleUploadPage
