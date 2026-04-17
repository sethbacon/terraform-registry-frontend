# Accessibility Statement

## Commitment

The Terraform Registry Frontend is committed to ensuring digital accessibility
for people with disabilities. We continually improve the user experience for
everyone and apply the relevant accessibility standards.

## Conformance Target

We target **WCAG 2.1 Level AA** conformance across all pages and interactive
components.

## Measures Taken

| Area                      | Approach                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Automated testing**     | `@axe-core/react` runs in development mode and reports violations to the browser console                                      |
| **Linting**               | `eslint-plugin-jsx-a11y` enforces accessible JSX patterns in CI                                                               |
| **Keyboard navigation**   | All interactive elements are reachable via keyboard; the command palette (`Ctrl+K` / `⌘K`) provides keyboard-first navigation |
| **Skip link**             | A "Skip to main content" link is the first focusable element on every page                                                    |
| **Color contrast**        | MUI theming enforces WCAG AA contrast ratios in both light and dark modes                                                     |
| **Focus management**      | Focus is trapped inside dialogs and returned to the trigger on close                                                          |
| **Screen reader support** | ARIA landmarks, roles, and labels are applied to navigation, forms, and dynamic content                                       |
| **Reduced motion**        | Animations respect `prefers-reduced-motion` via MUI's built-in support                                                        |

## Known Limitations

- Some third-party components (Swagger UI, cmdk command palette) have partial
  ARIA coverage — we apply workarounds where possible.
- Chart/graph visualizations on the admin dashboard do not yet include
  text-based alternatives.

## Feedback

If you encounter an accessibility barrier, please open a GitHub issue with the
`accessibility` label or contact the maintainers directly. We aim to respond
within 5 business days.

## Testing Tools

- [axe DevTools](https://www.deque.com/axe/) — browser extension for manual audits
- [@axe-core/react](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/react) — runtime checks in development
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/) — CI accessibility scoring (target: ≥90)
