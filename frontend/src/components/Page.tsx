// Re-exported from the suite facade (`src/suite`); the local module path is
// preserved for the pages that already import it.
//
// This file was a one-line seam onto the package before #603 and is a one-line
// seam onto the facade now, so the hop buys THIS file nothing. It exists so the
// facade can be the app's only importer of the package without exception —
// `suite/__tests__/suiteFacade.test.ts` asserts exactly that, and an absolute
// rule is the one a reader can trust and a reviewer can enforce.
export type { PageProps } from '../suite'
export { Page as default } from '../suite'
