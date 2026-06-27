import { request } from './http';

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const createResourceApi = (path) => ({
  list: (params) => request(withQuery(path, params)),
  get: (id) => request(`${path}/${id}`),
  latest: () => request(`${path}/latest`),
  create: (payload) => request(path, { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => request(`${path}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id) => request(`${path}/${id}`, { method: 'DELETE' }),
  complete: (id) => request(`${path}/${id}/complete`, { method: 'PATCH' }),
  reopen: (id) => request(`${path}/${id}/reopen`, { method: 'PATCH' }),
  archive: (id) => request(`${path}/${id}/archive`, { method: 'PATCH' })
});

export const api = {
  notes: createResourceApi('/notes'),
  tasks: createResourceApi('/tasks'),
  deliverables: createResourceApi('/deliverables'),
  goals: createResourceApi('/goals'),
  projects: createResourceApi('/projects'),
  ideas: createResourceApi('/ideas'),
  context: createResourceApi('/context'),
  reviews: createResourceApi('/reviews'),
  dayPlans: createResourceApi('/day-plans'),
  brainUpdateReports: createResourceApi('/brain-update-reports')
};
