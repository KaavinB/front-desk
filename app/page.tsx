import { officeHours, officeName } from "@/lib/config";
import { VisitorLog } from "./visitor-log";
import { CameraStatusBadge } from "./camera-status";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main>
      <header>
        <div>
          <h1>{officeName()} · Front Desk</h1>
          <div className="sub">Your Ring doorbell is your receptionist.</div>
        </div>
        <CameraStatusBadge />
      </header>
      <VisitorLog timeZone={officeHours().timeZone} />
    </main>
  );
}
