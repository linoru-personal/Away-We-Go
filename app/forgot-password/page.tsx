import type { Metadata } from "next";
import { ForgotPasswordContent } from "./forgot-password-content";

export const metadata: Metadata = {
  title: "Reset your password — Away We Go",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordContent />;
}
