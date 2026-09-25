import { Link } from "wouter";
import { pathFor } from "@/lib/localized-routes";
import { useTranslation } from "@/i18n/context";
import { useLegalTranslation } from "@/i18n/useLegalTranslation";
import { SEOHead, usePageSeo } from "@/components/seo";
import { Skeleton } from "@/components/ui/skeleton";
import { TextWithObfuscatedEmail } from "@/components/obfuscated-email-link";
import {
  legalBodyClass,
  legalFooterLinkClass,
  legalH1Class,
  legalH2Class,
  legalIntroClass,
  legalPageRootClass,
  legalProseClass,
  legalUpdatedClass,
} from "@/components/legal-page-styles";

export default function Terms() {
  const { language, dir } = useTranslation();
  const { t, ready } = useLegalTranslation();
  const seo = usePageSeo("terms");

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

  const s5Items = [
    t("legal_terms_s5_li1"),
    t("legal_terms_s5_li2"),
    t("legal_terms_s5_li3"),
    t("legal_terms_s5_li4"),
    t("legal_terms_s5_li5"),
    t("legal_terms_s5_li6"),
  ];

  const s6Items = [
    t("legal_terms_s6_li1"),
    t("legal_terms_s6_li2"),
    t("legal_terms_s6_li3"),
    t("legal_terms_s6_li4"),
    t("legal_terms_s6_li5"),
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
        <h1 className={legalH1Class}>{t("legal_terms_title")}</h1>
        <p className={`${legalIntroClass} mb-3`}>{t("legal_operator_notice")}</p>
        <p className={legalIntroClass}>{t("legal_terms_intro")}</p>
      </div>

      <div className={legalProseClass}>
        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s1_title")}</h2>
          <p className={legalBodyClass}>{t("legal_terms_s1_body")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s2_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s2_body1")}</p>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s2_body2")}</p>
          <p className={legalBodyClass}>{t("legal_terms_s2_body3")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s3_title")}</h2>
          <p className={legalBodyClass}>
            <TextWithObfuscatedEmail text={t("legal_terms_s3_body")} />
          </p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s4_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s4_body1")}</p>
          <p className={legalBodyClass}>
            <strong className="font-semibold text-foreground">{t("legal_terms_s4_refund_label")}</strong>{" "}
            <TextWithObfuscatedEmail text={t("legal_terms_s4_refund_body")} />
          </p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s5_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s5_body0")}</p>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s5_body1")}</p>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s5_body2")}</p>
          <ul className={`list-disc list-inside space-y-2 ${legalBodyClass} mb-3`}>
            {s5Items.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s5_body3")}</p>
          <p className={legalBodyClass}>{t("legal_terms_s5_body4")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s6_title")}</h2>
          <p className={`${legalBodyClass} mb-3`}>{t("legal_terms_s6_intro")}</p>
          <ul className={`list-disc list-inside space-y-2 ${legalBodyClass}`}>
            {s6Items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s7_title")}</h2>
          <p className={legalBodyClass}>{t("legal_terms_s7_body")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s8_title")}</h2>
          <p className={legalBodyClass}>{t("legal_terms_s8_body")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s9_title")}</h2>
          <p className={legalBodyClass}>{t("legal_terms_s9_body")}</p>
        </section>

        <section>
          <h2 className={legalH2Class}>{t("legal_terms_s10_title")}</h2>
          <p className={legalBodyClass}>
            <TextWithObfuscatedEmail text={t("legal_terms_s10_body")} />
          </p>
        </section>
      </div>

      <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t flex gap-4 flex-wrap">
        <Link href={pathFor(language, "privacy")} className={`${legalFooterLinkClass} text-primary hover:underline`}>
          {t("legal_link_privacy")} →
        </Link>
        <Link href={`/${language}`} className={`${legalFooterLinkClass} text-muted-foreground hover:text-foreground`}>
          ← {t("legal_link_home")}
        </Link>
      </div>
    </div>
  );
}
