import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, LoginRequest, AuthContextType } from '../types/auth';
import { authService } from '../services/auth';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          // Decode JWT to check for requires2FASetup flag
          const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));

          // If token requires 2FA setup, user is NOT fully authenticated
          if (tokenPayload.requires2FASetup) {
            console.log('⚠️ Token requires 2FA setup - user not fully authenticated');
            // Keep token for 2FA setup API calls but don't mark as authenticated
            setToken(storedToken);
            setUser(null); // User is null until 2FA is completed
          } else {
            // Normal authenticated user
            const userData = JSON.parse(storedUser);
            setToken(storedToken);
            setUser(userData);
          }
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await authService.login(credentials);
      
      // TEMPORARY: This hook only handles User (legacy), not PartnerEmployee
      // Partner login will be handled by a separate hook in next checkpoint
      if ('type' in response && response.type === 'partner') {
        throw new Error('Partner login not supported in this context. Use Partner login page.');
      }
      
      const { token: newToken, user: newUser } = response as any;
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      setToken(newToken);
      setUser(newUser as any); // Temporary cast for compilation
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};