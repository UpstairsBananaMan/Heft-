import { useState } from "react";
import { Text, View } from "react-native";
import { canCancel, canOpenDispute, type Job, type Role } from "@heft/shared";
import { Button, ErrorText, Field } from "./ui";
import { errorText, invoke } from "../lib/invoke";
import { supabase } from "../lib/supabase";
import { toast } from "../store/toast";

export function CancelBox({ job, role, onDone }: { job: Job; role: Role; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!canCancel(job.status, role)) return null;

  async function cancel() {
    setPending(true);
    setError("");
    try {
      await invoke("update-job-status", { job_id: job.id, status: "cancelled", cancel_reason: reason });
      onDone();
    } catch (err) {
      const message = errorText(err);
      setError(message);
      toast(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="mt-6">
      <Field label="Cancel reason" value={reason} onChangeText={setReason} placeholder="Customer not ready" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Cancelling" : "Cancel job"} tone="ghost" disabled={pending} onPress={cancel} />
    </View>
  );
}

export function DisputeBox({
  job,
  userId,
  paidAt,
  onDone,
}: {
  job: Job;
  userId: string;
  paidAt: string | null;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!canOpenDispute(job.status, paidAt) || !job.driver_id) return null;

  async function open() {
    if (reason.trim().length < 8) {
      setError("Describe the dispute in a sentence.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("disputes").insert({
        job_id: job.id,
        opened_by: userId,
        reason: reason.trim(),
      });
      if (insertError) throw insertError;
      await invoke("notify", { job_id: job.id, event: "disputed" }).catch(() => undefined);
      onDone();
    } catch (err) {
      const message = errorText(err);
      setError(message);
      toast(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="mt-6">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">Dispute</Text>
      <Field label="What happened" value={reason} onChangeText={setReason} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Opening" : "Open dispute"} tone="ghost" disabled={pending} onPress={open} />
    </View>
  );
}
