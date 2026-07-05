"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateDeadlineWorkflow } from "@/lib/deadline-workflow-actions";
import type { DeadlineVisibility, DeadlineWorkflowStatus } from "@/lib/deadline-access";

type TeamDeadlineWorkflowActionsProps = {
  deadlineId: number;
  status: DeadlineWorkflowStatus;
  visibility: DeadlineVisibility;
  canContribute: boolean;
  canManage: boolean;
  isOwner: boolean;
  claimedByCurrentUser: boolean;
  completedByCurrentUser: boolean;
};

type WorkflowAction = "claim" | "unclaim" | "complete" | "reopen" | "validate";

type ActionButton = {
  action: WorkflowAction;
  label: string;
  className: string;
};

const secondaryButtonClassName =
  "inline-flex justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60";

function getActionButtons({
  status,
  visibility,
  canContribute,
  canManage,
  isOwner,
  claimedByCurrentUser,
  completedByCurrentUser,
}: Omit<TeamDeadlineWorkflowActionsProps, "deadlineId">): ActionButton[] {
  const buttons: ActionButton[] = [];

  if (visibility === "personal") {
    if (!isOwner) return buttons;

    if (status === "open") {
      buttons.push({
        action: "claim",
        label: "Je m’en occupe",
        className:
          "inline-flex justify-center rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-100 transition hover:border-yellow-300/40 hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60",
      });
      buttons.push({
        action: "complete",
        label: "Marquer comme faite",
        className:
          "inline-flex justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60",
      });
    }

    if (status === "in_progress") {
      buttons.push({
        action: "unclaim",
        label: "Annuler en cours",
        className: secondaryButtonClassName,
      });
      buttons.push({
        action: "complete",
        label: "Marquer comme faite",
        className:
          "inline-flex justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60",
      });
    }

    if (status === "archived" || status === "completed") {
      buttons.push({
        action: "reopen",
        label: "Remettre à traiter",
        className: secondaryButtonClassName,
      });
    }

    return buttons;
  }

  if (status === "open" && canContribute) {
    buttons.push({
      action: "claim",
      label: "Je m’en occupe",
      className:
        "inline-flex justify-center rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-100 transition hover:border-yellow-300/40 hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60",
    });
    buttons.push({
      action: "complete",
      label: "Marquer comme faite",
      className:
        "inline-flex justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60",
    });
  }

  if (status === "in_progress") {
    if (canManage || claimedByCurrentUser) {
      buttons.push({
        action: "unclaim",
        label: "Annuler en cours",
        className: secondaryButtonClassName,
      });
    }

    if (canContribute) {
      buttons.push({
        action: "complete",
        label: "Marquer comme faite",
        className:
          "inline-flex justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60",
      });
    }
  }

  if (status === "completed") {
    if (canManage) {
      buttons.push({
        action: "validate",
        label: "Valider et archiver",
        className:
          "inline-flex justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60",
      });
    }

    if (canManage || completedByCurrentUser) {
      buttons.push({
        action: "reopen",
        label: "Annuler “faite”",
        className: secondaryButtonClassName,
      });
    }
  }

  if (status === "archived" && canManage) {
    buttons.push({
      action: "reopen",
      label: "Restaurer dans les échéances actives",
      className: secondaryButtonClassName,
    });
  }

  return buttons;
}

export default function TeamDeadlineWorkflowActions({
  deadlineId,
  status,
  visibility,
  canContribute,
  canManage,
  isOwner,
  claimedByCurrentUser,
  completedByCurrentUser,
}: TeamDeadlineWorkflowActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const buttons = getActionButtons({
    status,
    visibility,
    canContribute,
    canManage,
    isOwner,
    claimedByCurrentUser,
    completedByCurrentUser,
  });

  const runAction = (action: WorkflowAction) => {
    setMessage("");
    setErrorMessage("");

    startTransition(async () => {
      const result = await updateDeadlineWorkflow({ deadlineId, action });

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    });
  };

  if (buttons.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
        {visibility === "team"
          ? "Votre rôle permet de consulter cette échéance d’équipe, sans modifier son suivi."
          : "Aucune action de suivi n’est disponible dans l’état actuel."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {buttons.map((button) => (
          <button
            key={button.action}
            type="button"
            onClick={() => runAction(button.action)}
            disabled={isPending}
            className={button.className}
          >
            {button.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
