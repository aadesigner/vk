import { Link } from "wouter";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shown inside AdminLayout for unknown /adminx/* URLs. */
export default function AdminNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[min(70vh,32rem)] py-8">
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          <p className="text-6xl font-black text-primary/20 tabular-nums leading-none">404</p>
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <FileQuestion className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Admin page not found</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              This admin URL does not match any panel page. Use the sidebar or return to the dashboard.
            </p>
          </div>
          <Link href="/adminx" className={cn(buttonVariants(), "gap-2")}>
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
