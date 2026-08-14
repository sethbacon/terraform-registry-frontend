-- Create a dev admin user, assign to default organization, and grant admin role
-- Run this inside the postgres container or via psql
DO $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_admin_role_template_id uuid;
    v_granted integer;
BEGIN
    -- Insert dev admin user
    INSERT INTO users (email, name, oidc_sub)
    VALUES ('admin@dev.local', 'Dev Admin', 'dev-admin-oidc-sub')
    ON CONFLICT (email) DO NOTHING;

    -- Get user id
    SELECT id INTO v_user_id FROM users WHERE email = 'admin@dev.local';
    RAISE NOTICE 'User ID: %', v_user_id;

    -- Get default organization id
    SELECT id INTO v_org_id FROM organizations WHERE name = 'default';
    RAISE NOTICE 'Default Org ID: %', v_org_id;

    -- Get admin role template id
    SELECT id INTO v_admin_role_template_id FROM role_templates WHERE name = 'admin';
    RAISE NOTICE 'Admin Role Template ID: %', v_admin_role_template_id;

    -- Insert org membership with admin role
    INSERT INTO organization_members (organization_id, user_id, role_template_id)
    VALUES (v_org_id, v_user_id, v_admin_role_template_id)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role_template_id = EXCLUDED.role_template_id;

    -- Mark setup as completed so the frontend does not show the Setup Wizard
    -- and the E2E test for setup-redirect-when-complete passes.
    UPDATE system_settings
       SET setup_completed = true,
           oidc_configured = true,
           storage_configured = true,
           scanning_configured = true,
           updated_at = NOW()
     WHERE id = 1;

    -- Grant platform-admin through the carrier.
    --
    -- Backend migration 000054 (its issue #766) took the `admin` wildcard scope
    -- off every role template. Platform-admin authority now comes ONLY from a
    -- `platform_admins` row, resolved per request. The `admin` template above
    -- still grants organization administration, but it no longer confers
    -- platform-wide reach and notably no longer implies `audit:read`.
    --
    -- That migration backfilled carrier rows for template holders that existed
    -- WHEN IT RAN. This stack applies migrations to an empty database and seeds
    -- afterwards, so this user postdates the backfill and inherits nothing from
    -- it. Without the grant below, dev login succeeds, /admin renders, and every
    -- platform-scoped read fails -- which is exactly how this surfaced:
    -- "Audit Logs page (authenticated)" went red while every unauthenticated
    -- test passed.
    --
    -- The audit intent MUST be written in the same transaction. Backend
    -- migration 000052 puts a DEFERRABLE INITIALLY DEFERRED constraint trigger
    -- on platform_admins that re-checks at COMMIT for an audit_outbox row
    -- carrying the same pg_current_xact_id(), subject and action, so a bare
    -- INSERT aborts this whole script at COMMIT. Deriving the intent from
    -- RETURNING keeps a re-run from recording a grant it did not make.
    WITH granted AS (
        INSERT INTO platform_admins (user_id, note)
        VALUES (v_user_id, 'granted by deployments/create-dev-admin-user.sql (E2E/dev seed)')
        ON CONFLICT (user_id) DO NOTHING
        RETURNING user_id
    )
    INSERT INTO audit_outbox (event_id, action, resource_type, resource_id, metadata)
    SELECT gen_random_uuid(), 'platform_admin.granted', 'platform_admin', g.user_id::text,
           jsonb_build_object(
             'target_user_id', g.user_id,
             'source', 'deployments/create-dev-admin-user.sql',
             'origin', 'E2E/dev seed')
      FROM granted g;
    GET DIAGNOSTICS v_granted = ROW_COUNT;

    IF v_granted > 0 THEN
        RAISE NOTICE 'Platform-admin carrier row granted to admin@dev.local.';
    ELSE
        RAISE NOTICE 'admin@dev.local already holds a platform-admin carrier row; nothing to grant.';
    END IF;

    -- Dev login now uses JWT via POST /api/v1/dev/login (no hardcoded API key needed)
    RAISE NOTICE 'Dev admin user, org membership, platform-admin carrier row, and setup completion are in place.';
END $$;
