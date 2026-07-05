import { normalizeDeadlineImportance } from "@/lib/deadline-importance";
import { normalizeDeadlineWorkflowStatus } from "@/lib/deadline-access";

export type AdministrativeRiskDeadline = {
  daysUntilDeadline: number;
  hasDocument: boolean;
  importanceLevel: string | null | undefined;
  workflowStatus: string | null | undefined;
};

export type AdministrativeRiskMetric = {
  label: string;
  value: number;
  helper: string;
  className: string;
};

export type AdministrativeRiskDriver = {
  label: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
};

export type AdministrativeRiskRecommendation = {
  title: string;
  description: string;
  href: string;
};

export type AdministrativeRiskReport = {
  score: number;
  level: "setup" | "controlled" | "planned" | "attention" | "critical";
  levelLabel: string;
  title: string;
  description: string;
  badgeClassName: string;
  panelClassName: string;
  progressClassName: string;
  metrics: AdministrativeRiskMetric[];
  drivers: AdministrativeRiskDriver[];
  recommendations: AdministrativeRiskRecommendation[];
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function getDriverClassName(severity: AdministrativeRiskDriver["severity"]) {
  if (severity === "critical") return "border-red-400/25 bg-red-400/10 text-red-100";
  if (severity === "high") return "border-orange-400/25 bg-orange-400/10 text-orange-100";
  if (severity === "medium") return "border-yellow-400/25 bg-yellow-400/10 text-yellow-100";
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
}

function getRiskLevel(score: number, criticalOverdueCount: number) {
  if (criticalOverdueCount > 0 || score <= 49) {
    return {
      level: "critical" as const,
      levelLabel: "Risque critique",
      title: "Des obligations sensibles peuvent exposer l’entreprise.",
      description:
        "Le score détecte des retards ou échéances très urgentes qui doivent être traités avant tout le reste.",
      badgeClassName: "border-red-400/30 bg-red-400/10 text-red-100",
      panelClassName: "border-red-400/20 bg-red-400/10",
      progressClassName: "bg-red-300",
    };
  }

  if (score <= 74) {
    return {
      level: "attention" as const,
      levelLabel: "À sécuriser",
      title: "La situation reste maîtrisable, mais demande une action rapide.",
      description:
        "Certaines échéances approchent, attendent une validation ou manquent encore d’un justificatif.",
      badgeClassName: "border-orange-400/30 bg-orange-400/10 text-orange-100",
      panelClassName: "border-orange-400/20 bg-orange-400/10",
      progressClassName: "bg-orange-300",
    };
  }

  if (score <= 89) {
    return {
      level: "planned" as const,
      levelLabel: "Planifié",
      title: "Les obligations à venir sont visibles suffisamment tôt.",
      description:
        "Votre suivi est sain, avec quelques points à préparer pour conserver une marge de sécurité.",
      badgeClassName: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100",
      panelClassName: "border-yellow-400/20 bg-yellow-400/10",
      progressClassName: "bg-yellow-200",
    };
  }

  return {
    level: "controlled" as const,
    levelLabel: "Sous contrôle",
    title: "Votre santé administrative est solide.",
    description:
      "Aucun signal critique n’est détecté. Les échéances actives sont suivies avec une bonne marge d’anticipation.",
    badgeClassName: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    panelClassName: "border-emerald-400/20 bg-emerald-400/10",
    progressClassName: "bg-emerald-300",
  };
}

export function getRiskDriverClassName(severity: AdministrativeRiskDriver["severity"]) {
  return getDriverClassName(severity);
}

export function calculateAdministrativeRisk(
  deadlines: AdministrativeRiskDeadline[]
): AdministrativeRiskReport {
  if (deadlines.length === 0) {
    return {
      score: 0,
      level: "setup",
      levelLabel: "Initialisation",
      title: "Ajoutez vos premières échéances pour calculer le risque.",
      description:
        "DuePilot analysera ensuite les retards, urgences, documents manquants et validations en attente.",
      badgeClassName: "border-blue-400/30 bg-blue-400/10 text-blue-100",
      panelClassName: "border-blue-400/20 bg-blue-400/10",
      progressClassName: "bg-blue-300",
      metrics: [
        {
          label: "Risque détecté",
          value: 0,
          helper: "Aucune donnée active",
          className: "border-blue-400/20 bg-blue-400/10 text-blue-100",
        },
      ],
      drivers: [
        {
          label: "Base à configurer",
          description: "Ajoutez vos assurances, contrôles, contrats et habilitations pour obtenir une lecture fiable.",
          severity: "low",
        },
      ],
      recommendations: [
        {
          title: "Ajouter une première échéance",
          description: "Commencez par une obligation importante comme une assurance, un contrat ou un contrôle périodique.",
          href: "/deadlines/new",
        },
      ],
    };
  }

  const counters = deadlines.reduce(
    (accumulator, deadline) => {
      const importance = normalizeDeadlineImportance(deadline.importanceLevel);
      const workflowStatus = normalizeDeadlineWorkflowStatus(deadline.workflowStatus);
      const isOverdue = deadline.daysUntilDeadline < 0;
      const isToday = deadline.daysUntilDeadline === 0;
      const isNext7 = deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 7;
      const isNext30 = deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 30;
      const isHighOrCritical = importance === "high" || importance === "critical";

      if (isOverdue) accumulator.overdueCount += 1;
      if (isToday) accumulator.todayCount += 1;
      if (isNext7) accumulator.next7Count += 1;
      if (isNext30) accumulator.next30Count += 1;
      if (importance === "critical") accumulator.criticalCount += 1;
      if (importance === "high") accumulator.highCount += 1;
      if (isOverdue && importance === "critical") accumulator.criticalOverdueCount += 1;
      if (isNext7 && importance === "critical") accumulator.criticalNext7Count += 1;
      if (workflowStatus === "completed") accumulator.pendingValidationCount += 1;
      if (workflowStatus === "in_progress") accumulator.inProgressCount += 1;

      if (!deadline.hasDocument && isNext30) {
        accumulator.missingDocumentNext30Count += 1;
      }

      if (!deadline.hasDocument && isNext30 && isHighOrCritical) {
        accumulator.missingImportantDocumentNext30Count += 1;
      }

      if (isOverdue) {
        if (importance === "critical") accumulator.penalty += 22;
        else if (importance === "high") accumulator.penalty += 16;
        else accumulator.penalty += 10;
      } else if (isToday) {
        if (importance === "critical") accumulator.penalty += 12;
        else if (importance === "high") accumulator.penalty += 8;
        else accumulator.penalty += 5;
      } else if (isNext7) {
        if (importance === "critical") accumulator.penalty += 8;
        else if (importance === "high") accumulator.penalty += 5;
        else accumulator.penalty += 3;
      } else if (isNext30) {
        if (importance === "critical") accumulator.penalty += 4;
        else if (importance === "high") accumulator.penalty += 2;
        else accumulator.penalty += 1;
      }

      if (workflowStatus === "completed") accumulator.penalty += 6;
      if (!deadline.hasDocument && isNext30 && isHighOrCritical) accumulator.penalty += 7;
      else if (!deadline.hasDocument && isNext30) accumulator.penalty += 3;

      return accumulator;
    },
    {
      overdueCount: 0,
      todayCount: 0,
      next7Count: 0,
      next30Count: 0,
      criticalCount: 0,
      highCount: 0,
      criticalOverdueCount: 0,
      criticalNext7Count: 0,
      pendingValidationCount: 0,
      inProgressCount: 0,
      missingDocumentNext30Count: 0,
      missingImportantDocumentNext30Count: 0,
      penalty: 0,
    }
  );

  const score = clampScore(100 - counters.penalty);
  const level = getRiskLevel(score, counters.criticalOverdueCount);
  const drivers: AdministrativeRiskDriver[] = [];

  if (counters.criticalOverdueCount > 0) {
    drivers.push({
      label: "Critique en retard",
      description: `${pluralize(counters.criticalOverdueCount, "échéance très urgente")} déjà dépassée${counters.criticalOverdueCount > 1 ? "s" : ""}.`,
      severity: "critical",
    });
  } else if (counters.overdueCount > 0) {
    drivers.push({
      label: "Retards actifs",
      description: `${pluralize(counters.overdueCount, "échéance")} à régulariser pour réduire le risque global.`,
      severity: "critical",
    });
  }

  if (counters.criticalNext7Count > 0) {
    drivers.push({
      label: "Très urgent sous 7 jours",
      description: `${pluralize(counters.criticalNext7Count, "échéance très urgente")} arrive${counters.criticalNext7Count > 1 ? "nt" : ""} dans la semaine.`,
      severity: "high",
    });
  }

  if (counters.missingImportantDocumentNext30Count > 0) {
    drivers.push({
      label: "Justificatifs sensibles manquants",
      description: `${pluralize(counters.missingImportantDocumentNext30Count, "document important")} à joindre sur des échéances proches.`,
      severity: "high",
    });
  } else if (counters.missingDocumentNext30Count > 0) {
    drivers.push({
      label: "Documents à compléter",
      description: `${pluralize(counters.missingDocumentNext30Count, "document")} manquant${counters.missingDocumentNext30Count > 1 ? "s" : ""} sur les 30 prochains jours.`,
      severity: "medium",
    });
  }

  if (counters.pendingValidationCount > 0) {
    drivers.push({
      label: "Validation admin attendue",
      description: `${pluralize(counters.pendingValidationCount, "échéance")} terminée${counters.pendingValidationCount > 1 ? "s" : ""} par l’équipe mais pas encore archivée${counters.pendingValidationCount > 1 ? "s" : ""}.`,
      severity: "medium",
    });
  }

  if (drivers.length === 0) {
    drivers.push({
      label: "Aucun signal bloquant",
      description: "Les échéances actives ne présentent pas de retard, urgence critique ou document sensible manquant.",
      severity: "low",
    });
  }

  const recommendations: AdministrativeRiskRecommendation[] = [];

  if (counters.overdueCount > 0) {
    recommendations.push({
      title: "Traiter les retards en priorité",
      description: "Ouvrez la liste des échéances et régularisez les obligations dépassées avant les autres actions.",
      href: "/deadlines?status=late",
    });
  }

  if (counters.pendingValidationCount > 0) {
    recommendations.push({
      title: "Valider les actions terminées",
      description: "Archivez les échéances marquées comme faites par l’équipe pour stopper les rappels inutiles.",
      href: "/deadlines?scope=completed",
    });
  }

  if (counters.missingDocumentNext30Count > 0) {
    recommendations.push({
      title: "Compléter les justificatifs proches",
      description: "Ajoutez les Document manquants sur les échéances à moins de 30 jours pour renforcer la traçabilité.",
      href: "/deadlines?status=next30",
    });
  }

  if (counters.next7Count > 0 && recommendations.length < 3) {
    recommendations.push({
      title: "Préparer la semaine à venir",
      description: "Planifiez les actions nécessaires sur les échéances qui arrivent dans les 7 prochains jours.",
      href: "/deadlines?status=next7",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Conserver cette marge d’avance",
      description: "Ajoutez les prochaines obligations dès réception pour garder un score élevé dans le temps.",
      href: "/deadlines/new",
    });
  }

  return {
    score,
    ...level,
    metrics: [
      {
        label: "Retards",
        value: counters.overdueCount,
        helper: counters.criticalOverdueCount > 0 ? "Très urgent inclus" : "À régulariser",
        className: counters.overdueCount > 0 ? "border-red-400/25 bg-red-400/10 text-red-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      },
      {
        label: "Sous 7 jours",
        value: counters.next7Count,
        helper: `${counters.criticalNext7Count} très urgent${counters.criticalNext7Count > 1 ? "s" : ""}`,
        className: counters.next7Count > 0 ? "border-orange-400/25 bg-orange-400/10 text-orange-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      },
      {
        label: "Docs manquants",
        value: counters.missingDocumentNext30Count,
        helper: "Sur 30 jours",
        className: counters.missingDocumentNext30Count > 0 ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      },
      {
        label: "À valider",
        value: counters.pendingValidationCount,
        helper: "Workflow équipe",
        className: counters.pendingValidationCount > 0 ? "border-blue-400/25 bg-blue-400/10 text-blue-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      },
    ],
    drivers: drivers.slice(0, 4),
    recommendations: recommendations.slice(0, 3),
  };
}
