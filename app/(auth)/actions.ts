"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const MIN_PASSWORD = 8;
const MAX_NAME = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = field(formData, "name").trim();
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");

  if (!name || name.length > MAX_NAME) return { error: `Please enter your name (up to ${MAX_NAME} characters).` };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      ...(origin ? { emailRedirectTo: `${origin}/auth/confirm` } : {}),
    },
  });

  if (error) {
    console.error("Supabase signUp failed", error.code, error.message);
    if (error.code === "weak_password") return { error: "That password is too weak. Please choose a stronger one." };
    return { error: "Could not create account. Please try again." };
  }

  // Supabase answers the same way for an email that is already registered, so this doesn't reveal accounts.
  return { message: "Check your email to confirm your account, then log in." };
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  if (!email || !password) return { error: "Please enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Please confirm your email first." };
    if (error.code !== "invalid_credentials") console.error("Supabase signIn failed", error.code, error.message);
    return { error: "Invalid email or password." };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
