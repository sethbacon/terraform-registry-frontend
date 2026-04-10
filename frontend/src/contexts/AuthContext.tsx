import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextType, RoleTemplateInfo } from '../types';
import api from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roleTemplate, setRoleTemplate] = useState<RoleTemplateInfo | null>(null);
  const [allowedScopes, setAllowedScopes] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    // Clear local session state and storage first
    setUser(null);
    setRoleTemplate(null);
    setAllowedScopes([]);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('role_template');
    localStorage.removeItem('allowed_scopes');
    // Clear any API key authorised in the Swagger UI "Authorize" dialog.
    // swagger-ui-react persists this under the key "authorized" when persistAuthorization
    // is enabled; leaving it in localStorage would expose the key across sessions.
    localStorage.removeItem('authorized');
    // Redirect to the backend logout endpoint, which terminates the OIDC SSO session
    // at the identity provider level. Without this, the IdP session remains active and
    // clicking "Login with OIDC" again would silently re-authenticate the user.
    api.logout();
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.getCurrentUserWithRole();
      setUser(response.user);
      setRoleTemplate(response.role_template || null);
      setAllowedScopes(response.allowed_scopes || []);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('role_template', JSON.stringify(response.role_template));
      localStorage.setItem('allowed_scopes', JSON.stringify(response.allowed_scopes));
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      logout();
    }
  }, [logout]);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    const storedRoleTemplate = localStorage.getItem('role_template');
    const storedAllowedScopes = localStorage.getItem('allowed_scopes');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        if (storedRoleTemplate) {
          setRoleTemplate(JSON.parse(storedRoleTemplate));
        }
        if (storedAllowedScopes) {
          setAllowedScopes(JSON.parse(storedAllowedScopes));
        }
        setIsAuthenticated(true);
        // Refresh user data from server
        fetchCurrentUser();
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('role_template');
        localStorage.removeItem('allowed_scopes');
      }
    } else if (token) {
      // Token exists but no cached user (e.g. fresh OIDC login where only the token
      // was stored). Mark authenticated optimistically and fetch user from the server.
      setIsAuthenticated(true);
      fetchCurrentUser();
    }
    setIsLoading(false);
  }, [fetchCurrentUser]);

  const login = async (userOrProvider: User | 'oidc' | 'azuread'): Promise<void> => {
    if (typeof userOrProvider === 'string') {
      // OAuth login - redirects to OAuth provider
      api.login(userOrProvider);
    } else {
      // Direct user object (dev mode) - SECURITY: Always fetch actual user data from API
      // Never trust client-provided user data for authorization decisions
      console.log('AuthContext: Dev login initiated, fetching user from API');
      setIsAuthenticated(true);
      // Immediately fetch actual user data including scopes from the server
      // and wait for it to complete before returning
      await fetchCurrentUser();
    }
  };

  const refreshToken = async () => {
    try {
      const response = await api.refreshToken();
      localStorage.setItem('auth_token', response.token);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
    }
  };

  const setToken = (token: string) => {
    localStorage.setItem('auth_token', token);
    setIsAuthenticated(true);
    // User data will be refreshed on page reload
  };

  const value: AuthContextType = {
    user,
    roleTemplate,
    allowedScopes,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
    setToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
