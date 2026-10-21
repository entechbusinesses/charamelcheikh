import { Plus, type LucideIcon } from "lucide-react";

export default function Title({
  title,
  Icon,
  onClick,
  add,
  btnText = "Ajouter",
  btnIcon: BtnIcon = Plus,
  description,
}: {
  title: string;
  description: string;
  Icon: any;
  add?: boolean;
  onClick?: () => void;
  btnText?: string;
  btnIcon?: LucideIcon;
}) {
  return (
    <header className="mt-4 mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 md:mt-2 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {add && (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 md:w-auto"
        >
          <BtnIcon className="size-4" />
          {btnText || "Ajouter"}
        </button>
      )}
    </header>
  );
}
