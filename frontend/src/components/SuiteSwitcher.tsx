import { useSuite } from '../hooks/useSuite'
import { SuiteSwitcher as SuiteSwitcherBase } from '@sethbacon/terraform-suite-ui'
import { isSafeExternalUrl } from '../utils/externalUrl'

const LABELS: Record<string, string> = {
  'terraform-registry': 'Terraform Registry',
  'terraform-state-manager': 'Terraform State Manager',
}

// Sibling discovery (which app, shared store?) stays app-side via useSuite; the
// AppBar button + single-tab reuse now live in the shared package's SuiteSwitcher.
export function SuiteSwitcher() {
  const { sibling, active } = useSuite()
  // Defense-in-depth: the sibling URL comes from the backend /api/v1/ui/config; validate it at
  // the app boundary before handing it to the shared switcher's navigation sink.
  if (!active || !sibling?.publicUrl || !isSafeExternalUrl(sibling.publicUrl)) return null
  const label = LABELS[sibling.app] ?? sibling.app
  // Until both apps are confirmed to share one identity store + IdP
  // (sibling.sharedStore), opening the sibling in a new tab may require a
  // separate sign-in. Set that expectation honestly rather than implying SSO.
  const tooltip = sibling.sharedStore
    ? `Open ${label}`
    : `Open ${label} (opens in a new tab; you may need to sign in)`
  // Self is the other known suite app; the package claims this tab under that id
  // before opening the sibling so the sibling reuses one tab (never a third).
  const selfApp = Object.keys(LABELS).find((a) => a !== sibling.app)
  return (
    <SuiteSwitcherBase
      links={[{ label, href: sibling.publicUrl, appId: sibling.app }]}
      tooltip={tooltip}
      currentAppId={selfApp}
    />
  )
}
