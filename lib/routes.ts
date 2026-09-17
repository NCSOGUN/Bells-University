export const routes = {
  home: "/",
  familyPlans: "/family/plans",
  familySignup: "/family/signup",
  familyRelative: "/family/relative",
  familyMatching: "/family/matching",
  familyPayment: "/family/payment",
  familyConfirmed: "/family/confirmed",
  familyDashboard: "/family/dashboard",
  familyElder: (elderId: string) => `/family/elder/${encodeURIComponent(elderId)}`,
  familyVisit: (visitId: string) => `/family/visits/${encodeURIComponent(visitId)}`,
  // N1 arrives in Session 5.
  nurseLanding: "/nurse",
  nurseDashboard: "/nurse/dashboard",
  nurseClients: "/nurse/clients",
  nurseClient: (elderId: string) => `/nurse/clients/${encodeURIComponent(elderId)}`,
} as const;
