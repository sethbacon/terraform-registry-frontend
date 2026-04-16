import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionExpiryWarning from '../SessionExpiryWarning';
import type { AuthContextType } from '../../types';

// Import hoisted mock so we can reconfigure per test.
const mockAuth = vi.hoisted(() => ({
  value: {
    user: null,
    roleTemplate: null,
    allowedScopes: [],
    isAuthenticated: true,
    isLoading: false,
    sessionExpiresAt: null,
    sessionExpiresSoon: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    setToken: vi.fn(),
  } as AuthContextType,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth.value,
}));

function setAuth(patch: Partial<AuthContextType>) {
  mockAuth.value = { ...mockAuth.value, ...patch } as AuthContextType;
}

describe('SessionExpiryWarning (roadmap 4.2)', () => {
  beforeEach(() => {
    setAuth({
      isAuthenticated: true,
      sessionExpiresSoon: false,
      sessionExpiresAt: null,
      refreshToken: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
    });
  });

  it('renders nothing when sessionExpiresSoon is false', () => {
    render(<SessionExpiryWarning />);
    expect(screen.queryByTestId('session-expiry-warning')).toBeNull();
  });

  it('renders nothing when unauthenticated', () => {
    setAuth({ isAuthenticated: false, sessionExpiresSoon: true });
    render(<SessionExpiryWarning />);
    expect(screen.queryByTestId('session-expiry-warning')).toBeNull();
  });

  it('renders Snackbar when sessionExpiresSoon is true', () => {
    setAuth({ sessionExpiresSoon: true });
    render(<SessionExpiryWarning />);
    expect(screen.getByTestId('session-expiry-warning')).toBeInTheDocument();
    expect(screen.getByText(/your session expires in 2 minutes/i)).toBeInTheDocument();
  });

  it('clicking Refresh session calls refreshToken', async () => {
    const refreshToken = vi.fn().mockResolvedValue(undefined);
    setAuth({ sessionExpiresSoon: true, refreshToken });
    render(<SessionExpiryWarning />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('session-expiry-refresh'));
    });
    await waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1));
  });

  it('clicking Sign out calls logout', () => {
    const logout = vi.fn();
    setAuth({ sessionExpiresSoon: true, logout });
    render(<SessionExpiryWarning />);
    fireEvent.click(screen.getByTestId('session-expiry-signout'));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
