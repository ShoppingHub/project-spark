import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col max-w-[428px] mx-auto">
      <main className="flex-1 pb-14">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
