"use client";

export default function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex justify-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-400"
    >
      Imprimer / enregistrer en PDF
    </button>
  );
}
