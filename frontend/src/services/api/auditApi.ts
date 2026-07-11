import { http } from './http'
import type { AuditLog, AuditLogListResponse } from '../../types'

// ============================================================================
// Audit Logs
// ============================================================================

export async function listAuditLogs(opts?: {
  page?: number
  per_page?: number
  action?: string
  resource_type?: string
  user_id?: string
  user_email?: string
  start_date?: string
  end_date?: string
}): Promise<AuditLogListResponse> {
  const response = await http.get<AuditLogListResponse>('/api/v1/admin/audit-logs', {
    params: opts,
  })
  return response.data
}

export async function getAuditLog(id: string): Promise<AuditLog> {
  const response = await http.get<AuditLog>(`/api/v1/admin/audit-logs/${id}`)
  return response.data
}

export function exportAuditLogsCSV(logs: AuditLog[]): void {
  const header = [
    'id',
    'created_at',
    'action',
    'resource_type',
    'resource_id',
    'user_email',
    'user_name',
    'organization_id',
    'ip_address',
  ]
  const rows = logs.map((l) =>
    [
      l.id,
      l.created_at,
      l.action,
      l.resource_type ?? '',
      l.resource_id ?? '',
      l.user_email ?? '',
      l.user_name ?? '',
      l.organization_id ?? '',
      l.ip_address ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAuditLogsJSON(logs: AuditLog[]): void {
  const json = JSON.stringify(logs, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
