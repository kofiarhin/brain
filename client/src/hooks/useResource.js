import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/resources';

export function useResource(name) {
  const queryClient = useQueryClient();
  const resource = api[name];
  const query = useQuery({ queryKey: [name], queryFn: resource.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [name] });
  return {
    ...query,
    create: useMutation({ mutationFn: resource.create, onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, payload }) => resource.update(id, payload), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: resource.remove, onSuccess: invalidate }),
    complete: useMutation({ mutationFn: resource.complete, onSuccess: invalidate }),
    reopen: useMutation({ mutationFn: resource.reopen, onSuccess: invalidate }),
    archive: useMutation({ mutationFn: resource.archive, onSuccess: invalidate }),
    reschedule: useMutation({ mutationFn: ({ id, payload }) => resource.reschedule(id, payload), onSuccess: invalidate })
  };
}
