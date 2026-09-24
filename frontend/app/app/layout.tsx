import { CmdPalette } from "@/components/cmd-palette";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <CmdPalette />
    </div>
  );
}
