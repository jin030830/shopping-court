export const caseKeys = {
  all: ['case'] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
  votes: (id: string) => [...caseKeys.detail(id), 'vote'] as const,
  userVote: (id: string, userId: string) => [...caseKeys.votes(id), userId] as const,
  comments: (id: string) => [...caseKeys.detail(id), 'comments'] as const,
};
