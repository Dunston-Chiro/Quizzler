import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

export default async function UnauthorizedPage() {
  const session = await getSession();

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-[#FF5C5C] border-4 border-black p-8 shadow-[8px_8px_0px_#000] text-black">
        <div className="inline-block bg-black text-white px-3 py-1 font-mono text-xs font-black uppercase mb-4">
          Error 403 &bull; Access Denied
        </div>

        <h1 className="text-4xl font-black uppercase tracking-tight mb-4">
          Restricted Zone
        </h1>

        <p className="font-medium text-lg leading-relaxed mb-6 border-l-4 border-black pl-4 bg-white/40 py-2">
          Your account does not hold the necessary security clearance to view this route.
        </p>

        {session && (
          <div className="bg-white border-3 border-black p-4 mb-6 font-mono text-xs space-y-1">
            <div>
              <span className="font-bold">Active User:</span> {session.name} ({session.email})
            </div>
            <div>
              <span className="font-bold">Assigned Role:</span>{" "}
              <span className="px-2 py-0.5 bg-[#FFE600] border border-black font-black">
                {session.role}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {session ? (
            <>
              <Link
                href={
                  session.role === "SUPER_ADMIN"
                    ? "/super-admin/dashboard"
                    : session.role === "ADMIN"
                    ? "/admin/dashboard"
                    : "/participant/dashboard"
                }
                className="flex-1 bg-white text-black font-black uppercase text-center py-3 border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Go to My Dashboard
              </Link>
              <form action={logoutAction} className="sm:w-auto">
                <button
                  type="submit"
                  className="w-full bg-black text-white font-black uppercase px-6 py-3 border-3 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800 hover:translate-x-0.5 hover:translate-y-0.5"
                >
                  Switch Account
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="w-full bg-black text-white font-black uppercase text-center py-3 border-3 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800"
            >
              Sign In with Authorized Account
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
