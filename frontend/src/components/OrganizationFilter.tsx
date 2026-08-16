import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Autocomplete, FormHelperText, Stack, TextField } from '@mui/material'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { queryKeys } from '../services/queryKeys'
import { ORGANIZATION_PAGE_MAX } from '../services/api/organizationsApi'

/**
 * The page this picker asks for: the largest the endpoint serves.
 *
 * Re-exported from the API module rather than restated, so the number bounding
 * the request and the number the endpoint enforces cannot drift apart.
 */
export const ORGANIZATION_PAGE_SIZE = ORGANIZATION_PAGE_MAX

/** Debounce for the server-side organization search, in milliseconds. */
const SEARCH_DEBOUNCE_MS = 300

/** One selectable organization: the id that goes on the wire, and its slug. */
export interface OrganizationOption {
  id: string
  /**
   * The organization's URL-safe SLUG.
   *
   * `/auth/me` sends only the slug (`o.name`) and no display name, so the slug
   * is what the membership-sourced options can show. The platform-admin source
   * DOES carry `display_name`, but shows the slug too — deliberately. Two
   * sources labelling the same organization differently, depending on who is
   * looking at it, is worse than both being terse.
   */
  label: string
}

export interface OrganizationFilterProps {
  /** The selected organization id, or '' for "all organizations". */
  value: string
  /** Called with the new organization id, or '' when cleared. */
  onChange: (organizationId: string) => void
  /** Overrides the default "Organization" label. */
  label?: string
}

/**
 * The organization picker (#779): an optional FILTER on the pages where
 * narrowing to one organization is a coherent question.
 *
 * It is not a global context. Unset always means "everything the caller may
 * see", and it never defaults to a membership — a default would quietly hide
 * most of the estate from the person who came to look at all of it.
 *
 * WHO SEES WHAT
 *
 *   - An ordinary member filters by the organizations they belong to, which
 *     `useAuth().memberships` already carries in full (#795). A small, complete,
 *     already-loaded set — no request needed.
 *   - A PLATFORM ADMIN filters by every organization in the deployment, which is
 *     a different and usually larger set than their memberships. Their authority
 *     comes from the platform_admins carrier, not from a membership, so a
 *     platform admin frequently has ZERO memberships — by construction on a
 *     fresh deployment, where setup writes only the carrier. Sourcing their
 *     options from memberships would offer them nothing at all.
 *
 * WHY AN AUTOCOMPLETE AND NOT A DROPDOWN
 *
 * A fixed dropdown is a fine control for the three organizations a member
 * belongs to and the wrong one for an estate of hundreds, which is what a
 * platform admin sees. Worse, the source endpoint pages, so a dropdown would
 * present a list that is quietly incomplete — an administrator scrolling for an
 * organization that is simply not in the first page has no way to tell that
 * from it not existing. So: a searchable Autocomplete whose typing hits
 * `/organizations/search` server-side, plus an explicit notice driven by the
 * server's exact `has_more`. The list may still be partial; what it may not be
 * is SILENTLY partial.
 */
