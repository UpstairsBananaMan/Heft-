import { supabase } from "./supabase";

export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = error.message;
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.json();
        if (parsed?.error) detail = parsed.error;
      } catch {
        // Keep the client message when the body is not JSON.
      }
    }
    throw new Error(detail);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}
