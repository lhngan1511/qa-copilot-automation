import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 15_000,
            retry: (failureCount, error) =>
                failureCount < 1 && (!error?.status || error.status >= 500),
            refetchOnWindowFocus: false
        }
    }
});
