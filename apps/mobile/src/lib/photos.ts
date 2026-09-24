import { supabase } from "./supabase";

function fileId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function uploadJobImage(bucket: "job-photos" | "pod", jobId: string, uri: string): Promise<void> {
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  const path = `${jobId}/${fileId()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { error: insertError } = await supabase.from("job_photos").insert({
    job_id: jobId,
    storage_path: path,
    kind: bucket === "pod" ? "pod" : "item",
  });
  if (insertError) throw insertError;
}
