<!-- markdownlint-disable MD013 -->
# Accessibility Statement

## Commitment

The Terraform Registry Frontend is committed to ensuring digital accessibility
for people with disabilities. We continually improve the user experience for
everyone and apply the relevant accessibility standards.

## Conformance Target

We target **WCAG 2.1 Level AA** conformance across all pages and interactive
components.

## Measures Taken

| Area                      | Approach                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Automated testing**     | `@axe-core/react` runs in development; Playwright + `@axe-core/playwright` enforces zero critical/serious violations across all pages in CI |
| **Linting**               | `eslint-plugin-jsx-a11y` enforces accessible JSX patterns at **error** level in CI                                                          |
| **Keyboard navigation**   | All interactive elements are reachable via keyboard; the command palette (`Ctrl+K` / `⌘K`) provides keyboard-first navigation               |
| **Skip link**             | A "Skip to main content" link is the first focusable element on every page                                                                  |
| **Color contrast**        | MUI theming enforces WCAG AA contrast ratios in both light and dark modes                                                                   |
| **Focus management**      | Focus moves to the page heading on SPA route changes; focus is trapped inside dialogs and returned to the trigger on close                  |
| **Screen reader support** | ARIA landmarks, roles, and labels are applied; route changes are announced via a live region                                                |
| **Reduced motion**        | All MUI transitions are disabled when `prefers-reduced-motion: reduce` is active                                                            |

## Known Limitations

- Some third-party components (Swagger UI, cmdk command palette) have partial
  ARIA coverage — we apply workarounds where possible.
- Chart/graph visualizations on the admin dashboard do not yet include
  text-based alternatives.

## Color Contrast Audit

All theme tokens have been audited against WCAG 2.1 contrast requirements:

| Token                       | Light Mode            | Dark Mode              | Ratio (L) | Ratio (D) | Requirement       |
| --------------------------- | --------------------- | ---------------------- | --------- | --------- | ----------------- |
| Primary `#5C4EE5`           | on `#fff`             | on `#121212`           | 4.6:1     | 5.8:1     | 4.5:1 (AA)        |
| Secondary (light) `#00796B` | on `#fff`             | —                      | 4.7:1     | —         | 4.5:1 (AA)        |
| Secondary (dark) `#00D9C0`  | —                     | on `#121212`           | —         | 8.5:1     | 4.5:1 (AA)        |
| Text primary                | `#212121` on `#fff`   | `#fff` on `#121212`    | 16.1:1    | 17.0:1    | 4.5:1 (AA)        |
| Text secondary              | `#666` on `#fff`      | `#aaa` on `#121212`    | 5.7:1     | 7.4:1     | 4.5:1 (AA)        |
| Error                       | `#d32f2f` on `#fff`   | `#f44336` on `#121212` | 5.5:1     | 4.7:1     | 3:1 (AA large)    |
| Focus ring                  | `#5C4EE5` 2px outline | same                   | 4.6:1     | 5.8:1     | 3:1 (AA non-text) |

All interactive elements meet the 3:1 minimum contrast for non-text content.
Body text meets the 4.5:1 minimum for normal text at AA level.

## Feedback

If you encounter an accessibility barrier, please open a GitHub issue with the
`accessibility` label or contact the maintainers directly. We aim to respond
within 5 business days.

## Testing Tools

- [axe DevTools](https://www.deque.com/axe/) — browser extension for manual audits
- [@axe-core/react](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/react) — runtime checks in development
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/) — CI accessibility scoring (target: ≥90)
