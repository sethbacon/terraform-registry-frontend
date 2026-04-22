import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import type {
  SetupStatus,
  OIDCConfigInput,
  LDAPConfigInput,
  StorageConfigInput,
  StorageBackendType,
  SetupTestResult,
  ScanningConfigInput,
  ScanningTestResult,
  ScanningInstallResult,
} from '../types'

export interface SetupWizardContextValue {
  // status
  loading: boolean
  setupStatus: SetupStatus | null
  reloadStatus: () => Promise<void>

  // shared
  activeStep: number
  goToStep: (n: number) => void
  error: string | null
  setError: (v: string | null) => void
  success: string | null
  setSuccess: (v: string | null) => void

  // step 0: token
  setupToken: string
  setSetupToken: (v: string) => void
  tokenValidating: boolean
  tokenValid: boolean
  validateToken: () => Promise<void>

  // step 1: auth method + oidc
  authMethod: 'oidc' | 'ldap'
  setAuthMethod: (v: 'oidc' | 'ldap') => void

  oidcForm: OIDCConfigInput
  setOidcForm: (f: OIDCConfigInput) => void
  oidcTesting: boolean
  oidcTestResult: SetupTestResult | null
  oidcSaving: boolean
  oidcSaved: boolean
  testOIDC: () => Promise<void>
  saveOIDC: () => Promise<void>

  // step 1: ldap (alternative to oidc)
  ldapForm: LDAPConfigInput
  setLdapForm: (f: LDAPConfigInput) => void
  ldapTesting: boolean
  ldapTestResult: SetupTestResult | null
  ldapSaving: boolean
  ldapSaved: boolean
  testLDAP: () => Promise<void>
  saveLDAP: () => Promise<void>

  // step 2: storage
  storageForm: StorageConfigInput
  setStorageForm: (f: StorageConfigInput) => void
  changeStorageBackend: (type: StorageBackendType) => void
  storageTesting: boolean
  storageTestResult: SetupTestResult | null
  storageSaving: boolean
  storageSaved: boolean
  testStorage: () => Promise<void>
  saveStorage: () => Promise<void>

  // step 3: scanning
  scanningForm: ScanningConfigInput
  setScanningForm: (f: ScanningConfigInput) => void
  scanningTesting: boolean
  scanningTestResult: ScanningTestResult | null
  setScanningTestResult: (r: ScanningTestResult | null) => void
  scanningSaving: boolean
  scanningSaved: boolean
  setScanningSaved: (v: boolean) => void
  testScanning: () => Promise<void>
  saveScanning: () => Promise<void>
  scanningInstalling: boolean
  scanningInstallResult: ScanningInstallResult | null
  installScanner: (version?: string) => Promise<void>

  // step 4: admin
  adminEmail: string
  setAdminEmail: (v: string) => void
  adminSaving: boolean
  adminSaved: boolean
  saveAdmin: () => Promise<void>

  // step 5: complete
  completing: boolean
  completeSetup: () => Promise<void>
}

const SetupWizardContext = createContext<SetupWizardContextValue | undefined>(undefined)

export const useSetupWizard = (): SetupWizardContextValue => {
  const ctx = useContext(SetupWizardContext)
  if (!ctx) throw new Error('useSetupWizard must be used within a SetupWizardProvider')
  return ctx
}

interface SetupWizardProviderProps {
  children: ReactNode
  onSetupCompleted: () => void
  onSetupFinalized: () => void
}

