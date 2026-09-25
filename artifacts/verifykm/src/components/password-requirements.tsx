import { Check, X } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import {
  getPasswordChecks,
  getPasswordStrength,
  isPasswordStrongEnough,
  type PasswordRequirementId,
} from "@/lib/password-policy";

const REQUIREMENT_KEYS: Record<PasswordRequirementId, string> = {
  length: "pw_req_min_length",
  letter: "pw_req_letter",
  number: "pw_req_number",
};

type Props = {
  password: string;
  className?: string;
};

export function PasswordRequirements({ password, className }: Props) {
  const { t } = useTranslation();

  if (!password) return null;

  const checks = getPasswordChecks(password);
  const strength = getPasswordStrength(password);
  const allMet = isPasswordStrongEnough(password);
  const barColor = allMet ? "bg-[#00a5fd]" : strength <= 1 ? "bg-red-500" : "bg-yellow-500";

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all",
              i <= strength ? barColor : "bg-muted",
            )}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              check.met ? "text-[#0088d4] dark:text-[#00a5fd]" : "text-muted-foreground",
            )}
          >
            {check.met ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            )}
            <span>{t(REQUIREMENT_KEYS[check.id])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
