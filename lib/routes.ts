export const routes = {
  familyDashboard: "/family/dashboard",
  familyElder: (elderId: string) => `/family/elder/${encodeURIComponent(elderId)}`,
  familyVisit: (visitId: string) => `/family/visits/${encodeURIComponent(visitId)}`,
  nurseDashboard: "/nurse/dashboard",
  nurseClients: "/nurse/clients",
  nurseClient: (elderId: string) => `/nurse/clients/${encodeURIComponent(elderId)}`,
} as const;
