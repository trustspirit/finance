export const queryKeys = {
  requests: {
    all: (projectId: string) => ['requests', projectId] as const,
    byUser: (projectId: string, uid: string) => ['requests', projectId, 'user', uid] as const,
    detail: (id: string) => ['requests', id] as const,
    approved: (projectId: string) => ['requests', projectId, 'approved'] as const,
  },
  projects: {
    root: () => ['projects'] as const,
    all: (uid: string) => ['projects', uid] as const,
  },
  settlements: {
    all: (projectId: string) => ['settlements', projectId] as const,
    detail: (id: string) => ['settlements', id] as const,
  },
  users: {
    all: () => ['users'] as const,
    detail: (uid: string) => ['users', uid] as const,
  },
  settings: {
    global: () => ['settings', 'global'] as const,
  },
} as const
