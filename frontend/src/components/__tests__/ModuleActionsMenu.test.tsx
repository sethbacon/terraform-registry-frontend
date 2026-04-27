import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ModuleActionsMenu from '../ModuleActionsMenu'

describe('ModuleActionsMenu', () => {
  it('renders nothing when canManage is false', () => {
    const { container } = render(
      <ModuleActionsMenu canManage={false} deprecated={false} onDeleteModule={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('opens on click and shows destructive actions', async () => {
    const user = userEvent.setup()
    render(
      <ModuleActionsMenu
        canManage
        deprecated={false}
        onDeprecateModule={vi.fn()}
        onDeleteModule={vi.fn()}
        onEditDescription={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /module actions/i }))
    expect(screen.getByRole('menuitem', { name: /edit description/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /deprecate module/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /delete module/i })).toBeInTheDocument()
  })

  it('shows undeprecate when module is deprecated', async () => {
    const user = userEvent.setup()
    render(
      <ModuleActionsMenu
        canManage
        deprecated
        onUndeprecateModule={vi.fn()}
        onDeleteModule={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /module actions/i }))
    expect(screen.getByRole('menuitem', { name: /undeprecate module/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /^deprecate module$/i })).not.toBeInTheDocument()
  })

  it('invokes the correct handler and closes the menu', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<ModuleActionsMenu canManage deprecated={false} onDeleteModule={onDelete} />)
    await user.click(screen.getByRole('button', { name: /module actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete module/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('includes publish action when includePublishAction is true', async () => {
    const onPublish = vi.fn()
    const user = userEvent.setup()
    render(
      <ModuleActionsMenu
        canManage
        deprecated={false}
        includePublishAction
        onPublishNewVersion={onPublish}
        onDeleteModule={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /module actions/i }))
    const item = screen.getByRole('menuitem', { name: /publish new version/i })
    await user.click(item)
    expect(onPublish).toHaveBeenCalledTimes(1)
  })

  it('omits publish action by default', async () => {
    const user = userEvent.setup()
    render(
      <ModuleActionsMenu
        canManage
        deprecated={false}
        onPublishNewVersion={vi.fn()}
        onDeleteModule={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /module actions/i }))
    expect(screen.queryByRole('menuitem', { name: /publish new version/i })).not.toBeInTheDocument()
  })
})
