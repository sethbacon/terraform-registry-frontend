import { useEffect } from 'react'
import { useConsent } from '../contexts/ConsentContext'
import {
  init as initErrorReporting,
  destroy as destroyErrorReporting,
} from '../services/errorReporting'
import {
  init as initPerformanceReporting,
  destroy as destroyPerformanceReporting,
} from '../services/performanceReporting'

/**
 * Starts/stops error and performance reporting in lockstep with the user's
 * consent preferences (PRIVACY.md section 3.3: telemetry is opt-in only).
 * Renders nothing -- must be mounted inside ConsentProvider.
 *
 * Each effect's cleanup calls destroy() on consent withdrawal or unmount, so
 * this also satisfies "withdraw consent at any time" (PRIVACY.md section 6,
 * Art 7(3)) without requiring a page reload -- and pairs correctly with React
 * StrictMode's mount->cleanup->remount dev cycle (double-init would otherwise
 * leak a second flush timer).
 */
const TelemetryGate: React.FC = () => {
  const { preferences } = useConsent()

  useEffect(() => {
    if (!preferences.errorReporting) return
    initErrorReporting()
    return () => destroyErrorReporting()
  }, [preferences.errorReporting])

  useEffect(() => {
    if (!preferences.performanceReporting) return
    initPerformanceReporting()
    return () => destroyPerformanceReporting()
  }, [preferences.performanceReporting])

  return null
}

export default TelemetryGate
