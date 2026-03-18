"use client";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bell, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationPreferences {
  all_enabled: boolean;
  follow_up_reminders: boolean;
  inactivity_nudges: boolean;
  limit_warnings: boolean;
  limit_reset: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  all_enabled: true,
  follow_up_reminders: true,
  inactivity_nudges: true,
  limit_warnings: true,
  limit_reset: true,
};

// ── Toggle component ──────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  "aria-label": string;
}

function Toggle({ id, checked, disabled = false, onChange, "aria-label": ariaLabel }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-input",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  saving?: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ id, label, description, checked, disabled = false, saving = false, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1 space-y-0.5">
        <label
          htmlFor={id}
          className={cn(
            "text-sm font-medium leading-none",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {label}
        </label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Toggle
          id={id}
          checked={checked}
          disabled={disabled || saving}
          onChange={onChange}
          aria-label={label}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Track which key (if any) is currently being saved
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await api.get("/api/v1/users/me");
        if (res.ok) {
          const data = await res.json();
          const raw = data.notification_preferences;
          setPrefs(
            raw && typeof raw === "object"
              ? { ...DEFAULT_PREFERENCES, ...raw }
              : { ...DEFAULT_PREFERENCES }
          );
        } else {
          setLoadError("Failed to load your notification preferences.");
        }
      } catch {
        setLoadError("Unable to connect. Check your internet connection.");
      }
    }

    fetchPrefs();
  }, []);

  // Cleanup success timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleToggle(key: keyof NotificationPreferences, next: boolean) {
    if (!prefs || savingKey) return;

    const previous = { ...prefs };
    const updated = { ...prefs, [key]: next };

    // Optimistic update
    setPrefs(updated);
    setSavingKey(key);
    setSaveError(null);
    setSaveSuccess(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);

    try {
      const res = await api.patch("/api/v1/users/me", {
        notification_preferences: updated,
      });

      if (res.ok) {
        setSaveSuccess(true);
        successTimerRef.current = setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        // Revert on API error
        setPrefs(previous);
        setSaveError("Failed to save your preference. Please try again.");
      }
    } catch {
      // Revert on network error
      setPrefs(previous);
      setSaveError("Unable to connect. Check your internet connection.");
    } finally {
      setSavingKey(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const allEnabled = prefs?.all_enabled ?? true;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage which notifications you receive from Light Role.
        </p>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {!prefs && !loadError && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border p-5">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-4 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-56 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <div className="rounded-lg border border-border p-5">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mt-4 flex items-center justify-between py-1">
                <div className="space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-52 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {prefs && (
        <div className="space-y-6">
          {/* Save error */}
          {saveError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Save success */}
          {saveSuccess && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
              <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Preference saved.</span>
            </div>
          )}

          {/* ── Global Settings card ── */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Global Settings</h3>
            </div>
            <div className="px-5">
              <ToggleRow
                id="pref-all-enabled"
                label="All Notifications"
                description="Enable or disable all notifications at once. When off, you will not receive any notifications."
                checked={prefs.all_enabled}
                saving={savingKey === "all_enabled"}
                onChange={(next) => handleToggle("all_enabled", next)}
              />
            </div>
          </div>

          {/* ── Notification Types card ── */}
          <div className="rounded-lg border border-border bg-card">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notification Types</h3>
              {!allEnabled && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Enable "All Notifications" above to configure individual preferences.
                </p>
              )}
            </div>
            <div className="divide-y divide-border px-5">
              <ToggleRow
                id="pref-follow-up-reminders"
                label="Follow-up Reminders"
                description="Get reminded to follow up on job applications you have not heard back from."
                checked={prefs.follow_up_reminders}
                disabled={!allEnabled}
                saving={savingKey === "follow_up_reminders"}
                onChange={(next) => handleToggle("follow_up_reminders", next)}
              />
              <ToggleRow
                id="pref-inactivity-nudges"
                label="Inactivity Nudges"
                description="Receive a nudge when you have not added or updated any jobs recently."
                checked={prefs.inactivity_nudges}
                disabled={!allEnabled}
                saving={savingKey === "inactivity_nudges"}
                onChange={(next) => handleToggle("inactivity_nudges", next)}
              />
              <ToggleRow
                id="pref-limit-warnings"
                label="Limit Warnings"
                description="Get notified when you are approaching your monthly AI operations limit."
                checked={prefs.limit_warnings}
                disabled={!allEnabled}
                saving={savingKey === "limit_warnings"}
                onChange={(next) => handleToggle("limit_warnings", next)}
              />
              <ToggleRow
                id="pref-limit-reset"
                label="Limit Reset"
                description="Get notified when your monthly AI operations limit resets."
                checked={prefs.limit_reset}
                disabled={!allEnabled}
                saving={savingKey === "limit_reset"}
                onChange={(next) => handleToggle("limit_reset", next)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
