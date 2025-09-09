import axios, { AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const partnerApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add partner auth token
partnerApi.interceptors.request.use(
  (config) => {
    const partnerToken = localStorage.getItem('partnerToken');
    if (partnerToken) {
      config.headers.Authorization = `Bearer ${partnerToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
partnerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear partner authentication data
      localStorage.removeItem('partnerToken');
      localStorage.removeItem('partnerEmployee');
      localStorage.removeItem('partnerCompany');
      window.location.href = '/partner/login';
    }
    
    // Extract meaningful error message from backend
    if (error.response?.data?.error) {
      const backendError = new Error(error.response.data.error);
      backendError.name = 'BackendError';
      return Promise.reject(backendError);
    }
    
    return Promise.reject(error);
  }
);

export const partnerApiRequest = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response = await partnerApi(config);
  return response.data;
};

export default partnerApi;