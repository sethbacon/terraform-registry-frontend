-- OIDC dev stack seed script
--
-- Run by the one-shot `db-seed` service in deployments/docker-compose.oidc.yml,
-- which mounts this file at /seed.sql and runs `psql -f /seed.sql` AFTER the
-- backend reports healthy -- i.e. after its migrations have been applied. It is
-- NOT loaded through /docker-entrypoint-initdb.d/, and it must not be: the
-- tables it writes do not exist until the backend has migrated.
--
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
    v_granted              integer;
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

    ---------------------------------------------------------------------------
    -- 4. Grant platform-admin through the carrier.
    --
    -- The organization_members row above is NOT sufficient, and this is the
    -- third copy of this seed to have been written as though it were (#792).
    --
    -- Backend migration 000054 (its issue #766) took the `admin` wildcard scope
    -- off every role template. Platform-admin authority now comes ONLY from a
    -- `platform_admins` row, resolved per request. The `admin` template assigned
    -- above still grants organization administration, but it no longer confers
    -- platform-wide reach and notably no longer implies `audit:read` -- so
    -- without the grant below this user logs in through Keycloak, /admin
    -- renders, and every platform-scoped read fails.
    --
    -- 000054 backfilled carrier rows for template holders that existed WHEN IT
    -- RAN. This stack migrates an empty database and seeds afterwards, so this
    -- user postdates the backfill and inherits nothing from it.
    --
    -- The audit intent MUST be written in the same transaction. Migration
    -- 000052 puts a DEFERRABLE INITIALLY DEFERRED constraint trigger on
    -- platform_admins that re-checks at COMMIT for an audit_outbox row carrying
    -- the same pg_current_xact_id(), the same subject and
    -- action='platform_admin.granted', so a bare INSERT aborts this whole
    -- script at COMMIT. Deriving the intent from RETURNING keeps a re-run from
    -- recording a grant it did not make.
    ---------------------------------------------------------------------------
    WITH granted AS (
        INSERT INTO platform_admins (user_id, note)
        VALUES (v_user_id, 'granted by deployments/keycloak/seed-oidc-dev.sql (OIDC dev seed)')
        ON CONFLICT (user_id) DO NOTHING
        RETURNING user_id
    )
    INSERT INTO audit_outbox (event_id, action, resource_type, resource_id, metadata)
    SELECT gen_random_uuid(), 'platform_admin.granted', 'platform_admin', g.user_id::text,
           jsonb_build_object(
             'target_user_id', g.user_id,
             'source', 'deployments/keycloak/seed-oidc-dev.sql',
             'origin', 'OIDC dev seed')
      FROM granted g;
    GET DIAGNOSTICS v_granted = ROW_COUNT;

    IF v_granted > 0 THEN
        RAISE NOTICE 'Platform-admin carrier row granted to admin@example.com.';
    ELSE
        RAISE NOTICE 'admin@example.com already holds a platform-admin carrier row; nothing to grant.';
    END IF;

    RAISE NOTICE 'OIDC dev seed: setup marked complete, admin@example.com provisioned as a platform admin.';
END $$;
