import { NextResponse } from "next/server";
import { listHardwareProfiles } from "@/lib/hardware/profiles";

/** Public catalog of hardware profiles (extension points for new compute kinds). */
export async function GET() {
  return NextResponse.json({
    profiles: listHardwareProfiles(),
    note: "扩展：在 src/lib/hardware/profiles.ts 增加条目，再注册 Device 绑定 Backend。",
  });
}
