import { supabase } from "./supabase";

type LogLevel = "error" | "warn" | "info";

export async function logEvent(level: LogLevel, message: string, context?: Record<string, any>) {
  try {
    await supabase.from("logs").insert({
      level,
      message,
      context: context ?? null,
    });
  } catch (e) {
    console.error("[logEvent] failed", e);
  }
}
