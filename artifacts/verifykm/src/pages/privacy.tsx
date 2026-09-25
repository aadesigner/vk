import { Link } from "wouter";
import { pathFor } from "@/lib/localized-routes";
import { useTranslation } from "@/i18n/context";
import { useLegalTranslation } from "@/i18n/useLegalTranslation";
import { SEOHead, usePageSeo } from "@/components/seo";
import { Skeleton } from "@/components/ui/skeleton";
import { TextWithObfuscatedEmail } from "@/components/obfuscated-email-link";
import {
  legalBodyClass,
  legalCookieCardDescClass,
  legalCookieCardTitleClass,
  legalFooterLinkClass,
  legalH1Class,
  legalH2Class,
  legalH3Class,
  legalIntroClass,
  legalPageRootClass,
  legalProseClass,
  legalUpdatedClass,
} from "@/components/legal-page-styles";

const COOKIE_TYPES = [
  { typeKey: "legal_cookie_essential_type", descKey: "legal_cookie_essential_desc", badge: "required" as const },
  { typeKey: "legal_cookie_storage_type", descKey: "legal_cookie_storage_desc", badge: "required" as const },
  { typeKey: "legal_cookie_analytics_type", descKey: "legal_cookie_analytics_desc", badge: "when_enabled" as const },
] as const;

const SHARE_KEYS = [
  "legal_privacy_s3_auth",
  "legal_privacy_s3_oauth",
  "legal_privacy_s3_recaptcha",
  "legal_privacy_s3_paypal",
  "legal_privacy_s3_pok",
  "legal_privacy_s3_providers",
  "legal_privacy_s3_email",
  "legal_privacy_s3_analytics",
] as const;

export default function Privacy() {
  const { language, dir } = useTranslation();
  const { t, ready } = useLegalTranslation();
  const seo = usePageSeo("privacy");

  if (!ready) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const useItems = [
    t("legal_privacy_s2_li1"),
    t("legal_privacy_s2_li2"),
    t("legal_privacy_s2_li3"),
    t("legal_privacy_s2_li4"),
    t("legal_privacy_s2_li5"),
    t("legal_privacy_s2_li6"),
    t("legal_privacy_s2_li7"),
  ];

  const rightsItems = [
    t("legal_privacy_s7_access"),
    t("legal_privacy_s7_rectification"),
    t("legal_privacy_s7_erasure"),
    t("legal_privacy_s7_portability"),
    t("legal_privacy_s7_objection"),
  ];

  return (
    <div className={legalPageRootClass} dir={dir}>
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        canonicalPath={seo.canonicalPath}
        noIndex={seo.noIndex}
      />
      <div className="mb-8 md:mb-10">
        <p className={legalUpdatedClass}>{t("legal_updated")}</p>
        <h1 className={legalH1Class}>{t("legal_privacy_title")}</h1>
        <p className={`${legalIntroClass} mb-3`}>{t("legal_operator_notice")}</p>
        <p className={legalIntroClass}>{t("legal_privacy_intro")}</p>
      </div>

      <div className={legalProseClass}>
        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s1_title")}</h2>
          <div className="space-y-4">
            <div>
              <h3 className={legalH3Class}>{t("legal_privacy_s1_account_title")}</h3>
              <p className={legalBodyClass}>{t("legal_privacy_s1_account_body")}</p>
            </div>
            <div>
              <h3 className={legalH3Class}>{t("legal_privacy_s1_usage_title")}</h3>
              <p className={legalBodyClass}>{t("legal_privacy_s1_usage_body")}</p>
            </div>
            <div>
              <h3 className={legalH3Class}>{t("legal_privacy_s1_technical_title")}</h3>
              <p className={legalBodyClass}>{t("legal_privacy_s1_technical_body")}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s2_title")}</h2>
          <ul className={`list-disc list-inside space-y-2 ${legalBodyClass}`}>
            {useItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className={`${legalBodyClass} mt-3`}>{t("legal_privacy_s2_footer")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s3_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_privacy_s3_intro")}</p>
          <ul className={`list-disc list-inside space-y-2 ${legalBodyClass}`}>
            {SHARE_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <p className={`${legalBodyClass} mt-3`}>{t("legal_privacy_s3_footer")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s4_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_privacy_s4_body1")}</p>
          <p className={legalBodyClass}>{t("legal_privacy_s4_body2")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s5_title")}</h2>
          <p className={legalBodyClass}>
            <TextWithObfuscatedEmail text={t("legal_privacy_s5_body")} />
          </p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s6_title")}</h2>
          <div id="cookies" className="space-y-3">
            <p className={legalBodyClass}>
              {t("legal_privacy_cookies_intro_before")}{" "}
              <Link href={pathFor(language, "terms")} className="text-primary hover:underline">
                {t("legal_link_terms")}
              </Link>
              {t("legal_privacy_cookies_intro_after")}
            </p>
            <p className={legalBodyClass}>{t("legal_privacy_cookies_types")}</p>
            <div className="space-y-3">
              {COOKIE_TYPES.map(({ typeKey, descKey, badge }) => (
                <div key={typeKey} className="flex items-start gap-3 p-4 rounded-xl border bg-muted/30">
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 mt-0.5 ${
                      badge === "required"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {badge === "required" ? t("legal_cookie_required") : t("legal_cookie_when_enabled")}
                  </div>
                  <div>
                    <p className={legalCookieCardTitleClass}>{t(typeKey)}</p>
                    <p className={legalCookieCardDescClass}>{t(descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s7_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_privacy_s7_intro")}</p>
          <ul className={`list-disc list-inside space-y-2 ${legalBodyClass}`}>
            {rightsItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className={`${legalBodyClass} mt-3`}>
            <TextWithObfuscatedEmail text={t("legal_privacy_s7_footer_before")} />{" "}
            <Link href={pathFor(language, "terms")} className="text-primary hover:underline">
              {t("legal_link_terms")}
            </Link>
            {t("legal_privacy_s7_footer_after")}
          </p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s8_title")}</h2>
          <p className={legalBodyClass}>{t("legal_privacy_s8_body")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s9_title")}</h2>
          <p className={legalBodyClass}>
            <TextWithObfuscatedEmail text={t("legal_privacy_s9_body")} />
          </p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s10_title")}</h2>
          <p className={legalBodyClass}>{t("legal_privacy_s10_body")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_privacy_s11_title")}</h2>
          <p className={legalBodyClass}>
            <TextWithObfuscatedEmail text={t("legal_privacy_s11_body")} />
          </p>
        </section>
      </div>

      <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t flex gap-4 flex-wrap">
        <Link href={pathFor(language, "terms")} className={`${legalFooterLinkClass} text-primary hover:underline`}>
          {t("legal_link_terms")} →
        </Link>
        <Link href={`/${language}`} className={`${legalFooterLinkClass} text-muted-foreground hover:text-foreground`}>
          ← {t("legal_link_home")}
        </Link>
      </div>
    </div>
  );
}
