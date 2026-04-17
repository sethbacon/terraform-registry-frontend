import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Remove thing"
        description="This cannot be undone."
      />,
    );
    expect(screen.getByText('Remove thing')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders severity icons for each level', () => {
    const { rerender } = render(
      <ConfirmDialog open onClose={vi.fn()} title="T" severity="info" />,
    );
    expect(screen.getByTestId('confirm-dialog-icon-info')).toBeInTheDocument();
    rerender(<ConfirmDialog open onClose={vi.fn()} title="T" severity="warning" />);
    expect(screen.getByTestId('confirm-dialog-icon-warning')).toBeInTheDocument();
    rerender(<ConfirmDialog open onClose={vi.fn()} title="T" severity="error" />);
    expect(screen.getByTestId('confirm-dialog-icon-error')).toBeInTheDocument();
  });

  it('blocks confirm until typeToConfirmText matches', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Delete module"
        typeToConfirmText="myorg/vpc/aws"
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();

    const input = screen.getByTestId('confirm-dialog-type-input');
    await user.type(input, 'wrong');
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/does not match/i)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'myorg/vpc/aws');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('typeToConfirm comparison is case-sensitive', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="X"
        typeToConfirmText="Match"
      />,
    );
    const input = screen.getByTestId('confirm-dialog-type-input');
    await user.type(input, 'match');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('renders fields and passes collected values to onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        title="Deprecate"
        fields={[
          { id: 'message', label: 'Deprecation message', multiline: true, required: true },
        ]}
        confirmLabel="Deprecate"
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Deprecate' });
    expect(confirm).toBeDisabled(); // required field is empty
    const field = screen.getByTestId('confirm-dialog-field-message');
    await user.type(field, 'Please migrate to v2');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ message: 'Please migrate to v2' });
    });
  });

  it('keeps loading state while onConfirm promise is pending', async () => {
    const user = userEvent.setup();
    let resolve: () => void = () => { };
    const onConfirm = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    render(
      <ConfirmDialog open onClose={vi.fn()} onConfirm={onConfirm} title="T" />,
    );
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolve();
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
  });

  it('surfaces errors from onConfirm without closing', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('server blew up'));
    const onClose = vi.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="T" />,
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog-error')).toHaveTextContent('server blew up');
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('onClose is called when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={vi.fn()} title="T" />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respects external loading prop', () => {
    render(
      <ConfirmDialog open onClose={vi.fn()} onConfirm={vi.fn()} title="T" loading />,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
