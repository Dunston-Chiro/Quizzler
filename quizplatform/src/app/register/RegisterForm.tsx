"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, AuthActionState } from "@/app/actions/auth";

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: AuthActionState | undefined, formData: FormData) => {
      const result = await registerAction(prevState, formData);
      if (result.success && result.redirectTo) {
        window.location.href = result.redirectTo;
      }
      return result;
    },
    undefined
  );

  return (
    <div className="w-full max-w-lg mx-auto my-auto p-4">
      <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_#000]">
        {/* Header Badge */}
        <div className="inline-block bg-[#00F0FF] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase mb-4 shadow-[2px_2px_0px_#000]">
          Quizzler &bull; Team Registration
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
          Register Team
        </h1>
        <p className="text-sm font-medium text-neutral-700 mb-6">
          Register your campus team to join live quiz stages and timed qualifiers.
        </p>

        {state?.error && (
          <div className="mb-6 p-3 bg-[#FF5C5C] border-3 border-black text-black font-mono text-xs font-bold shadow-[3px_3px_0px_#000]">
            ⚠️ {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="teamName"
              className="block font-mono text-xs font-black uppercase mb-1"
            >
              Team Name *
            </label>
            <input
              id="teamName"
              name="teamName"
              type="text"
              required
              placeholder="e.g. Code Wizards"
              className="w-full bg-[#FFFDF8] border-3 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:bg-[#00F0FF]/20 shadow-[3px_3px_0px_#000]"
            />
            {state?.fieldErrors?.teamName && (
              <p className="mt-1 font-mono text-xs text-red-600 font-bold">
                {state.fieldErrors.teamName}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="email"
                className="block font-mono text-xs font-black uppercase"
              >
                Team Leader Email *
              </label>
              <span className="font-mono text-[10px] text-neutral-500 font-semibold">
                Username derived from prefix
              </span>
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="e.g. rahul.sharma@example.com"
              className="w-full bg-[#FFFDF8] border-3 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:bg-[#00F0FF]/20 shadow-[3px_3px_0px_#000]"
            />
            {state?.fieldErrors?.email && (
              <p className="mt-1 font-mono text-xs text-red-600 font-bold">
                {state.fieldErrors.email}
              </p>
            )}
            <p className="mt-1 font-mono text-[11px] text-neutral-500">
              Display name will automatically be set as your email prefix (e.g. <span className="font-bold text-black">rahul.sharma</span>).
            </p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs font-black uppercase mb-1"
            >
              Password * (min. 6 characters)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full bg-[#FFFDF8] border-3 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:bg-[#00F0FF]/20 shadow-[3px_3px_0px_#000]"
            />
            {state?.fieldErrors?.password && (
              <p className="mt-1 font-mono text-xs text-red-600 font-bold">
                {state.fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="institution"
                className="block font-mono text-xs font-black uppercase"
              >
                Institution Name
              </label>
              <span className="font-mono text-[10px] bg-black text-white px-1.5 py-0.2 rounded font-bold uppercase">
                Default &bull; Read-Only
              </span>
            </div>
            <input
              id="institution"
              type="text"
              value="BIMTECH"
              readOnly
              disabled
              className="w-full bg-neutral-200 border-3 border-black px-3 py-2 text-sm font-black font-mono text-neutral-800 shadow-[3px_3px_0px_#000] cursor-not-allowed select-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 bg-[#00F0FF] text-black font-black uppercase tracking-wide py-3 border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? "Registering Team..." : "Register Team →"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t-2 border-black text-center">
          <p className="text-xs font-medium text-neutral-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-black underline underline-offset-2 hover:bg-[#FFE600]"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6 bg-[#FF90E8] border-3 border-black p-4 shadow-[4px_4px_0px_#000] font-mono text-xs">
        <div className="font-bold uppercase tracking-wider mb-1">
          🔒 Participant Role Policy
        </div>
        <p className="text-neutral-900">
          Public team signups automatically receive Participant permissions with BIMTECH institution clearance. Admin and Super-Admin roles are assigned by Super-Administrators.
        </p>
      </div>
    </div>
  );
}
