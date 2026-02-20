// Configuration for the Terraform Registry frontend

// The hostname where the registry backend is accessible for Terraform CLI
// This is used in usage examples shown to users
export const REGISTRY_HOST = 'registry.local';

// Full URL for the registry backend (HTTPS on port 443)
export const REGISTRY_URL = `https://${REGISTRY_HOST}`;
