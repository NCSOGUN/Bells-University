export const routes = {
  familyDashboard: "/family/dashboard",
  familyElder: (elderId: string) => `/family/elder/${encodeURIComponent(elderId)}`,
  familyVisit: (visitId: string) => `/family/visits/${encodeURIComponent(visitId)}`,
} as const;
