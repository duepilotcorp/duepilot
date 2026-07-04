export type DeadlineTemplateSector = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
};

export type DeadlineTemplate = {
  id: string;
  sectorId: string;
  title: string;
  category: string;
  description: string;
  riskLabel: string;
  recommendedNotificationDays: number[];
};

export const DEADLINE_TEMPLATE_SECTORS: DeadlineTemplateSector[] = [
  {
    id: "btp",
    label: "BTP & artisans",
    shortLabel: "BTP",
    description:
      "Assurances, qualifications, contrôles sécurité et obligations chantier.",
  },
  {
    id: "commerce",
    label: "Commerce & retail",
    shortLabel: "Commerce",
    description:
      "Baux, assurances, sécurité du local, contrats fournisseurs et conformité.",
  },
  {
    id: "restauration",
    label: "Restauration",
    shortLabel: "Resto",
    description:
      "Hygiène, sécurité, matériel, contrats et obligations d’exploitation.",
  },
  {
    id: "transport",
    label: "Transport & flotte",
    shortLabel: "Transport",
    description:
      "Véhicules, assurances, contrôles techniques, permis et contrats de flotte.",
  },
  {
    id: "immobilier",
    label: "Immobilier & locaux",
    shortLabel: "Immo",
    description:
      "Baux, diagnostics, assurances, maintenance et contrôles réglementaires.",
  },
  {
    id: "general",
    label: "Entreprise générale",
    shortLabel: "Général",
    description:
      "Socle commun utile à la majorité des TPE, PME et structures B2B.",
  },
];