const OrganizationFilter: React.FC<OrganizationFilterProps> = ({ value, onChange, label }) => {
  const { t } = useTranslation()
  const { memberships, allowedScopes } = useAuth()

  // `admin` in allowed_scopes is the platform-admin signal and nothing else:
  // the backend's me-allowed-scopes-carrier guard makes this field report the
  // carrier's authority, adding `admin` when the carrier grants it and
  // stripping it from a role template that merely names it.
  const isPlatformAdmin = allowedScopes.includes('admin')

  const [inputValue, setInputValue] = useState('')
  const search = useDebounce(inputValue.trim(), SEARCH_DEBOUNCE_MS)

  // The unsearched first page. Kept as its own query, separate from the search
  // below, because VISIBILITY is decided from it: driving visibility off the
  // currently-displayed options would make the picker vanish mid-typing the
  // moment a search narrowed to a single match.
  const { data: baseline } = useQuery({
    queryKey: queryKeys.organizations.list({ page: 1, perPage: ORGANIZATION_PAGE_SIZE }),
    queryFn: () => api.listOrganizations(1, ORGANIZATION_PAGE_SIZE),
    enabled: isPlatformAdmin,
  })

  const { data: searched } = useQuery({
    queryKey: queryKeys.organizations.list({
      page: 1,
      perPage: ORGANIZATION_PAGE_SIZE,
      search,
    }),
    queryFn: () => api.searchOrganizations(search, 1, ORGANIZATION_PAGE_SIZE),
    enabled: isPlatformAdmin && search.length > 0,
  })

  const membershipOptions = useMemo<OrganizationOption[]>(
    () => memberships.map((m) => ({ id: m.organization_id, label: m.organization_name })),
    [memberships],
  )

  // The page currently on screen: the search results once the user has typed,
  // the unsearched first page otherwise.
  const shown = search ? searched : baseline

  const adminOptions = useMemo<OrganizationOption[]>(
    () => (shown?.organizations ?? []).map((o) => ({ id: o.id, label: o.name })),
    [shown],
  )

  const options = isPlatformAdmin ? adminOptions : membershipOptions

  // Whether to tell the administrator that organizations exist beyond the ones
  // on offer.
  //
  // Reads the server's `has_more`, which is EXACT — false if and only if
  // nothing follows this page — rather than re-deriving completeness from the
  // row count (backend #893). The count heuristic this replaces ("the page came
  // back full") is wrong for every list whose length is an exact multiple of
  // the page size: a deployment with precisely 100 organizations would be told
  // to keep searching for a 101st that does not exist. On the search axis it
  // was not merely imprecise but unavailable, since that axis cannot count at
  // all; the server now probes one row past the page to answer honestly.
  const mayBeTruncated = isPlatformAdmin && (shown?.hasMore ?? false)

  /**
   * Shown only when there is a choice to make: more than one organization to
   * pick between. At zero or one the control is hidden entirely rather than
   * disabled — a one-item picker is a decoration, and its absence restricts
   * nothing, since an unset filter already returns everything the caller may
   * see.
   *
   * The set that "more than one" counts is the set this caller would be
   * choosing from, which is the whole estate for a platform admin and the
   * memberships for everyone else — not memberships in both cases, or a
   * carrier-only administrator (zero memberships, every organization) would
   * never see it.
   */
  const visible = isPlatformAdmin
    ? (baseline?.organizations.length ?? 0) > 1
    : membershipOptions.length > 1

  // A deep-linked ?org= naming an organization outside the loaded page still
  // has to render as itself. Synthesising the missing option keeps the URL
  // authoritative — the alternative is an administrator following a colleague's
  // link and silently seeing the control blank while the page stays filtered.
  const selected = useMemo<OrganizationOption | null>(() => {
    if (!value) return null
    return options.find((o) => o.id === value) ?? { id: value, label: value }
  }, [value, options])

  if (!visible) return null

  return (
    <Stack sx={{ minWidth: 240 }}>
      <Autocomplete
        size="small"
        options={options}
        value={selected}
        onChange={(_event, option) => onChange(option?.id ?? '')}
        inputValue={inputValue}
        onInputChange={(_event, next) => setInputValue(next)}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, candidate) => option.id === candidate.id}
        // The platform-admin options are whatever the server just answered, so
        // re-filtering them against the same text client-side would drop any
        // match the server made on a field this control does not render (an
        // organization's display name, for instance). The membership options
        // are a local list with no server behind them, so they keep MUI's
        // default client-side filtering.
        filterOptions={isPlatformAdmin ? (opts) => opts : undefined}
        noOptionsText={t('common.organizationFilter.noOptions')}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label ?? t('common.organizationFilter.label')}
            placeholder={t('common.organizationFilter.placeholderAll')}
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps?.htmlInput,
                'data-testid': 'organization-filter-input',
              },
            }}
          />
        )}
      />
      {mayBeTruncated && (
        <FormHelperText data-testid="organization-filter-truncated">
          {t('common.organizationFilter.mayBeTruncated', { count: ORGANIZATION_PAGE_SIZE })}
        </FormHelperText>
      )}
    </Stack>
  )
}

export default OrganizationFilter
