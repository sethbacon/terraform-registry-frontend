import { useState } from 'react'

/**
 * Shared MUI `TablePagination` state (0-based page + rows-per-page) and its
 * standard change handlers.
 *
 * Extracted from the page/rowsPerPage state that was independently
 * reimplemented in AuditLogPage, MirrorsPage, SecurityScanningPage and
 * UsersPage (each with its own copy of the "reset to page 0 on rows-per-page
 * change" handler). `setPage` is still exposed directly for callers that need
 * to reset pagination in response to filter/search changes.
 */
export function usePagination(initialRowsPerPage: number) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage)

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  return {
    page,
    rowsPerPage,
    setPage,
    setRowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
  }
}
