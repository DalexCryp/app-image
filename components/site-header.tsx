import { logout } from "@/app/(auth)/actions";

export function SiteHeader({ userName }: { userName?: string | null }) {
  const signedIn = userName !== undefined;

  return (
    <>
      {/* Announcement bar */}
      <div className="bg-navy px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
        AI virtual try-on · upload two photos to get started
      </div>

      {/* Header */}
      <header className="border-b border-neutral-200">
        <div className="relative flex items-center justify-center px-4 py-5">
          <span className="text-3xl font-medium uppercase tracking-[0.25em] sm:text-4xl">Fitting Room</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-neutral-100 px-4 py-3 text-[12px] font-medium uppercase tracking-[0.12em]">
          <span>Try-On</span>
          <span>How it works</span>
          <span className="text-red-500">New</span>
          <span>Tips</span>
          {signedIn && (
            <>
              {userName && <span className="normal-case tracking-normal text-neutral-500">Hi, {userName}</span>}
              <form action={logout}>
                <button type="submit" className="uppercase tracking-[0.12em] underline-offset-4 hover:underline">
                  Log out
                </button>
              </form>
            </>
          )}
        </nav>
      </header>
    </>
  );
}
