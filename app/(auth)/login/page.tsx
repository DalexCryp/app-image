import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in · Fitting Room" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      initialError={error === "confirm" ? "That confirmation link is invalid or has expired." : undefined}
    />
  );
}
