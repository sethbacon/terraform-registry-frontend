import { http } from './http'
import type {
  NotificationChannel,
  NotificationChannelInput,
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

// ============================================================================
// Notification channels (webhook / Slack / Microsoft Teams / email)
// ============================================================================

export async function listNotificationChannels(): Promise<NotificationChannel[]> {
  const response = await http.get('/api/v1/admin/notifications/channels')
  return response.data.channels
}

export async function createNotificationChannel(
  data: NotificationChannelInput,
): Promise<NotificationChannel> {
  const response = await http.post('/api/v1/admin/notifications/channels', data)
  return response.data
}

export async function updateNotificationChannel(
  id: string,
  data: NotificationChannelInput,
): Promise<NotificationChannel> {
  const response = await http.put(`/api/v1/admin/notifications/channels/${id}`, data)
  return response.data
}

export async function deleteNotificationChannel(id: string): Promise<void> {
  await http.delete(`/api/v1/admin/notifications/channels/${id}`)
}

export async function testNotificationChannel(id: string): Promise<{ status: string }> {
  const response = await http.post(`/api/v1/admin/notifications/channels/${id}/test`)
  return response.data
}
