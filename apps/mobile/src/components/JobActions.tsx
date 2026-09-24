import { useState } from "react";
import { Text, View } from "react-native";
import { canCancel, canOpenDispute, cancelHint, disputeBlockedReason, type Job, type Role } from "@heft/shared";
import { track } from "../lib/analytics";
import { Button, ErrorText, Field, Notice } from "./ui";
import { errorText, invoke } from "../lib/invoke";
import { supabase } from "../lib/supabase";
import { toast } from "../store/toast";

export function CancelBox({ job, role, onDone }: { job: Job; role: Exclude<Role, "admin">; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const hint = cancelHint(job.status, role);
  if (!canCancel(job.status, role) || !hint) return null;

  async function cancel() {
    if (reason.trim().length < 3) {
      setError("Add a short reason, at least a few words.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await invoke("update-job-status", { job_id: job.id, status: "cancelled", cancel_reason: reason.trim() });
      track({ name: "job_cancelled", role, from_status: job.status });
      toast("Job cancelled.", "ok");
      onDone();
    } catch (err) {
      const message = errorText(err);
      setError(message);
      toast(message);
    } finally {
      setPending(false);
    }
  }

  const beforeAccept = job.status === "draft" || job.status === "priced" || job.status === "open";
  const label = beforeAccept ? "Cancel before a driver accepts" : "Cancel this assignment";

  return (
    <View className="mt-6">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">Cancel</Text>
      <Notice>{hint}</Notice>
      <Field label="Cancel reason" value={reason} onChangeText={setReason} placeholder="Customer not ready" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Cancelling" : label} tone="ghost" disabled={pending} onPress={() => void cancel()} />
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
  const blocked = disputeBlockedReason(job.status, paidAt);
  const open = canOpenDispute(job.status, paidAt) && Boolean(job.driver_id);

  async function submit() {
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
      track({ name: "dispute_opened" });
      toast("Dispute opened. Dispatch will review it.", "ok");
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
      {blocked ? <Notice>{blocked}</Notice> : null}
      {open ? (
        <>
          <Field label="What happened" value={reason} onChangeText={setReason} multiline />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={pending ? "Opening" : "Open dispute"} tone="ghost" disabled={pending} onPress={() => void submit()} />
        </>
      ) : null}
    </View>
  );
}
