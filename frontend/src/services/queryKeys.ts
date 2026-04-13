export const queryKeys = {
  modules: {
    _def: ['modules'] as const,
    search: (params: { query?: string; limit: number; offset: number; viewMode: string }) =>
      [...queryKeys.modules._def, 'search', params] as const,
  },
  providers: {
    _def: ['providers'] as const,
    search: (params: { query?: string; limit: number; offset: number }) =>
      [...queryKeys.providers._def, 'search', params] as const,
  },
  dashboard: {
    _def: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard._def, 'stats'] as const,
  },
} as const;
