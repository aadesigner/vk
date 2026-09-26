import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type UnlockStatus = {
  pinRequired: boolean;
  unlocked: boolean;
  lockedOut: boolean;
  unlockDays: number;
};

async function fetchUnlockStatus(): Promise<UnlockStatus> {
  const res = await fetch(`${basePath}/api/admin/unlock/status`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to check admin unlock status");
  return res.json() as Promise<UnlockStatus>;
}

async function submitAdminPin(pin: string): Promise<{ ok: boolean; error?: string; lockedOut?: boolean }> {
  const res = await fetch(`${basePath}/api/admin/unlock`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json().catch(() => ({})) as {
    error?: string;
    code?: string;
    attemptsRemaining?: number;
  };
  if (res.ok) return { ok: true };
  if (res.status === 429 || data.code === "locked_out") {
    return { ok: false, error: data.error ?? "Too many failed attempts.", lockedOut: true };
  }
  const attempts =
    typeof data.attemptsRemaining === "number"
      ? ` (${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? "" : "s"} left)`
      : "";
  return { ok: false, error: (data.error ?? "Incorrect PIN.") + attempts };
}

export function AdminPinGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UnlockStatus | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshStatus = useCallback(async () => {
    const next = await fetchUnlockStatus();
    setStatus(next);
    if (next.lockedOut) {
      setError("Too many failed PIN attempts. This IP is locked for 30 minutes.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus().catch(() => {
      setError("Could not verify admin access.");
    });
  }, [refreshStatus]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitAdminPin(pin.trim());
      if (result.ok) {
        setPin("");
        await refreshStatus();
        return;
      }
      setError(result.error ?? "Incorrect PIN.");
      if (result.lockedOut) await refreshStatus();
    } finally {
      setSubmitting(false);
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status.pinRequired || status.unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin area PIN</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your admin PIN once. This browser stays unlocked for {status.unlockDays} days.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-pin">Admin PIN</Label>
            <Input
              id="admin-pin"
              type="password"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={submitting || status.lockedOut}
              placeholder="Enter admin PIN"
              className="h-11"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-11" disabled={submitting || status.lockedOut || !pin.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock admin"}
          </Button>
        </form>

        <p className="text-[11px] text-center text-muted-foreground">
          3 wrong tries lock this IP for 30 minutes and block public site access for 24 hours.
        </p>
      </div>
    </div>
  );
}
