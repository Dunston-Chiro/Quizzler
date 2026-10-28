import Link from "next/link";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

export default async function Navbar() {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // The Admin and Super-Admin areas have their own dedicated Socrative-style layout & header
  if (pathname.startsWith("/admin") || pathname.startsWith("/super-admin")) {
    return null;
  }

  const session = await getSession();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-[#FF5C00] text-white";
      case "ADMIN":
        return "bg-[#FF90E8] text-black";
      default:
        return "bg-[#00F0FF] text-black";
    }
  };

  const getDashboardLink = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "/super-admin/dashboard";
      case "ADMIN":
        return "/admin/dashboard";
      default:
        return "/participant/dashboard";
    }
  };

  return (
    <header className="border-b-4 border-black bg-[#FFE600] px-4 md:px-8 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-black text-[#FFE600] font-black text-lg flex items-center justify-center border-2 border-black group-hover:rotate-6 transition-transform">
            Q
          </div>
          <span className="font-black text-xl tracking-tight uppercase hidden sm:inline">
            Quizzler
          </span>
          <span className="font-black text-xl tracking-tight uppercase sm:hidden">
            Quizzler
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href={getDashboardLink(session.role)}
                className="font-mono text-xs sm:text-sm font-bold border-2 border-black bg-white px-2.5 py-1 shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Dashboard
              </Link>

              <span
                className={`font-mono text-xs font-black px-2 py-0.5 border-2 border-black uppercase ${getRoleBadge(
                  session.role
                )}`}
              >
                {session.role.replace("_", " ")}
              </span>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="font-mono text-xs sm:text-sm font-bold bg-black text-white px-3 py-1 border-2 border-black hover:bg-neutral-800 transition-colors shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                >
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="font-mono text-xs sm:text-sm font-bold bg-white text-black px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="font-mono text-xs sm:text-sm font-bold bg-black text-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
