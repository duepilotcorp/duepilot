export const DEADLINE_CATEGORY_OPTIONS = [
  {
    key: "insurance",
    label: "Assurance",
    description: "Contrats, attestations, RC Pro, décennale, véhicules ou locaux.",
    examples: ["RC Pro", "Décennale", "Assurance flotte"],
  },
  {
    key: "contract",
    label: "Contrat",
    description: "Contrats clients, fournisseurs, baux, abonnements ou renouvellements.",
    examples: ["Bail", "Contrat fournisseur", "Maintenance"],
  },
  {
    key: "certification",
    label: "Certification",
    description: "Certifications, labels, qualifications ou renouvellements qualité.",
    examples: ["RGE", "Qualibat", "ISO"],
  },
  {
    key: "authorization",
    label: "Habilitation",
    description: "Autorisations, CACES, habilitations électriques ou formations obligatoires.",
    examples: ["CACES", "Habilitation électrique", "Autorisation de conduite"],
  },
  {
    key: "regulatory_control",
    label: "Contrôle réglementaire",
    description: "Contrôles périodiques, vérifications obligatoires et inspections.",
    examples: ["Extincteurs", "EPI", "VGP"],
  },
  {
    key: "hr",
    label: "RH / salariés",
    description: "Suivi du personnel, visites médicales, documents RH et obligations employeur.",
    examples: ["Visite médicale", "DPAE", "Formation sécurité"],
  },
  {
    key: "finance",
    label: "Banque / finance",
    description: "Documents bancaires, financement, attestations ou dossiers financiers.",
    examples: ["Attestation bancaire", "Crédit", "Caution"],
  },
  {
    key: "tax_accounting",
    label: "Fiscal / comptable",
    description: "Échéances fiscales, comptables, sociales et déclaratives.",
    examples: ["TVA", "URSSAF", "Bilan"],
  },
  {
    key: "legal",
    label: "Juridique",
    description: "Documents légaux, assemblées, mandats, registres et obligations juridiques.",
    examples: ["AG", "Kbis", "Statuts"],
  },
  {
    key: "supplier",
    label: "Fournisseur",
    description: "Suivi fournisseurs, relances, documents à récupérer ou demandes externes.",
    examples: ["Relance fournisseur", "Attestation", "Bon de livraison"],
  },
  {
    key: "administrative_document",
    label: "Document administratif",
    description: "Justificatifs, attestations, dossiers et documents administratifs divers.",
    examples: ["Attestation", "Dossier", "Justificatif"],
  },
  {
    key: "maintenance_security",
    label: "Maintenance / sécurité",
    description: "Entretien, sécurité, maintenance technique et obligations opérationnelles.",
    examples: ["Entretien chaudière", "Sécurité", "Contrôle technique"],
  },
  {
    key: "other",
    label: "Autre",
    description: "À utiliser quand aucune catégorie principale ne correspond exactement.",
    examples: ["Cas spécifique", "Suivi interne", "Tâche libre"],
  },
] as const;

export type DeadlineCategoryKey = (typeof DEADLINE_CATEGORY_OPTIONS)[number]["key"];

export const DEFAULT_DEADLINE_CATEGORY_KEY: DeadlineCategoryKey = "administrative_document";

const CATEGORY_KEYS = new Set<string>(DEADLINE_CATEGORY_OPTIONS.map((category) => category.key));
const CATEGORY_BY_KEY = new Map<string, (typeof DEADLINE_CATEGORY_OPTIONS)[number]>(
  DEADLINE_CATEGORY_OPTIONS.map((category) => [category.key, category])
);

function normalizeText(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

export function normalizeDeadlineCategoryKey(value?: string | null): DeadlineCategoryKey {
  const normalizedValue = (value ?? "").trim();
  if (CATEGORY_KEYS.has(normalizedValue)) return normalizedValue as DeadlineCategoryKey;
  return "other";
}

export function getDeadlineCategoryOption(value?: string | null) {
  return CATEGORY_BY_KEY.get(normalizeDeadlineCategoryKey(value)) ?? CATEGORY_BY_KEY.get("other")!;
}

export function getDeadlineCategoryLabel(value?: string | null) {
  return getDeadlineCategoryOption(value).label;
}

export function inferDeadlineCategoryKey(...values: Array<string | null | undefined>): DeadlineCategoryKey {
  const text = normalizeText(values.filter(Boolean).join(" "));

  if (!text) return DEFAULT_DEADLINE_CATEGORY_KEY;
  if (/(assurance|rc pro|decennale|attestation d'assurance|flotte)/.test(text)) return "insurance";
  if (/(contrat|bail|abonnement|convention|prestation)/.test(text)) return "contract";
  if (/(certification|certificat|label|qualibat|rge|iso|qualification)/.test(text)) return "certification";
  if (/(habilitation|caces|autorisation de conduite|formation obligatoire|permis)/.test(text)) return "authorization";
  if (/(controle reglementaire|controle obligatoire|verification|vgp|extincteur|epi|inspection|periodique)/.test(text)) return "regulatory_control";
  if (/(rh|salarie|salarié|visite medicale|medecine du travail|dpae|personnel|employe|employé)/.test(text)) return "hr";
  if (/(banque|bancaire|finance|financement|credit|crédit|caution|rib)/.test(text)) return "finance";
  if (/(fiscal|comptable|tva|urssaf|bilan|impot|impôt|cotisation|declaration|déclaration)/.test(text)) return "tax_accounting";
  if (/(juridique|legal|légal|kbis|statut|assemblee|assemblée|registre|mandat)/.test(text)) return "legal";
  if (/(fournisseur|prestataire|relance|commande|livraison)/.test(text)) return "supplier";
  if (/(maintenance|entretien|securite|sécurité|chaudiere|chaudière|controle technique|contrôle technique)/.test(text)) return "maintenance_security";
  if (/(document administratif|administratif|attestation|justificatif|dossier|document)/.test(text)) return "administrative_document";

  return "other";
}

export function normalizeCustomCategoryLabel(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export function getDeadlineCategoryDisplay({
  category,
  categoryKey,
  customCategoryLabel,
}: {
  category?: string | null;
  categoryKey?: string | null;
  customCategoryLabel?: string | null;
}) {
  const normalizedCustomLabel = normalizeCustomCategoryLabel(customCategoryLabel);

  if (categoryKey) {
    const mainLabel = getDeadlineCategoryLabel(categoryKey);
    return normalizedCustomLabel ? `${mainLabel} · ${normalizedCustomLabel}` : mainLabel;
  }

  const legacyCategory = normalizeCustomCategoryLabel(category);
  return legacyCategory || "Sans catégorie";
}

export function getDeadlineMainCategoryKey({
  category,
  categoryKey,
}: {
  category?: string | null;
  categoryKey?: string | null;
}) {
  if (categoryKey) return normalizeDeadlineCategoryKey(categoryKey);
  return inferDeadlineCategoryKey(category);
}

export function getDeadlineMainCategoryLabel(input: {
  category?: string | null;
  categoryKey?: string | null;
}) {
  return getDeadlineCategoryLabel(getDeadlineMainCategoryKey(input));
}

export function buildStoredDeadlineCategory({
  categoryKey,
  customCategoryLabel,
}: {
  categoryKey: string;
  customCategoryLabel?: string | null;
}) {
  return getDeadlineCategoryDisplay({
    categoryKey: normalizeDeadlineCategoryKey(categoryKey),
    customCategoryLabel,
  });
}
