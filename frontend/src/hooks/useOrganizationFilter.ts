import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * The URL search parameter the organization filter lives in.
 *
 * Exported so tests and callers name it once rather than restating the literal.
 */
export const ORGANIZATION_PARAM = 'org'

/**
 * The currently-selected organization filter, held in the URL query string.
 *
 * WHY THE URL AND NOT localStorage (#779 asks and does not answer).
 *
 * This is a filter, not a session-wide context, and the storage should say so:
 *
 *  - A filter belongs to the view being looked at. Putting it in the URL makes
 *    a narrowed view LINKABLE — "here is the API-key list for this org" is a
 *    URL you can paste into a ticket, which is the thing people actually want
 *    from these pages. localStorage produces a link that shows the recipient
 *    something different from what the sender saw.
 *  - It survives reload and Back/Forward for free, which was the requirement
 *    behind the question, without inventing a persistence layer.
 *  - localStorage would make it a HIDDEN GLOBAL: a value set once on one page
 *    that silently narrows every other page, forever, with no visible cause.
 *    That is a context wearing a filter's clothes, and it is exactly the
 *    ambiguity ("which org am I in?") the filter/context decision rejected.
 *
 * The consequence is deliberate and worth stating: the selection does NOT
 * follow the user from one page to the next, because each page's URL carries
 * its own. That is the difference between a filter and a context, made visible.
 *
 * ABSENT MEANS "EVERYTHING THE CALLER MAY SEE" — never "some default
 * organization". The parameter is deleted rather than set to an empty value
 * when cleared, so an unfiltered view has a clean URL and no caller can read a
 * present-but-empty `org=` as a selection.
 */
export function useOrganizationFilter(): {
  organizationId: string
  setOrganizationId: (organizationId: string) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const organizationId = searchParams.get(ORGANIZATION_PARAM) ?? ''

  const setOrganizationId = useCallback(
    (next: string) => {
      // Functional update: the page's other query parameters (and anything a
      // concurrent update just wrote) are preserved rather than clobbered by a
      // stale copy of the params captured at render time.
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next) {
            params.set(ORGANIZATION_PARAM, next)
          } else {
            params.delete(ORGANIZATION_PARAM)
          }
          return params
        },
        // Filtering is not navigation: replace rather than push, so the Back
        // button leaves the page instead of walking back through every
        // organization the user tried.
        //
        // NOT A GUARD, and deliberately not presented as one. Flipping this to
        // `false` breaks no test — the selection, the URL and the request are
        // all identical either way, and only the length of the history stack
        // differs. It is a UX judgement kept for the same reason the comment
        // above gives, and the honest label is "preference", not "protection".
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { organizationId, setOrganizationId }
}
