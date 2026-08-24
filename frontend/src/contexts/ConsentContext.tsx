import type { ReactNode } from 'react'
import { ConsentProvider as SuiteConsentProvider } from '@4cloudguru/cloud-suite-ui'

// Re-exported from the shared suite package; the provider keeps this app's key.
export { useConsent } from '@4cloudguru/cloud-suite-ui'
export type { ConsentPreferences } from '@4cloudguru/cloud-suite-ui'

export const ConsentProvider = ({ children }: { children: ReactNode }) => (
  <SuiteConsentProvider storageKey="terraform-registry-consent">{children}</SuiteConsentProvider>
)