export const DEADLINE_TEMPLATES: DeadlineTemplate[] = [
  {
    id: "btp-rc-pro",
    sectorId: "btp",
    title: "Assurance RC Pro",
    category: "Assurance",
    description:
      "Suivre le renouvellement de la responsabilité civile professionnelle.",
    riskLabel: "Perte de couverture",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "btp-decennale",
    sectorId: "btp",
    title: "Attestation décennale",
    category: "Assurance",
    description:
      "Anticiper le renouvellement de l’attestation décennale à fournir aux clients.",
    riskLabel: "Blocage chantier",
    recommendedNotificationDays: [30, 15, 7, 3, 1],
  },
  {
    id: "btp-qualibat-rge",
    sectorId: "btp",
    title: "Certification RGE / QUALIBAT",
    category: "Certification",
    description:
      "Suivre la validité d’une qualification ou certification professionnelle.",
    riskLabel: "Perte qualification",
    recommendedNotificationDays: [30, 15, 7, 3, 1],
  },
  {
    id: "btp-extincteurs",
    sectorId: "btp",
    title: "Contrôle extincteurs",
    category: "Contrôle réglementaire",
    description:
      "Planifier la vérification périodique du matériel de sécurité incendie.",
    riskLabel: "Non-conformité sécurité",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "btp-verification-electrique",
    sectorId: "btp",
    title: "Vérification électrique",
    category: "Sécurité",
    description:
      "Surveiller la prochaine vérification des installations électriques.",
    riskLabel: "Risque sécurité",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "btp-epi-harnais",
    sectorId: "btp",
    title: "Contrôle EPI / harnais",
    category: "Sécurité",
    description:
      "Ne pas oublier le contrôle des équipements de protection individuelle.",
    riskLabel: "Risque chantier",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "btp-visite-medicale",
    sectorId: "btp",
    title: "Visite médicale salariés",
    category: "Habilitation",
    description:
      "Suivre les échéances de suivi médical liées aux postes et interventions.",
    riskLabel: "Blocage RH",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "commerce-bail-commercial",
    sectorId: "commerce",
    title: "Renouvellement bail commercial",
    category: "Contrat",
    description:
      "Anticiper une échéance de bail, une révision ou une renégociation.",
    riskLabel: "Risque local",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "commerce-assurance-local",
    sectorId: "commerce",
    title: "Assurance local professionnel",
    category: "Assurance",
    description:
      "Suivre la couverture du local, du stock et de l’activité commerciale.",
    riskLabel: "Perte de couverture",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "commerce-alarme-securite",
    sectorId: "commerce",
    title: "Maintenance alarme / sécurité",
    category: "Sécurité",
    description:
      "Planifier la maintenance des systèmes d’alarme, caméra ou contrôle d’accès.",
    riskLabel: "Risque exploitation",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "commerce-contrat-tpe",
    sectorId: "commerce",
    title: "Contrat terminal de paiement",
    category: "Contrat",
    description:
      "Anticiper le renouvellement ou la renégociation du contrat TPE.",
    riskLabel: "Coût fournisseur",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "commerce-extincteurs",
    sectorId: "commerce",
    title: "Contrôle extincteurs boutique",
    category: "Contrôle réglementaire",
    description:
      "Suivre la vérification périodique du matériel incendie du local.",
    riskLabel: "Non-conformité sécurité",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "commerce-contrat-fournisseur",
    sectorId: "commerce",
    title: "Contrat fournisseur critique",
    category: "Contrat",
    description:
      "Prévoir une renégociation, reconduction ou résiliation de contrat stratégique.",
    riskLabel: "Rupture fournisseur",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "restauration-hygiene-haccp",
    sectorId: "restauration",
    title: "Contrôle hygiène / HACCP",
    category: "Contrôle réglementaire",
    description:
      "Centraliser une échéance liée aux procédures d’hygiène et de sécurité alimentaire.",
    riskLabel: "Non-conformité hygiène",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "restauration-maintenance-froid",
    sectorId: "restauration",
    title: "Maintenance groupe froid",
    category: "Entretien obligatoire",
    description:
      "Suivre l’entretien des équipements frigorifiques critiques pour l’activité.",
    riskLabel: "Interruption activité",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "restauration-hotte-extraction",
    sectorId: "restauration",
    title: "Nettoyage hotte / extraction",
    category: "Entretien obligatoire",
    description:
      "Anticiper le prochain nettoyage ou contrôle du système d’extraction.",
    riskLabel: "Risque incendie",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "restauration-assurance-pro",
    sectorId: "restauration",
    title: "Assurance restaurant",
    category: "Assurance",
    description:
      "Surveiller la couverture du local, du matériel, de l’exploitation et de la RC Pro.",
    riskLabel: "Perte de couverture",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "restauration-deratisation",
    sectorId: "restauration",
    title: "Contrat dératisation / nuisibles",
    category: "Contrat",
    description:
      "Suivre les interventions ou le renouvellement du contrat de lutte nuisibles.",
    riskLabel: "Risque hygiène",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "restauration-extincteurs",
    sectorId: "restauration",
    title: "Contrôle extincteurs cuisine",
    category: "Contrôle réglementaire",
    description:
      "Planifier la vérification du matériel incendie du restaurant.",
    riskLabel: "Non-conformité sécurité",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "transport-controle-technique",
    sectorId: "transport",
    title: "Contrôle technique véhicule",
    category: "Contrôle technique",
    description:
      "Suivre l’échéance de contrôle technique d’un véhicule professionnel.",
    riskLabel: "Immobilisation véhicule",
    recommendedNotificationDays: [30, 15, 7, 3, 1],
  },
  {
    id: "transport-assurance-flotte",
    sectorId: "transport",
    title: "Assurance flotte automobile",
    category: "Assurance",
    description:
      "Centraliser le renouvellement de l’assurance flotte ou véhicule.",
    riskLabel: "Perte de couverture",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "transport-entretien-vehicule",
    sectorId: "transport",
    title: "Entretien véhicule utilitaire",
    category: "Entretien obligatoire",
    description:
      "Prévoir les maintenances et échéances importantes de la flotte.",
    riskLabel: "Panne / immobilisation",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "transport-carte-conducteur",
    sectorId: "transport",
    title: "Carte conducteur",
    category: "Document administratif",
    description:
      "Suivre l’expiration d’une carte conducteur ou document professionnel.",
    riskLabel: "Blocage activité",
    recommendedNotificationDays: [30, 15, 7, 3, 1],
  },
  {
    id: "transport-permis-habilitation",
    sectorId: "transport",
    title: "Permis / habilitation conducteur",
    category: "Habilitation",
    description:
      "Surveiller une validité de permis, habilitation ou autorisation interne.",
    riskLabel: "Blocage RH",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "transport-location-longue-duree",
    sectorId: "transport",
    title: "Contrat location longue durée",
    category: "Contrat",
    description:
      "Anticiper fin de contrat, restitution, renouvellement ou renégociation.",
    riskLabel: "Coût flotte",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "immobilier-bail-pro",
    sectorId: "immobilier",
    title: "Échéance bail professionnel",
    category: "Contrat",
    description:
      "Suivre une date de révision, renouvellement ou préavis de bail.",
    riskLabel: "Risque locatif",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "immobilier-diagnostics",
    sectorId: "immobilier",
    title: "Diagnostics obligatoires",
    category: "Document administratif",
    description:
      "Centraliser les diagnostics à renouveler pour des locaux ou biens.",
    riskLabel: "Non-conformité dossier",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "immobilier-maintenance-chaudiere",
    sectorId: "immobilier",
    title: "Maintenance chaudière / CVC",
    category: "Entretien obligatoire",
    description:
      "Planifier l’entretien des équipements de chauffage, ventilation ou climatisation.",
    riskLabel: "Risque technique",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "immobilier-assurance-pno",
    sectorId: "immobilier",
    title: "Assurance local / PNO",
    category: "Assurance",
    description:
      "Suivre la couverture d’un local, bien ou espace professionnel.",
    riskLabel: "Perte de couverture",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "immobilier-verification-electrique",
    sectorId: "immobilier",
    title: "Vérification installation électrique",
    category: "Sécurité",
    description:
      "Anticiper une vérification technique liée aux installations du local.",
    riskLabel: "Risque sécurité",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "immobilier-accessibilite",
    sectorId: "immobilier",
    title: "Dossier accessibilité ERP",
    category: "Document administratif",
    description:
      "Garder une échéance liée à l’accessibilité ou au dossier ERP.",
    riskLabel: "Non-conformité ERP",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "general-rc-pro",
    sectorId: "general",
    title: "Assurance RC Pro",
    category: "Assurance",
    description:
      "Surveiller le renouvellement de la responsabilité civile professionnelle.",
    riskLabel: "Perte de couverture",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "general-contrat-comptable",
    sectorId: "general",
    title: "Contrat expert-comptable",
    category: "Contrat",
    description:
      "Prévoir reconduction, renégociation ou changement de prestataire.",
    riskLabel: "Risque administratif",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "general-nom-domaine",
    sectorId: "general",
    title: "Renouvellement nom de domaine",
    category: "Document administratif",
    description:
      "Éviter l’expiration d’un domaine critique pour l’activité ou les emails.",
    riskLabel: "Interruption numérique",
    recommendedNotificationDays: [30, 15, 7, 3, 1],
  },
  {
    id: "general-licence-logiciel",
    sectorId: "general",
    title: "Licence logiciel critique",
    category: "Contrat",
    description:
      "Suivre le renouvellement d’un outil indispensable à l’équipe.",
    riskLabel: "Blocage outil",
    recommendedNotificationDays: [30, 7, 1],
  },
  {
    id: "general-document-legal",
    sectorId: "general",
    title: "Document légal à renouveler",
    category: "Document administratif",
    description:
      "Créer un suivi générique pour une attestation ou obligation administrative.",
    riskLabel: "Risque dossier",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
  {
    id: "general-contrat-fournisseur",
    sectorId: "general",
    title: "Contrat fournisseur critique",
    category: "Contrat",
    description:
      "Anticiper la date de reconduction ou de renégociation d’un fournisseur clé.",
    riskLabel: "Risque fournisseur",
    recommendedNotificationDays: [30, 15, 7, 1],
  },
];

export function getTemplateSectorLabel(sectorId: string) {
  return (
    DEADLINE_TEMPLATE_SECTORS.find((sector) => sector.id === sectorId)?.label ??
    "Secteur"
  );
}