export const SetupWizardProvider: React.FC<SetupWizardProviderProps> = ({
  children,
  onSetupCompleted,
  onSetupFinalized,
}) => {
  const [activeStep, setActiveStep] = useState(0)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Step 0: token
  const [setupToken, setSetupToken] = useState('')
  const [tokenValidating, setTokenValidating] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)

  // Step 1: Auth method
  const [authMethod, setAuthMethod] = useState<'oidc' | 'ldap'>('oidc')

  // Step 1: OIDC
  const [oidcForm, setOidcForm] = useState<OIDCConfigInput>({
    name: 'default',
    provider_type: 'generic_oidc',
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_url: '',
    scopes: ['openid', 'email', 'profile'],
  })
  const [oidcTesting, setOidcTesting] = useState(false)
  const [oidcTestResult, setOidcTestResult] = useState<SetupTestResult | null>(null)
  const [oidcSaving, setOidcSaving] = useState(false)
  const [oidcSaved, setOidcSaved] = useState(false)

  // Step 1: LDAP (alternative)
  const [ldapForm, setLdapForm] = useState<LDAPConfigInput>({
    host: '',
    port: 389,
    use_tls: false,
    start_tls: true,
    insecure_skip_verify: false,
    bind_dn: '',
    bind_password: '',
    base_dn: '',
    user_filter: '(sAMAccountName=%s)',
    user_attr_email: 'mail',
    user_attr_name: 'displayName',
    group_base_dn: '',
    group_filter: '',
    group_member_attr: 'member',
  })
  const [ldapTesting, setLdapTesting] = useState(false)
  const [ldapTestResult, setLdapTestResult] = useState<SetupTestResult | null>(null)
  const [ldapSaving, setLdapSaving] = useState(false)
  const [ldapSaved, setLdapSaved] = useState(false)

  // Step 2: storage
  const [storageForm, setStorageForm] = useState<StorageConfigInput>({
    backend_type: 'local',
    local_base_path: './data/storage',
    local_serve_directly: true,
  })
  const [storageTesting, setStorageTesting] = useState(false)
  const [storageTestResult, setStorageTestResult] = useState<SetupTestResult | null>(null)
  const [storageSaving, setStorageSaving] = useState(false)
  const [storageSaved, setStorageSaved] = useState(false)

  // Step 3: scanning
  const [scanningForm, setScanningForm] = useState<ScanningConfigInput>({
    enabled: false,
    tool: 'trivy',
    binary_path: '',
  })
  const [scanningTesting, setScanningTesting] = useState(false)
  const [scanningTestResult, setScanningTestResult] = useState<ScanningTestResult | null>(null)
  const [scanningSaving, setScanningSaving] = useState(false)
  const [scanningSaved, setScanningSaved] = useState(false)
  const [scanningInstalling, setScanningInstalling] = useState(false)
  const [scanningInstallResult, setScanningInstallResult] = useState<ScanningInstallResult | null>(
    null,
  )

  // Step 4: admin
  const [adminEmail, setAdminEmail] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminSaved, setAdminSaved] = useState(false)

  // Step 5: complete
  const [completing, setCompleting] = useState(false)

  const reloadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const status = await api.getSetupStatus()
      setSetupStatus(status)
      if (status.setup_completed && !status.pending_feature_setup) {
        onSetupCompleted()
        return
      }
      // Initialize saved-flags from backend status so features configured in
      // a previous session (or before a new feature was added) show as complete.
      if (status.oidc_configured) setOidcSaved(true)
      if (status.ldap_configured) setLdapSaved(true)
      if (status.auth_method) setAuthMethod(status.auth_method)
      if (status.storage_configured) setStorageSaved(true)
      if (status.scanning_configured) setScanningSaved(true)
      if (status.admin_configured) setAdminSaved(true)
      // In pending-feature mode, jump directly to the first unconfigured step.
      // Steps: 0=Token, 1=OIDC, 2=Storage, 3=Scanning, 4=Admin, 5=Complete
      if (status.pending_feature_setup) {
        if (!status.scanning_configured) setActiveStep(0)
      }
      setOidcForm((prev) => {
        if (prev.redirect_url) return prev
        const baseUrl = window.location.origin
        return { ...prev, redirect_url: `${baseUrl}/api/v1/auth/callback` }
      })
    } catch {
      setError('Failed to check setup status')
    } finally {
      setLoading(false)
    }
  }, [onSetupCompleted])

  useEffect(() => {
    reloadStatus()
  }, [reloadStatus])

  const goToStep = useCallback((n: number) => {
    setActiveStep(n)
    setError(null)
    setSuccess(null)
  }, [])

  const validateToken = async () => {
    try {
      setTokenValidating(true)
      setError(null)
      const result = await api.validateSetupToken(setupToken.trim())
      if (result.valid) {
        setTokenValid(true)
        setSuccess('Setup token verified successfully')
        // In pending-feature mode, skip already-configured steps and jump to
        // the first unconfigured feature step.
        if (setupStatus?.pending_feature_setup) {
          if (!scanningSaved) {
            setActiveStep(3)
          } else {
            setActiveStep(5)
          }
        } else {
          setActiveStep(1)
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Invalid setup token'))
      setTokenValid(false)
    } finally {
      setTokenValidating(false)
    }
  }

  const testOIDC = async () => {
    try {
      setOidcTesting(true)
      setError(null)
      setOidcTestResult(null)
      const result = await api.testOIDCConfig(setupToken, oidcForm)
      setOidcTestResult(result)
      if (!result.success) setError(result.message)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'OIDC test failed'))
    } finally {
      setOidcTesting(false)
    }
  }

  const saveOIDC = async () => {
    try {
      setOidcSaving(true)
      setError(null)
      await api.saveOIDCConfig(setupToken, oidcForm)
      setOidcSaved(true)
      setSuccess('OIDC provider configured successfully')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save OIDC configuration'))
    } finally {
      setOidcSaving(false)
    }
  }

  const testLDAP = async () => {
    try {
      setLdapTesting(true)
      setError(null)
      setLdapTestResult(null)
      const result = await api.testLDAPConfig(setupToken, ldapForm)
      setLdapTestResult(result)
      if (!result.success) setError(result.message)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'LDAP test failed'))
    } finally {
      setLdapTesting(false)
    }
  }

  const saveLDAP = async () => {
    try {
      setLdapSaving(true)
      setError(null)
      await api.saveLDAPConfig(setupToken, ldapForm)
      setLdapSaved(true)
      setSuccess('LDAP configuration saved successfully')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save LDAP configuration'))
    } finally {
      setLdapSaving(false)
    }
  }

  const saveStorage = async () => {
    try {
      setStorageSaving(true)
      setError(null)
      await api.saveSetupStorageConfig(setupToken, storageForm)
      setStorageSaved(true)
      setSuccess('Storage backend configured successfully')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save storage configuration'))
    } finally {
      setStorageSaving(false)
    }
  }

  const testStorage = async () => {
    try {
      setStorageTesting(true)
      setError(null)
      setStorageTestResult(null)
      const result = await api.testSetupStorageConfig(setupToken, storageForm)
      setStorageTestResult(result)
      if (!result.success) {
        setError(result.message)
      } else {
        await saveStorage()
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Storage test failed'))
    } finally {
      setStorageTesting(false)
    }
  }

  const changeStorageBackend = (type: StorageBackendType) => {
    const newForm: StorageConfigInput = { backend_type: type }
    switch (type) {
      case 'local':
        newForm.local_base_path = './data/storage'
        newForm.local_serve_directly = true
        break
      case 'azure':
        newForm.azure_account_name = ''
        newForm.azure_account_key = ''
        newForm.azure_container_name = ''
        break
      case 's3':
        newForm.s3_region = ''
        newForm.s3_bucket = ''
        newForm.s3_auth_method = 'access_key'
        newForm.s3_access_key_id = ''
        newForm.s3_secret_access_key = ''
        break
      case 'gcs':
        newForm.gcs_bucket = ''
        newForm.gcs_project_id = ''
        newForm.gcs_auth_method = 'credentials_file'
        break
    }
    setStorageForm(newForm)
    setStorageTestResult(null)
    setStorageSaved(false)
  }

  const testScanning = async () => {
    try {
      setScanningTesting(true)
      setError(null)
      setScanningTestResult(null)
      const result = await api.testScanningConfig(setupToken, scanningForm)
      setScanningTestResult(result)
      if (!result.success) setError(result.message)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Scanning test failed'))
    } finally {
      setScanningTesting(false)
    }
  }

  const saveScanning = async () => {
    try {
      setScanningSaving(true)
      setError(null)
      await api.saveScanningConfig(setupToken, scanningForm)
      setScanningSaved(true)
      setSuccess('Security scanning configured successfully')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save scanning configuration'))
    } finally {
      setScanningSaving(false)
    }
  }

  const installScanner = async (version?: string) => {
    try {
      setScanningInstalling(true)
      setError(null)
      setScanningInstallResult(null)
      const result = await api.installScanningTool(setupToken, { tool: scanningForm.tool, version })
      setScanningInstallResult(result)
      if (result.success) {
        setScanningForm({ ...scanningForm, binary_path: result.binary_path })
        setSuccess(`${result.tool} ${result.version} installed successfully`)
      } else {
        setError(result.error || 'Scanner installation failed')
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Scanner installation failed'))
    } finally {
      setScanningInstalling(false)
    }
  }

  const saveAdmin = async () => {
    try {
      setAdminSaving(true)
      setError(null)
      await api.configureAdmin(setupToken, { email: adminEmail.trim().toLowerCase() })
      setAdminSaved(true)
      setSuccess('Admin user configured successfully')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to configure admin user'))
    } finally {
      setAdminSaving(false)
    }
  }

  const completeSetup = async () => {
    try {
      setCompleting(true)
      setError(null)
      const result = await api.completeSetup(setupToken)
      setSuccess(result.message)
      setTimeout(onSetupFinalized, 3000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to complete setup'))
    } finally {
      setCompleting(false)
    }
  }

  const value: SetupWizardContextValue = {
    loading,
    setupStatus,
    reloadStatus,
    activeStep,
    goToStep,
    error,
    setError,
    success,
    setSuccess,
    setupToken,
    setSetupToken,
    tokenValidating,
    tokenValid,
    validateToken,
    authMethod,
    setAuthMethod,
    oidcForm,
    setOidcForm,
    oidcTesting,
    oidcTestResult,
    oidcSaving,
    oidcSaved,
    testOIDC,
    saveOIDC,
    ldapForm,
    setLdapForm,
    ldapTesting,
    ldapTestResult,
    ldapSaving,
    ldapSaved,
    testLDAP,
    saveLDAP,
    storageForm,
    setStorageForm,
    changeStorageBackend,
    storageTesting,
    storageTestResult,
    storageSaving,
    storageSaved,
    testStorage,
    saveStorage,
    scanningForm,
    setScanningForm,
    scanningTesting,
    scanningTestResult,
    setScanningTestResult,
    scanningSaving,
    scanningSaved,
    setScanningSaved,
    testScanning,
    saveScanning,
    scanningInstalling,
    scanningInstallResult,
    installScanner,
    adminEmail,
    setAdminEmail,
    adminSaving,
    adminSaved,
    saveAdmin,
    completing,
    completeSetup,
  }

  return <SetupWizardContext.Provider value={value}>{children}</SetupWizardContext.Provider>
}
