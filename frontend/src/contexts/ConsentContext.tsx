import type { ReactNode } from 'react'
import { ConsentProvider as SuiteConsentProvider } from '../suite'

// Re-exported from the shared suite package; the provider keeps this app's key.
export { useConsent } from '../suite'
export type { ConsentPreferences } from '../suite'

export const ConsentProvider = ({ children }: { children: ReactNode }) => (
  <SuiteConsentProvider storageKey="terraform-registry-consent">{children}</SuiteConsentProvider>
)
