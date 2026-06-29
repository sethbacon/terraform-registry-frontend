import type { ReactNode } from 'react'
import { ConsentProvider as SuiteConsentProvider } from '@sethbacon/terraform-suite-ui'

// Re-exported from the shared suite package; the provider keeps this app's key.
export { useConsent } from '@sethbacon/terraform-suite-ui'
export type { ConsentPreferences } from '@sethbacon/terraform-suite-ui'

export const ConsentProvider = ({ children }: { children: ReactNode }) => (
  <SuiteConsentProvider storageKey="terraform-registry-consent">{children}</SuiteConsentProvider>
)

