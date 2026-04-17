import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title only with no actions', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-primary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-secondary')).not.toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="t" description="Helpful hint" />);
    expect(screen.getByText('Helpful hint')).toBeInTheDocument();
  });

  it('fires primaryAction on click', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="t"
        primaryAction={{ label: 'Do it', onClick }}
      />,
    );
    fireEvent.click(screen.getByTestId('empty-state-primary'));
    expect(onClick).toHaveBeenCalled();
  });

  it('fires secondaryAction on click', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="t"
        secondaryAction={{ label: 'Learn more', onClick }}
      />,
    );
    fireEvent.click(screen.getByTestId('empty-state-secondary'));
    expect(onClick).toHaveBeenCalled();
  });

  it('accepts a custom icon', () => {
    render(
      <EmptyState
        title="t"
        icon={<svg data-testid="custom-icon" />}
      />,
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('uses a custom data-testid root', () => {
    render(<EmptyState title="t" data-testid="users-empty" />);
    expect(screen.getByTestId('users-empty')).toBeInTheDocument();
  });
});
