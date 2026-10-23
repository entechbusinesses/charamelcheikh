import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import {
  enablePushNotifications,
  pushUnsupportedReason,
  sendTestNotification,
} from "@/lib/pushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { notifyError } from "@/lib/notify";

type State = "unsupported" | NotificationPermission;

// Push state of this device for the logged-in admin (shared by the desktop bell and the mobile popup)
function usePushNotifications() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [state, setState] = useState<State | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const why = await pushUnsupportedReason();
      if (why) {
        setReason(why);
        return setState("unsupported");
      }
      const permission = Notification.permission;
      setState(permission);
      // Already allowed: refresh the token silently (tokens can rotate).
      // For a non-admin the server drops this device's token instead.
      if (permission === "granted") {
        enablePushNotifications().catch((e) => {
          if (isAdmin) console.error("Push register failed:", e);
        });
      }
    })();
    // Re-run per account, so switching admins on this device re-links the token
  }, [user?.id, isAdmin]);

  const enable = async () => {
    setBusy(true);
    try {
      if (state === "granted") await sendTestNotification();
      else setState(await enablePushNotifications());
    } catch (error) {
      console.error("Push notifications error:", error);
      setState(Notification.permission);
    } finally {
      setBusy(false);
    }
  };

  return { userId: user?.id, isAdmin, state, reason, busy, enable };
}

// Bell in the desktop navbar (admins only): enables push on this device; once enabled, a click sends a test notification.
function NotificationButton({ className = "" }: { className?: string }) {
  const { isAdmin, state, reason, busy, enable } = usePushNotifications();

  if (!isAdmin || !state) return null;

  const onClick = async () => {
    if (state === "unsupported") {
      notifyError(null, reason ?? "Notifications non supportées sur cet appareil.");
      return;
    }
    if (state === "denied") {
      notifyError(
        null,
        "Les notifications sont bloquées. Autorisez-les dans les paramètres du navigateur pour ce site."
      );
      return;
    }
    await enable();
  };

  const Icon =
    state === "granted" ? BellRing : state === "default" ? Bell : BellOff;
  const title =
    state === "granted"
      ? "Notifications activées — cliquer pour un test"
      : state === "denied"
      ? "Notifications bloquées"
      : state === "unsupported"
      ? "Notifications indisponibles sur cet appareil"
      : "Activer les notifications";

  return (
    <button onClick={onClick} disabled={busy} title={title} className={className}>
      <Icon className="size-full" />
    </button>
  );
}

// Per account: closing the popup for one admin must not hide it for the others on this device
const dismissKey = (userId?: number) => `notif-prompt-dismissed-${userId}`;

// Phone (admins only): popup at the top asking to enable push, instead of a bell in the bottom bar.
// Hidden once notifications are allowed, or after this user closes it on this device.
export function NotificationPrompt() {
  const { userId, isAdmin, state, reason, busy, enable } = usePushNotifications();
  const [dismissedFor, setDismissedFor] = useState<number | undefined>();
  const dismissed = (() => {
    if (dismissedFor === userId) return true;
    try {
      return localStorage.getItem(dismissKey(userId)) === "1";
    } catch {
      return false;
    }
  })();

  if (!isAdmin || !state || state === "granted" || dismissed) return null;

  const dismiss = () => {
    setDismissedFor(userId);
    try {
      localStorage.setItem(dismissKey(userId), "1");
    } catch {
      /* private mode: just hide for this session */
    }
  };

  const message =
    state === "default"
      ? "Activez les notifications pour être alerté sur ce téléphone."
      : state === "denied"
      ? "Les notifications sont bloquées. Autorisez-les dans les paramètres du navigateur."
      : reason;

  return (
    <div className="md:hidden fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-lg">
      <div className="flex size-9 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600">
        {state === "default" ? <Bell className="size-5" /> : <BellOff className="size-5" />}
      </div>
      <div className="flex-1 text-sm text-slate-700">
        <p>{message}</p>
        {state === "default" && (
          <button
            onClick={enable}
            disabled={busy}
            className="mt-2 rounded-lg bg-main px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Activer
          </button>
        )}
      </div>
      <button onClick={dismiss} className="flex-none p-1 text-slate-400" title="Fermer">
        <X className="size-4" />
      </button>
    </div>
  );
}

export default NotificationButton;
