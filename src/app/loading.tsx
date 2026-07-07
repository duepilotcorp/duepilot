import DuePilotTransitionLoader from "@/components/DuePilotTransitionLoader";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#020617] px-6 text-white">
      <DuePilotTransitionLoader message="Chargement de votre espace…" />
    </main>
  );
}
