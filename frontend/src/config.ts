// Configuration for the Terraform Registry frontend

// The hostname (including port when non-standard) where the registry is
// accessible for Terraform CLI. Derived from the browser URL so usage
// examples always match the actual deployment.
export const REGISTRY_HOST = window.location.host;

// Full base URL for the registry backend, matching the current protocol.
export const REGISTRY_URL = window.location.origin;
