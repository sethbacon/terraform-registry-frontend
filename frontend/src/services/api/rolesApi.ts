import { http } from './http'
import type { RoleTemplate } from '../../types/rbac'

// ============================================================================
// Role Templates
// ============================================================================

export async function listRoleTemplates(): Promise<RoleTemplate[]> {
  const response = await http.get<RoleTemplate[]>('/api/v1/admin/role-templates')
  return response.data || []
}

export async function getRoleTemplate(id: string): Promise<RoleTemplate> {
  const response = await http.get<RoleTemplate>(`/api/v1/admin/role-templates/${id}`)
  return response.data
}

export async function createRoleTemplate(data: {
  name: string
  display_name: string
  description?: string
  scopes: string[]
}): Promise<RoleTemplate> {
  const response = await http.post<RoleTemplate>('/api/v1/admin/role-templates', data)
  return response.data
}

export async function updateRoleTemplate(
  id: string,
  data: {
    name?: string
    display_name?: string
    description?: string
    scopes?: string[]
  },
): Promise<RoleTemplate> {
  const response = await http.put<RoleTemplate>(`/api/v1/admin/role-templates/${id}`, data)
  return response.data
}

export async function deleteRoleTemplate(id: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(`/api/v1/admin/role-templates/${id}`)
  return response.data
}
