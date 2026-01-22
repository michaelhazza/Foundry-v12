const API_BASE_URL = '/api';
const TOKEN_KEY = 'auth_token';

interface ApiOptions {
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    timestamp: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(this.baseUrl + path, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const { params, data, headers: customHeaders } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        if (!path.includes('/auth/')) {
          window.location.href = '/login';
        }
      }

      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred',
          },
        };
      }

      throw new ApiRequestError(
        errorData.error.message,
        errorData.error.code,
        response.status
      );
    }

    if (response.status === 204) {
      return { data: null as T };
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('GET', path, { params });
  }

  async post<T>(path: string, body?: unknown, options?: ApiOptions) {
    return this.request<T>('POST', path, { ...options, data: body });
  }

  async patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { data: body });
  }

  async put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, { data: body });
  }

  async delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  async upload<T>(path: string, file: File, fieldName = 'file') {
    const formData = new FormData();
    formData.append(fieldName, file);

    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new ApiRequestError(
        errorData.error.message,
        errorData.error.code,
        response.status
      );
    }

    return response.json() as Promise<ApiResponse<T>>;
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const api = new ApiClient(API_BASE_URL);
