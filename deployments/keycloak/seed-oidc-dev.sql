-- OIDC dev stack seed script
-- Run automatically by the postgres container on first init (via /docker-entrypoint-initdb.d/).
-- Marks setup as complete (OIDC is pre-configured via env vars, no wizard needed) and
-- pre-provisions the Keycloak admin user (admin@example.com / admin.user) as a registry admin.
--
-- This script is idempotent: all inserts use ON CONFLICT DO NOTHING / DO UPDATE
-- so re-running against an already-seeded database is safe.

DO $$
DECLARE
    v_user_id              uuid;
    v_org_id               uuid;
    v_admin_role_template_id uuid;
BEGIN
    ---------------------------------------------------------------------------
    -- 1. Mark setup as complete so the "Setup Required" banner does not appear.
    --    OIDC is configured via TFR_AUTH_OIDC_* env vars on the backend;
    --    storage is local filesystem (also env-configured).
    --    The setup_token_hash is set to NULL to permanently disable setup endpoints.
    ---------------------------------------------------------------------------
    UPDATE system_settings
    SET setup_completed    = true,
        setup_token_hash   = NULL,
        oidc_configured    = true,
        storage_configured = true
    WHERE id = 1;

    ---------------------------------------------------------------------------
    -- 2. Seed the oidc_config row so the admin OIDC Groups page can read and
    --    write group mapping settings at runtime.
    --    Authentication itself is handled via TFR_AUTH_OIDC_* env vars;
    --    client_secret_encrypted is a placeholder (never used for auth here).
    ---------------------------------------------------------------------------
    INSERT INTO oidc_config (
        name,
        provider_type,
        issuer_url,
        client_id,
        client_secret_encrypted,
        redirect_url,
        scopes,
        is_active,
        extra_config
    ) VALUES (
        'keycloak-dev',
        'generic_oidc',
        'http://keycloak:8180/realms/terraform-registry',
        'terraform-registry',
        'env-var-managed',
        'https://registry.local:3000/api/v1/auth/callback',
        '["openid","email","profile"]',
        true,
        '{"group_claim_name":"groups","group_mappings":[],"default_role":""}'
    ) ON CONFLICT DO NOTHING;

    ---------------------------------------------------------------------------
    -- 3. Pre-provision the Keycloak test admin (admin@example.com / admin.user).
    --    The OIDC sub for this user will be linked on first login via email match
    --    in GetOrCreateUserFromOIDC().
    ---------------------------------------------------------------------------
    INSERT INTO users (email, name)
    VALUES ('admin@example.com', 'Admin User')
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO v_user_id FROM users WHERE email = 'admin@example.com';

    SELECT id INTO v_org_id FROM organizations WHERE name = 'default';

    SELECT id INTO v_admin_role_template_id FROM role_templates WHERE name = 'admin';

    -- Assign the Keycloak admin user to the default org with admin role.
    INSERT INTO organization_members (organization_id, user_id, role_template_id)
    VALUES (v_org_id, v_user_id, v_admin_role_template_id)
    ON CONFLICT (organization_id, user_id) DO UPDATE
        SET role_template_id = EXCLUDED.role_template_id;

    RAISE NOTICE 'OIDC dev seed: setup marked complete, admin@example.com provisioned as admin.';
END $$;
