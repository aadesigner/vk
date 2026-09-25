import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSupportEmail } from "@/lib/support-email";

type Props = {
  className?: string;
  /** Plain text only — no mailto / click handler (still obfuscated until mount). */
  asText?: boolean;
};

/** Renders support email only after mount; mailto opens on click unless `asText`. */
export function ObfuscatedEmailLink({ className, asText = false }: Props) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(getSupportEmail());
  }, []);

  if (!email) {
    return <span className={cn("inline-block min-w-[8ch]", className)} aria-hidden />;
  }

  if (asText) {
    return <span className={className}>{email}</span>;
  }

  return (
    <a
      href="#"
      className={cn("text-primary hover:underline", className)}
      rel="nofollow noopener"
      onClick={(e) => {
        e.preventDefault();
        window.location.href = `mailto:${getSupportEmail()}`;
      }}
    >
      {email}
    </a>
  );
}

const EMAIL_PLACEHOLDER = "{{email}}";

/** Splits translated copy on `{{email}}` and inserts an obfuscated mail link. */
export function TextWithObfuscatedEmail({
  text,
  linkClassName,
}: {
  text: string;
  linkClassName?: string;
}) {
  if (!text.includes(EMAIL_PLACEHOLDER)) {
    return <>{text}</>;
  }

  const parts = text.split(EMAIL_PLACEHOLDER);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <ObfuscatedEmailLink className={linkClassName} /> : null}
        </Fragment>
      ))}
    </>
  );
}
