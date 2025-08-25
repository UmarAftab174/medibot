// useAuth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";

interface User {
  user_id: number;
  name: string;
  email: string;
  age: number;
  bmi: number;
  gender: "male" | "female" | "other";
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (userData: {
    name: string;
    email: string;
    password: string;
    age: number;
    bmi: number;
    gender: "male" | "female" | "other";
  }) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updateProfile: (userData: {
    name?: string;
    age?: number;
    bmi?: number;
    gender?: "male" | "female" | "other";
    new_password?: string;
  }) => Promise<boolean>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem("accessToken"));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem("refreshToken"));
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile on mount if tokens exist
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (accessToken) {
        try {
          const response = await axios.get(`${API_URL}/profile`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          setUser(response.data.user);
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
      }
      setIsLoading(false);
    };
    fetchUserProfile();
  }, [accessToken]);

  // Axios interceptor for token refresh on 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && refreshToken) {
          try {
            const response = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
            const { access_token } = response.data;
            setAccessToken(access_token);
            localStorage.setItem("accessToken", access_token);
            error.config.headers.Authorization = `Bearer ${access_token}`;
            return axios(error.config);
          } catch (refreshError) {
            setUser(null);
            setAccessToken(null);
            setRefreshToken(null);
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [refreshToken]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { user, access_token, refresh_token } = response.data;
      setUser(user);
      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      localStorage.setItem("accessToken", access_token);
      localStorage.setItem("refreshToken", refresh_token);
      setIsLoading(false);
      return true;
    } catch (error) {
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (userData: {
    name: string;
    email: string;
    password: string;
    age: number;
    bmi: number;
    gender: "male" | "female" | "other";
  }): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/signup`, userData);
      const { user, access_token, refresh_token } = response.data;
      setUser(user);
      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      localStorage.setItem("accessToken", access_token);
      localStorage.setItem("refreshToken", refresh_token);
      setIsLoading(false);
      return true;
    } catch (error) {
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (refreshToken) {
        await axios.post(
          `${API_URL}/auth/logout`,
          { refresh_token: refreshToken },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      }
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setIsLoading(false);
      return true;
    } catch (error) {
      setIsLoading(false);
      return false;
    }
  };

  const updateProfile = async (userData: {
    name?: string;
    age?: number;
    bmi?: number;
    gender?: "male" | "female" | "other";
    new_password?: string;
  }): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await axios.put(
        `${API_URL}/profile`,
        userData,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setUser(response.data.user);
      setIsLoading(false);
      return true;
    } catch (error) {
      setIsLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, login, signup, logout, updateProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}