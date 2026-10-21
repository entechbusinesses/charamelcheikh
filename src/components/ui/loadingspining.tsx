export function LoadingSpinning({
  fullScreen = false,
  inline = false,
  label = "Chargement…",
}: {
  fullScreen?: boolean;
  // Compact variant for sections, lists and modals
  inline?: boolean;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center ${
        fullScreen
          ? "min-h-[100dvh] bg-slate-50"
          : inline
            ? "w-full h-full min-h-40 py-10"
            : "min-h-[60vh]"
      }`}
    >
      {/* Léger délai d'apparition pour éviter un flash sur les chargements rapides */}
      <div className="flex flex-col items-center gap-4 opacity-0 animate-[loader-in_200ms_ease-out_150ms_forwards]">
        <div className="relative size-10">
          <span className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
          <span className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <style>{`@keyframes loader-in { to { opacity: 1 } }`}</style>
    </div>
  );
}
