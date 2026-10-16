import { officeHours, officeName } from "@/lib/config";
import { Dashboard } from "./dashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Dashboard timeZone={officeHours().timeZone} officeName={officeName()} />;
}
