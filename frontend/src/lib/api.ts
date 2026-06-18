import axios, { isAxiosError, type AxiosInstance, AxiosError } from "axios";

// Extend AxiosInstance type to include isAxiosError and getApiErrorMessage
interface ExtendedAxiosInstance extends AxiosInstance {
  isAxiosError: typeof isAxiosError;
  getApiErrorMessage: (error: unknown, defaultMessage?: string) => string;
}

// Environment-based API URL configuration
const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "https://148.230.99.31/api";
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
  withXSRFToken: true, // CRITICAL: Required for Sanctum CSRF protection (fixes 401 errors)
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

export default api;
