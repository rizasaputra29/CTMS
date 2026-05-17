import axios, { isAxiosError, AxiosInstance, AxiosError } from "axios";

// Extend AxiosInstance type to include isAxiosError and getApiErrorMessage
interface ExtendedAxiosInstance extends AxiosInstance {
  isAxiosError: typeof isAxiosError;
  getApiErrorMessage: (error: unknown, defaultMessage?: string) => string;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
}) as ExtendedAxiosInstance;

// Add isAxiosError helper to api object
api.isAxiosError = isAxiosError;

// Helper to extract error message from API error
api.getApiErrorMessage = (error: unknown, defaultMessage = 'An error occurred'): string => {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    return axiosError.response?.data?.message || defaultMessage;
  }
  return defaultMessage;
};

// Always attach token from localStorage on every request
// This prevents 401 race conditions when pages load before AuthContext initializes
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
