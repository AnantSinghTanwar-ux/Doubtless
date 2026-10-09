import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, isAdminEmail, requireUser } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ isAdmin: isAdminEmail(user.email) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ isAdmin: false });
  }
}
