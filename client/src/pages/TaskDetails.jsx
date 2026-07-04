import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/resources';
import { TaskDetailPanel } from './Tasks';

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [executionTask, setExecutionTask] = useState(null);

  const taskQuery = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id),
    enabled: Boolean(id),
    retry: false,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects.list,
    retry: false,
  });

  const refresh = (task) => {
    queryClient.setQueryData(['tasks', id], task);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const update = useMutation({ mutationFn: (payload) => api.tasks.update(id, payload), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: () => api.tasks.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/tasks');
    },
  });
  const complete = useMutation({ mutationFn: () => api.tasks.complete(id), onSuccess: refresh });
  const archive = useMutation({ mutationFn: () => api.tasks.archive(id), onSuccess: refresh });
  const dismiss = useMutation({ mutationFn: (payload) => api.tasks.dismiss(id, payload), onSuccess: refresh });
  const convert = useMutation({ mutationFn: (payload) => api.tasks.convert(id, payload), onSuccess: refresh });
  const reschedule = useMutation({ mutationFn: (payload) => api.tasks.reschedule(id, payload), onSuccess: refresh });

  const task = taskQuery.data;
  const actions = {
    update: (_id, payload) => update.mutateAsync(payload),
    remove: () => remove.mutateAsync(),
    complete: () => complete.mutateAsync(),
    archive: () => archive.mutateAsync(),
    dismiss: (_id, payload) => dismiss.mutateAsync(payload),
    convert: (_id, payload) => convert.mutateAsync(payload),
    reschedule: (_id, payload) => reschedule.mutateAsync(payload),
  };

  if (taskQuery.isLoading) return <div className="text-sm text-slate-500">Loading task...</div>;
  if (taskQuery.isError) return <div className="space-y-4">
    <Link to="/tasks" className="inline-flex rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900">Back to tasks</Link>
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100">Task could not be loaded.</div>
  </div>;

  return <div className="min-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
    <div className="border-b border-slate-800 p-4">
      <Link to="/tasks" className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">Back to tasks</Link>
    </div>
    <TaskDetailPanel task={task} projects={projectsQuery.data || []} actions={actions} onEnterExecution={setExecutionTask} onBack={() => navigate('/tasks')} compact />
    {executionTask ? <div className="fixed inset-0 z-50 bg-slate-950 p-6">
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => setExecutionTask(null)} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-900">Exit execution mode</button>
        <h1 className="mt-8 break-words text-3xl font-semibold">{task.title}</h1>
        <p className="mt-4 leading-7 text-slate-300">{task.expectedDeliverable || task.description || 'Focus on the next concrete step.'}</p>
        <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm leading-6 text-slate-300">{task.notes || 'No notes yet.'}</pre>
        <button type="button" onClick={() => complete.mutateAsync().then(() => setExecutionTask(null))} className="mt-6 min-h-11 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-500">Complete</button>
      </div>
    </div> : null}
  </div>;
}
