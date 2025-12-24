import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabaseClient";

// 단일 온보딩 요청 조회 (간단한 메타 정보)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!supabaseClient) throw new Error("Supabase 설정이 필요합니다.");
    const { id } = params;
    const { data, error } = await supabaseClient
      .from("onboarding_requests")
      .select("id, step_status, owner_name, region, address, updated_at")
      .eq("id", id)
      .single();
    if (error) throw error;
    return NextResponse.json({ onboarding: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "server_error" }, { status: 500 });
  }
}
