"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface User {
  id: string;
  email: string;
  auth_provider: string;
  is_verified: boolean;
}

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// Delete flow: step 1 = warning, step 2 = type DELETE confirmation
type DeleteStep = "warning" | "confirm";

export default function SecuritySettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Change password state
  const [pwServerError, setPwServerError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("warning");
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isOAuthUser = user?.auth_provider === "google";

  const {
    register,
    handleSubmit,
    reset: resetPasswordForm,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await api.get("/api/v1/users/me");
        if (res.ok) {
          const data: User = await res.json();
          setUser(data);
        } else {
          setLoadError("Failed to load your account information.");
        }
      } catch {
        setLoadError("Unable to connect. Check your internet connection.");
      }
    }

    fetchUser();
  }, []);

  async function onChangePassword(values: ChangePasswordFormValues) {
    setPwServerError(null);
    setPwSuccess(false);

    try {
      const res = await api.post("/api/v1/auth/change-password", {
        current_password: values.current_password,
        new_password: values.new_password,
      });

      if (res.ok) {
        setPwSuccess(true);
        resetPasswordForm();
      } else if (res.status === 400 || res.status === 401) {
        setPwServerError("Your current password is incorrect. Please try again.");
      } else if (res.status === 422) {
        setPwServerError("Please check your input and try again.");
      } else {
        setPwServerError("Something went wrong. Please try again.");
      }
    } catch {
      setPwServerError("Unable to connect. Check your internet connection.");
    }
  }

  function openDeleteDialog() {
    setDeleteStep("warning");
    setDeleteInput("");
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  function handleDeleteDialogClose(open: boolean) {
    if (!open && isDeleting) return; // prevent closing while request in flight
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteStep("warning");
      setDeleteInput("");
      setDeleteError(null);
    }
  }

  async function handleConfirmDelete() {
    if (deleteInput !== "DELETE") return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await api.delete("/api/v1/users/me");
      if (res.ok || res.status === 204) {
        // Redirect clears all client state
        window.location.href = "/auth/login";
      } else {
        setDeleteError("Something went wrong while deleting your account. Please try again.");
        setIsDeleting(false);
      }
    } catch {
      setDeleteError("Unable to connect. Check your internet connection.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your password and account security.
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
      {!user && !loadError && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      )}

      {user && (
        <>
          {/* ── Change Password ── */}
          {isOAuthUser ? (
            <div className="rounded-lg border border-border bg-muted/30 p-5">
              <h3 className="text-base font-semibold text-foreground">Password</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                You signed in with Google. Password-based login is not available for your account.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground">Change Password</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a strong password to keep your account secure.
                </p>
              </div>

              <form onSubmit={handleSubmit(onChangePassword)} className="space-y-5">
                {/* Current password */}
                <div className="space-y-1.5">
                  <Label htmlFor="current_password">Current Password</Label>
                  <Input
                    id="current_password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("current_password")}
                    className={cn(
                      errors.current_password &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {errors.current_password && (
                    <p className="text-xs text-destructive">{errors.current_password.message}</p>
                  )}
                </div>

                {/* New password */}
                <div className="space-y-1.5">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register("new_password")}
                    className={cn(
                      errors.new_password && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {errors.new_password && (
                    <p className="text-xs text-destructive">{errors.new_password.message}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register("confirm_password")}
                    className={cn(
                      errors.confirm_password &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {errors.confirm_password && (
                    <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
                  )}
                </div>

                {/* Server error */}
                {pwServerError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{pwServerError}</span>
                  </div>
                )}

                {/* Success */}
                {pwSuccess && (
                  <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
                    <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>Your password has been updated successfully.</span>
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* ── Delete Account ── */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-red-700 dark:text-red-400">
                    Delete Account
                  </h3>
                  <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/70">
                    Permanently delete your account and all associated data. This action cannot be
                    undone.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={openDeleteDialog}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Account Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogClose}>
        <DialogContent className="sm:max-w-md">
          {deleteStep === "warning" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete your account?</DialogTitle>
                <DialogDescription className="pt-1">
                  This action <strong className="text-foreground">cannot be undone</strong>. All
                  your data including jobs, resumes, and cover letters will be permanently deleted.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteStep("confirm");
                    setDeleteInput("");
                    setDeleteError(null);
                  }}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Confirm deletion</DialogTitle>
                <DialogDescription className="pt-1">
                  To confirm, type{" "}
                  <strong className="font-mono text-foreground">DELETE</strong> in the field below.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5 py-2">
                <Label htmlFor="delete-confirm-input">Confirmation</Label>
                <Input
                  id="delete-confirm-input"
                  type="text"
                  placeholder="DELETE"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isDeleting}
                />

                {deleteError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteInput !== "DELETE" || isDeleting}
                  onClick={handleConfirmDelete}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete My Account"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
