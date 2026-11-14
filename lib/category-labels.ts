// Plain-words names for the fixed sensitive categories (docs/api.md, POST /api/facts/{id}/category). Client-safe.
export const CATEGORY_LABELS: Record<string, string> = {
  sexual_reproductive: "Sexual and reproductive health",
  mental_health: "Mental health",
  infectious_disease: "Infectious disease",
  substance_use: "Substance use",
  other_sensitive: "Other sensitive",
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);
