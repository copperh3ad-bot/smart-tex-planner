import { QueryClient } from '@tanstack/react-query';

// Retry with exponential backoff, skip retry on 429
const shouldRetry = (failureCount, error) => {
  if (error?.response?.status === 429) return false;
  if (error?.message?.includes('Rate limit')) return false;
  return failureCount < 2;
};

const retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000);

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,   // use cached data if within staleTime
      retry: shouldRetry,
      retryDelay,
      staleTime: 5 * 60 * 1000,   // 5 minutes — data considered fresh
      gcTime: 10 * 60 * 1000,     // 10 minutes — keep in memory
    },
    mutations: {
      retry: 0,
    },
  },
});