import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const sizes: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  full: "max-w-[96vw] h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)]",
};

const openModals: symbol[] = [];

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra buttons shown in the header, left of the close button */
  headerActions?: ReactNode;
  /** Sticky footer, always visible under the scrollable body */
  footer?: ReactNode;
  size?: ModalSize;
  /** Prevents closing (X, Escape) while e.g. saving */
  closeDisabled?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Shared modal: header (title + red close button), a body that scrolls
 * when the content is taller than the screen, and an optional footer.
 * Rendered in a portal so it always covers the whole page (navbar included).
 */
export default function Modal({
  open = true,
  onClose,
  title,
  description,
  headerActions,
  footer,
  size = "md",
  closeDisabled = false,
  bodyClassName,
  children,
}: ModalProps) {
  // Escape closes only the top-most modal (modals can be stacked)
  useEffect(() => {
    if (!open) return;
    const id = Symbol();
    openModals.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || closeDisabled) return;
      if (openModals[openModals.length - 1] === id) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openModals.splice(openModals.indexOf(id), 1);
    };
  }, [open, closeDisabled, onClose]);

  // Lock page scroll behind the modal
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "modal-panel flex w-full max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl",
          sizes[size]
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">
              {title}
            </h2>
            {description && (
              <div className="mt-0.5 text-sm text-gray-500">{description}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              title="Fermer"
              aria-label="Fermer"
              className="rounded-lg bg-red-100 p-2 text-red-600 transition-colors hover:bg-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-6" />
            </button>
          </div>
        </div>

        {/* Body (scrolls) */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6",
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
