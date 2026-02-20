import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, RoleTemplateInfo } from '../types';
import { apiClient } from '../services/api';

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
        // Refresh user data
        fetchCurrentUser();
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('role_template');
        localStorage.removeItem('allowed_scopes');
      }
    }
    setIsLoading(false);
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.getCurrentUserWithRole();
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
  };

  const login = async (userOrProvider: User | 'oidc' | 'azuread'): Promise<void> => {
    if (typeof userOrProvider === 'string') {
      // OAuth login - redirects to OAuth provider
      apiClient.login(userOrProvider);
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

  const logout = () => {
    setUser(null);
    setRoleTemplate(null);
    setAllowedScopes([]);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('role_template');
    localStorage.removeItem('allowed_scopes');
  };

  const refreshToken = async () => {
    try {
      const response = await apiClient.refreshToken();
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
