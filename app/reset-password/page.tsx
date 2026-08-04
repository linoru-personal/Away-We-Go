import type { Metadata } from "next";
import { ResetPasswordContent } from "./reset-password-content";

export const metadata: Metadata = {
  title: "Set a new password — Away We Go",
};

export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
