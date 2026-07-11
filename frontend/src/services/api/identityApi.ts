import { http } from './http'
import type {
  IdentityGroupMappings,
  MTLSConfigResponse,
  OIDCConfigResponse,
  OIDCGroupMappingInput,
} from '../../types'

// Admin OIDC config endpoints

export async function getAdminOIDCConfig(): Promise<OIDCConfigResponse> {
  const response = await http.get('/api/v1/admin/oidc/config')
  return response.data
}

export async function updateOIDCGroupMapping(
  data: OIDCGroupMappingInput,
): Promise<OIDCConfigResponse> {
  const response = await http.put('/api/v1/admin/oidc/group-mapping', data)
  return response.data
}

/**
 * Fetch SAML + LDAP group mapping configuration (read-only, from server config).
 */
export async function getIdentityGroupMappings(): Promise<IdentityGroupMappings> {
  const response = await http.get('/api/v1/admin/identity/group-mappings')
  return response.data
}

/**
 * Fetch mTLS certificate mapping configuration (read-only, from server config).
 */
export async function getMTLSConfig(): Promise<MTLSConfigResponse> {
  const response = await http.get('/api/v1/admin/mtls/config')
  return response.data
}
