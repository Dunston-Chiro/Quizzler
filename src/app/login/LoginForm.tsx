"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, AuthActionState } from "@/app/actions/auth";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "";

  const [state, formAction, isPending] = useActionState(
    async (prevState: AuthActionState | undefined, formData: FormData) => {
      const result = await loginAction(prevState, formData);
      if (result.success && result.redirectTo) {
        window.location.href = result.redirectTo;
      }
      return result;
    },
    undefined
  );

  return (
    <div className="w-full max-w-md mx-auto my-auto p-4">
      <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_#000]">
        {/* Header Badge */}
        <div className="inline-block bg-[#00F0FF] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase mb-4 shadow-[2px_2px_0px_#000]">
          Quizzler &bull; Portal Access
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
          Sign In
        </h1>
        <p className="text-sm font-medium text-neutral-700 mb-6">
          Enter your credentials to access quizzes, proctoring dashboards, or administration.
        </p>

        {state?.error && (
          <div className="mb-6 p-3 bg-[#FF5C5C] border-3 border-black text-black font-mono text-xs font-bold shadow-[3px_3px_0px_#000]">
            ⚠️ {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectUrl" value={redirectUrl} />

          <div>
            <label
              htmlFor="email"
              className="block font-mono text-xs font-black uppercase mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="e.g. participant@college.edu"
              className="w-full bg-[#FFFDF8] border-3 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:bg-[#FFE600]/20 shadow-[3px_3px_0px_#000]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs font-black uppercase mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full bg-[#FFFDF8] border-3 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:bg-[#FFE600]/20 shadow-[3px_3px_0px_#000]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 bg-[#FFE600] text-black font-black uppercase tracking-wide py-3 border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Authenticating..." : "Enter Portal →"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t-2 border-black text-center">
          <p className="text-xs font-medium text-neutral-600">
            Don&apos;t have an account yet?{" "}
            <Link
              href="/register"
              className="font-bold text-black underline underline-offset-2 hover:bg-[#FFE600]"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>

      {/* Role Tip Card */}
      <div className="mt-6 bg-[#FFE600] border-3 border-black p-4 shadow-[4px_4px_0px_#000] font-mono text-xs">
        <div className="font-bold uppercase tracking-wider mb-1">
          💡 Role Routing Information
        </div>
        <p className="text-neutral-800">
          The system automatically routes you to your authorized portal: Participant, Admin, or Super-Admin.
        </p>
      </div>
    </div>
  );
}
