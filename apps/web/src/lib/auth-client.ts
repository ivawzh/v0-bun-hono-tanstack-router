import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc as rpc } from '@/utils/orpc';
import { useNavigate } from '@tanstack/react-router';

export function useRefreshAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useLogin() {
  const refreshAll = useRefreshAll();
  const navigate = useNavigate();

  const mutation = useMutation(
    rpc.auth.login.mutationOptions({
      onSuccess: (data: any) => {
        if (data.rpcRedirect) {
          window.location.href = data.location;
        }
        refreshAll();
      },
    }),
  );

  return { ...mutation, login: () => mutation.mutate({}) };
}

export function useLogout() {
  const refreshAll = useRefreshAll();
  const navigate = useNavigate();

  const mutation = useMutation(
    rpc.auth.logout.mutationOptions({
      onSuccess: (data: any) => {
        if (data.rpcRedirect) {
          navigate({ to: data.location });
        }
        refreshAll();
      },
    }),
  );

  return { ...mutation, logout: () => mutation.mutate({}) };
}

export function useAuth() {
  return useQuery(
    rpc.auth.authenticate.queryOptions({
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true,
    })
  );
}

export function useSession() {
  const auth = useAuth();
  
  return {
    data: auth.data && typeof auth.data === 'object' && 'email' in auth.data ? {
      user: {
        email: (auth.data as any).email,
        name: (auth.data as any).name || (auth.data as any).email,
        id: (auth.data as any).email,
      }
    } : null,
    isLoading: auth.isLoading,
    error: auth.error,
  };
}
