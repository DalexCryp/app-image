"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/(auth)/actions";

const INPUT =
  "mt-2 h-12 w-full border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-black disabled:opacity-60";
const LABEL = "block text-[12px] font-semibold uppercase tracking-[0.12em]";

export function AuthForm({ mode, initialError }: { mode: "login" | "signup"; initialError?: string }) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    isSignup ? signup : login,
    initialError ? { error: initialError } : undefined,
  );

  return (
    <>
      <h1 className="text-4xl font-medium tracking-tight">{isSignup ? "Create account" : "Log in"}</h1>

      <form action={formAction} className="mt-8 flex flex-col gap-5 border border-neutral-300 bg-card p-6">
        {isSignup && (
          <label className={LABEL}>
            Name
            <input name="name" type="text" autoComplete="name" required maxLength={100} disabled={pending} className={INPUT} />
          </label>
        )}
        <label className={LABEL}>
          Email
          <input name="email" type="email" autoComplete="email" required disabled={pending} className={INPUT} />
        </label>
        <label className={LABEL}>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            disabled={pending}
            className={INPUT}
          />
        </label>

        {state?.error && (
          <div role="alert" className="border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}
        {state?.message && (
          <div role="status" className="border border-neutral-400 bg-white px-4 py-3 text-sm">
            {state.message}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-[60px] w-full items-center justify-between bg-black px-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
          <span aria-hidden>→</span>
        </button>
      </form>

      <p className="mt-6 text-sm">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold underline underline-offset-4">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}
