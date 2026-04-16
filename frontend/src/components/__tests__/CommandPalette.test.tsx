import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette, { filterByScope, defaultCommands } from '../CommandPalette';

const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../services/api', () => ({
  default: {
    searchModules: vi.fn().mockResolvedValue({ modules: [] }),
    searchProviders: vi.fn().mockResolvedValue({ providers: [] }),
  },
}));

function setAuth(overrides: { isAuthenticated?: boolean; allowedScopes?: string[] } = {}) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    allowedScopes: ['admin'],
    ...overrides,
  });
}

function renderPalette(open = true) {
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={() => { }} />
    </MemoryRouter>,
  );
}

describe('filterByScope', () => {
  it('returns everything when user has admin scope', () => {
    expect(filterByScope(defaultCommands, ['admin']).length).toBe(defaultCommands.length);
  });

  it('hides scope-gated items without matching scope', () => {
    const result = filterByScope(defaultCommands, []);
    expect(result.find((i) => i.path === '/admin/users')).toBeUndefined();
    // unscoped entries remain
    expect(result.find((i) => i.path === '/admin/apikeys')).toBeDefined();
  });

  it('reveals items when the required scope is present', () => {
    const result = filterByScope(defaultCommands, ['users:read']);
    expect(result.find((i) => i.path === '/admin/users')).toBeDefined();
    expect(result.find((i) => i.path === '/admin/storage')).toBeUndefined();
  });
});

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    setAuth();
  });

  it('renders an input and navigation group when open', () => {
    renderPalette(true);
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Modules')).toBeInTheDocument();
  });

  it('is not rendered when closed', () => {
    renderPalette(false);
    expect(screen.queryByTestId('command-palette-input')).not.toBeInTheDocument();
  });

  it('hides admin group when unauthenticated', () => {
    setAuth({ isAuthenticated: false, allowedScopes: [] });
    renderPalette(true);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('navigates and closes when selecting a nav item', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette open onClose={onClose} />
      </MemoryRouter>,
    );
    // Click the Modules item
    fireEvent.click(screen.getByText('Modules'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/modules');
    });
    expect(onClose).toHaveBeenCalled();
  });
});
