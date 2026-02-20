"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/app/lib/supabaseClient";
import type { Profile } from "@/app/lib/useProfile";

const INPUT_CLASS =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const LABEL_CLASS = "block text-xs font-medium uppercase tracking-wide text-[#6b6b6b]";

type Tab = "profile" | "password";

export interface AccountSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  profile: Profile | null;
  onProfileUpdated?: () => void;
  onLogout?: () => void;
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export default function AccountSettingsModal({
  open,
  onOpenChange,
  user,
  profile,
  onProfileUpdated,
  onLogout,
}: AccountSettingsModalProps) {
  const [tab, setTab] = useState<Tab>("profile");
  const [username, setUsername] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (profile) {
      setUsername(profile.username ?? "");
    } else if (user?.email) {
      setUsername(user.email.split("@")[0] ?? "");
    }
  }, [open, user?.email, profile?.username]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setProfileError(null);
    const un = username.trim();
    if (!un) {
      setProfileError("Username is required.");
      return;
    }
    setProfileSaving(true);
    if (profile) {
      const { error } = await supabase
        .from("profiles")
        .update({ username: un })
        .eq("id", user.id);
      setProfileSaving(false);
      if (error) {
        setProfileError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        username: un,
      });
      setProfileSaving(false);
      if (error) {
        setProfileError(error.message);
        return;
      }
    }
    onProfileUpdated?.();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Minimum 6 characters for new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    const email = user?.email;
    if (!email) {
      setPasswordError("Cannot change password: no email on account.");
      return;
    }
    setPasswordSaving(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      setPasswordSaving(false);
      setPasswordError("Current password is incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleLogout = () => {
    onOpenChange(false);
    onLogout?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            Account Settings
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex border-b border-[#e0d9d2]">
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === "profile"
                ? "border-[#d97b5e] text-[#d97b5e]"
                : "border-transparent text-[#6b6b6b] hover:text-[#1f1f1f]"
            }`}
          >
            <UserIcon />
            Profile
          </button>
          <button
            type="button"
            onClick={() => setTab("password")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === "password"
                ? "border-[#d97b5e] text-[#d97b5e]"
                : "border-transparent text-[#6b6b6b] hover:text-[#1f1f1f]"
            }`}
          >
            <LockIcon />
            Password
          </button>
        </div>

        {tab === "profile" && (
          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
            <div>
              <label htmlFor="account-username" className={LABEL_CLASS}>
                Username
              </label>
              <input
                id="account-username"
                type="text"
                className={`mt-1.5 ${INPUT_CLASS}`}
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {profileError && (
              <p className="text-sm text-red-600" role="alert">
                {profileError}
              </p>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="w-full rounded-full bg-[#d97b5e] py-3 text-sm font-medium text-white transition hover:bg-[#c46950] disabled:opacity-60"
            >
              {profileSaving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        )}

        {tab === "password" && (
          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <div>
              <label htmlFor="account-current-password" className={LABEL_CLASS}>
                Current password
              </label>
              <input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                className={`mt-1.5 ${INPUT_CLASS}`}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="account-new-password" className={LABEL_CLASS}>
                New password
              </label>
              <input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                className={`mt-1.5 ${INPUT_CLASS}`}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-[#8a8a8a]">Minimum 6 characters</p>
            </div>
            <div>
              <label htmlFor="account-confirm-password" className={LABEL_CLASS}>
                Confirm new password
              </label>
              <input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                className={`mt-1.5 ${INPUT_CLASS}`}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-600" role="alert">
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full rounded-full bg-[#d97b5e] py-3 text-sm font-medium text-white transition hover:bg-[#c46950] disabled:opacity-60"
            >
              {passwordSaving ? "Updating…" : "Change Password"}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-[#e0d9d2] pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#e0d9d2] bg-[#f6f2ed] py-3 text-sm font-medium text-[#d97b5e] transition hover:bg-[#ebe5df]"
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
