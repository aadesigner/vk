import { Link } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOHead, usePageSeo } from "@/components/seo";

export default function NotFound() {
  const { t, language } = useTranslation();
  const seo = usePageSeo("not_found");

  return (
    <div className="min-h-[calc(100dvh-64px)] flex items-center justify-center px-4 py-16">
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        noIndex
      />
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          <p className="text-6xl font-black text-primary/20 tabular-nums leading-none">
            {t("page_not_found_code")}
          </p>
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{t("page_not_found_title")}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t("page_not_found_desc")}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href={`/${language}`}>
              <Home className="h-4 w-4" />
              {t("back_to_home")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
