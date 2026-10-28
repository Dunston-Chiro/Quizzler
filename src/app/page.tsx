import Link from "next/link";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  const getDashboardHref = () => {
    if (!session) return "/login";
    switch (session.role) {
      case "SUPER_ADMIN":
        return "/super-admin/dashboard";
      case "ADMIN":
        return "/admin/dashboard";
      default:
        return "/participant/dashboard";
    }
  };

  return (
    <main className="min-h-screen bg-[#FFFDF8] text-black p-6 md:p-12 flex flex-col justify-between">
      {/* Top Banner / Tetris-inspired accent */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-4 border-black pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#FFE600] border-4 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center font-black text-2xl">
            Q
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Quizzler
            </h1>
            <p className="font-mono text-xs font-bold text-neutral-600">
              Neobrutalist Live Competition Engine
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00F0FF] border-3 border-black font-mono font-bold text-xs uppercase shadow-[3px_3px_0px_#000]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-black" />
          Milestone 1 Active: Auth &amp; RBAC
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl w-full mx-auto my-10">
        <div className="bg-[#FFE600] border-4 border-black p-8 md:p-12 shadow-[8px_8px_0px_#000] mb-12">
          <div className="inline-block bg-black text-white px-3 py-1 font-mono text-xs uppercase font-bold mb-4 tracking-wider">
            High-Stakes Live Competition Engine
          </div>
          <h2 className="text-4xl md:text-6xl font-black uppercase leading-tight tracking-tight mb-4">
            Fast, Linear &amp; Tamper-Resistant
          </h2>
          <p className="text-base md:text-xl font-medium max-w-2xl border-l-4 border-black pl-4 my-4">
            Engineered for college competitions with 30-second server-enforced timers, one-way question progression, and real-time tab proctoring.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {session ? (
              <Link
                href={getDashboardHref()}
                className="bg-black text-white font-mono font-black text-sm uppercase px-6 py-3 border-3 border-black shadow-[4px_4px_0px_#000] hover:bg-neutral-800 hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Enter {session.role.replace("_", " ")} Portal →
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="bg-[#00F0FF] text-black font-mono font-black text-sm uppercase px-6 py-3 border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5"
                >
                  Register as Participant →
                </Link>
                <Link
                  href="/login"
                  className="bg-white text-black font-mono font-black text-sm uppercase px-6 py-3 border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5"
                >
                  Portal Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Roles Breakdown */}
        <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
          <span className="w-4 h-4 bg-black inline-block" />
          Three-Tier Role Architecture
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Participant Card */}
          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between">
            <div>
              <div className="inline-block bg-[#00F0FF] border-2 border-black px-2 py-0.5 font-mono text-xs font-bold uppercase mb-3">
                Role 01
              </div>
              <h4 className="text-2xl font-black uppercase mb-2">Participant</h4>
              <p className="text-sm font-medium text-neutral-800 leading-relaxed">
                Join live competitions, answer strictly timed questions one-by-one without backtracking, and receive proctoring telemetry logs.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-black font-mono text-xs text-neutral-600">
              ✓ Open registration<br />
              ✓ 30s question countdown<br />
              ✓ Automatic score computation
            </div>
          </div>

          {/* Admin Card */}
          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between">
            <div>
              <div className="inline-block bg-[#FF90E8] border-2 border-black px-2 py-0.5 font-mono text-xs font-bold uppercase mb-3">
                Role 02
              </div>
              <h4 className="text-2xl font-black uppercase mb-2">Admin</h4>
              <p className="text-sm font-medium text-neutral-800 leading-relaxed">
                Author quizzes, launch and terminate sessions, monitor participants in real time, control result publication, and qualify round winners.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-black font-mono text-xs text-neutral-600">
              ✓ Live participant telemetry<br />
              ✓ Result release toggle<br />
              ✓ Next-round candidate selector
            </div>
          </div>

          {/* Super-Admin Card */}
          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between">
            <div>
              <div className="inline-block bg-[#FF5C00] text-white border-2 border-black px-2 py-0.5 font-mono text-xs font-bold uppercase mb-3">
                Role 03
              </div>
              <h4 className="text-2xl font-black uppercase mb-2">Super-Admin</h4>
              <p className="text-sm font-medium text-neutral-800 leading-relaxed">
                Comprehensive governance across the platform, global access to all quiz pools and master answer keys, user role management, and audit trails.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-black font-mono text-xs text-neutral-600">
              ✓ Initialized via seed script<br />
              ✓ Master answer keys access<br />
              ✓ Immutable audit logs
            </div>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <footer className="max-w-6xl w-full mx-auto border-t-4 border-black pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div>
          Next.js 16 (Turbopack) &bull; TypeScript &bull; Tailwind CSS v4 &bull; Neon PostgreSQL / Drizzle ORM
        </div>
        <div className="bg-black text-white px-3 py-1 font-bold">
          Documentation: docs/PRD.md &bull; docs/ARCHITECTURE.md &bull; docs/IMPLEMENTATION_PLAN.md
        </div>
      </footer>
    </main>
  );
}
