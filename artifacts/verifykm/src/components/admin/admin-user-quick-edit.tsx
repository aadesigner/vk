import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AdminUser, AdminUserPage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function patchUserInListCaches(
  queryClient: QueryClient,
  userId: string,
  patch: { name: string | null; email: string },
) {
  queryClient.setQueriesData<AdminUserPage>(
    { queryKey: ["/api/admin/users"] },
    (prev) => {
      if (!prev?.items) return prev;
      let changed = false;
      const items = prev.items.map((u) => {
        if (u.id !== userId) return u;
        changed = true;
        return { ...u, name: patch.name, email: patch.email };
      });
      return changed ? { ...prev, items } : prev;
    },
  );
  queryClient.setQueryData<AdminUser>([`/api/admin/users/${userId}`], (prev) =>
    prev ? { ...prev, name: patch.name, email: patch.email } : prev,
  );
}

type Props = {
  user: Pick<AdminUser, "id" | "name" | "email">;
};

export function AdminUserQuickEdit({ user }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const saveLock = useRef(false);

  useEffect(() => {
    if (editing) return;
    setName(user.name ?? "");
    setEmail(user.email);
  }, [user.id, user.name, user.email, editing]);

  useEffect(() => {
    if (!editing) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [editing]);

  const cancel = useCallback(() => {
    setEditing(false);
    setError(null);
    setName(user.name ?? "");
    setEmail(user.email);
  }, [user.name, user.email]);

  const save = useCallback(async () => {
    if (saveLock.current || saving) return;

    const nextName = name.trim() || null;
    const nextEmail = email.trim().toLowerCase();
    const prevName = user.name?.trim() || null;
    const prevEmail = user.email.trim().toLowerCase();

    if (!nextEmail || !nextEmail.includes("@")) {
      setError("Enter a valid email");
      return;
    }

    if (nextName === prevName && nextEmail === prevEmail) {
      setEditing(false);
      setError(null);
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setError(null);

    const body: { name?: string | null; email?: string } = {};
    if (nextName !== prevName) body.name = nextName;
    if (nextEmail !== prevEmail) body.email = nextEmail;

    // Optimistic list/detail update — roll back on failure.
    patchUserInListCaches(queryClient, user.id, { name: nextName, email: nextEmail });

    try {
      const resp = await fetch(`${basePath}/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await resp.json()) as { error?: string; name?: string | null; email?: string };
      if (!resp.ok || data.error) {
        patchUserInListCaches(queryClient, user.id, { name: prevName, email: user.email });
        setError(data.error ?? `Save failed (${resp.status})`);
        return;
      }
      patchUserInListCaches(queryClient, user.id, {
        name: data.name ?? nextName,
        email: data.email ?? nextEmail,
      });
      setEditing(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    } catch {
      patchUserInListCaches(queryClient, user.id, { name: prevName, email: user.email });
      setError("Network error");
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }, [name, email, user.id, user.name, user.email, queryClient, saving]);

  if (!editing) {
    return (
      <div className="group flex items-start gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{user.email}</p>
          {user.name ? (
            <p className="text-xs text-muted-foreground truncate">{user.name}</p>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">No name</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
          {savedFlash ? (
            <span className="inline-flex h-7 w-7 items-center justify-center text-[#0088d4]" title="Saved">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground opacity-70 group-hover:opacity-100 hover:text-foreground"
              title="Quick edit name & email"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[14rem] max-w-sm">
      <Input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name"
        disabled={saving}
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        disabled={saving}
        className="h-8 text-sm font-medium"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          <span className="ml-1">Save</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={saving}
          onClick={cancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        {error ? (
          <span className={cn("text-[11px] text-destructive truncate flex-1")}>{error}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Enter to save</span>
        )}
      </div>
    </div>
  );
}
