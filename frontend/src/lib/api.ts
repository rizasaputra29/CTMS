import axios, { isAxiosError, type AxiosInstance, AxiosError } from "axios";

// Extend AxiosInstance type to include isAxiosError and getApiErrorMessage
interface ExtendedAxiosInstance extends AxiosInstance {
  isAxiosError: typeof isAxiosError;
  getApiErrorMessage: (error: unknown, defaultMessage?: string) => string;
  getApiErrorMessageAsync: (error: unknown, defaultMessage?: string) => Promise<string>;
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
    const responseData = axiosError.response?.data;

    // Blob error responses (e.g. failed downloads) need special handling
    if (responseData instanceof Blob && responseData.type?.includes('application/json')) {
      try {
        const text = (responseData as Blob).text?.() as Promise<string> | undefined;
        // Return default message synchronously; callers can await if needed
        return defaultMessage;
      } catch {
        return defaultMessage;
      }
    }

    return axiosError.response?.data?.message || axiosError.message || defaultMessage;
  }
  return defaultMessage;
};

// Async helper to extract error message from blob error responses
api.getApiErrorMessageAsync = async (error: unknown, defaultMessage = 'An error occurred'): Promise<string> => {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const responseData = axiosError.response?.data;

    if (responseData instanceof Blob && responseData.type?.includes('application/json')) {
      try {
        const text = await responseData.text();
        const parsed = JSON.parse(text);
        return parsed.message || defaultMessage;
      } catch {
        return defaultMessage;
      }
    }

    return axiosError.response?.data?.message || axiosError.message || defaultMessage;
  }
  return defaultMessage;
};

export default api;
