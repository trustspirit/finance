export const queryKeys = {
  requests: {
    all: (projectId: string) => ['requests', projectId] as const,
    byUser: (projectId: string, uid: string) => ['requests', projectId, 'user', uid] as const,
    detail: (id: string) => ['requests', id] as const,
    approved: (projectId: string) => ['requests', projectId, 'approved'] as const,
    infinite: (projectId: string) => ['requests', projectId, 'infinite'] as const,
    infiniteByStatus: (projectId: string, status: string) => ['requests', projectId, 'infinite', status] as const,
    infiniteByUser: (projectId: string, uid: string) => ['requests', projectId, 'infinite', 'user', uid] as const,
  },
  projects: {
    root: () => ['projects'] as const,
    all: (uid: string) => ['projects', uid] as const,
  },
  settlements: {
    all: (projectId: string) => ['settlements', projectId] as const,
    detail: (id: string) => ['settlements', id] as const,
    infinite: (projectId: string) => ['settlements', projectId, 'infinite'] as const,
  },
  users: {
    all: () => ['users'] as const,
    detail: (uid: string) => ['users', uid] as const,
    infinite: () => ['users', 'infinite'] as const,
  },
  settings: {
    global: () => ['settings', 'global'] as const,
  },
} as const
