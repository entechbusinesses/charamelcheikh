import { useEffect, useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { API_BASE_URL } from "@/apis/api";
import { cn } from "@/lib/utils";

/**
 * Server image (e.g. "/uploads/x.png") that shows `fallback` instead of the
 * browser's broken-image icon when the path is empty or the file is missing.
 * `fallback={null}` hides it completely (logos on tickets, home page).
 */
export default function SafeImage({
  path,
  alt = "",
  className,
  fallback,
  fallbackClassName,
}: {
  path?: string | null;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
  /** size/colors of the default icon box */
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);

  if (!path || failed) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-100 text-gray-400",
          className,
          fallbackClassName
        )}
        aria-label={alt}
      >
        <ImageOff className="size-1/3 min-h-4 min-w-4 max-h-10 max-w-10" />
      </div>
    );
  }

  return (
    <img
      src={`${API_BASE_URL}${path}`}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
