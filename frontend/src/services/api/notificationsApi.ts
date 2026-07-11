import { http } from './http'
import type {
  NotificationsConfig,
  NotificationsConfigInput,
  NotificationsTestRequest,
  NotificationsTestResult,
} from '../../types'

// ============================================================================
// Notifications
// ============================================================================

export async function getNotificationsConfig(): Promise<NotificationsConfig> {
  const response = await http.get('/api/v1/admin/notifications/config')
  return response.data
}

export async function saveNotificationsConfig(
  data: NotificationsConfigInput,
): Promise<NotificationsConfig> {
  const response = await http.put('/api/v1/admin/notifications/config', data)
  return response.data
}

export async function sendTestNotification(
  data?: NotificationsTestRequest,
): Promise<NotificationsTestResult> {
  const response = await http.post('/api/v1/admin/notifications/test', data ?? {})
  return response.data
}
