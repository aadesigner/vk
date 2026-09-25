import { useState, useEffect } from "react";
import { useAdminGetPricing, useAdminUpdatePricing } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Eye, Save, Tag } from "lucide-react";
import { DEFAULT_PRICING } from "@/lib/pricing-defaults";
import { formatDisplayPrice, roundCurrencyAmount } from "@/lib/format-display-price";
import { useToast } from "@/hooks/use-toast";

export default function AdminPricing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: pricing, isLoading } = useAdminGetPricing();
  const updatePricing = useAdminUpdatePricing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/current-pricing"] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save pricing." });
      },
    }
  });

  const [form, setForm] = useState<{
    basePrice: number;
    discountPrice: number;
    discountEnabled: boolean;
    currency: string;
  }>({
    basePrice: DEFAULT_PRICING.basePrice,
    discountPrice: DEFAULT_PRICING.discountPrice,
    discountEnabled: DEFAULT_PRICING.discountEnabled,
    currency: DEFAULT_PRICING.currency,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pricing) {
      setForm({
        basePrice: pricing.basePrice,
        discountPrice: pricing.discountPrice,
        discountEnabled: pricing.discountEnabled,
        currency: pricing.currency,
      });
    }
  }, [pricing]);

  const handleSave = () => {
    updatePricing.mutate({
      data: {
        ...form,
        basePrice: roundCurrencyAmount(form.basePrice),
        discountPrice: roundCurrencyAmount(form.discountPrice),
      },
    });
  };

  const customerPrice = form.discountEnabled ? form.discountPrice : form.basePrice;
  const currencySymbol = form.currency === "EUR" ? "€" : form.currency === "USD" ? "$" : form.currency;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Pricing</h1>
        <p className="text-muted-foreground mt-1">Configure VIN report pricing</p>
      </div>

      {/* "Customers currently see" banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Eye className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                Customers currently see
              </p>
              <div className="flex items-baseline gap-2">
                {form.discountEnabled && (
                  <span className="text-lg text-muted-foreground line-through">{formatDisplayPrice(form.basePrice, currencySymbol)}</span>
                )}
                <span className="text-3xl font-bold text-primary">{formatDisplayPrice(customerPrice, currencySymbol)}</span>
                <span className="text-sm text-muted-foreground">/ report</span>
              </div>
            </div>
            {form.discountEnabled && (
              <Badge className="ml-auto bg-primary/10 text-primary border-0">
                <Tag className="h-3 w-3 mr-1" />
                Offer active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Settings</CardTitle>
          <CardDescription>Changes take effect immediately for new purchases</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>List Price — full ({form.currency})</Label>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">Shown crossed-out when offer is active</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="pl-7"
                      value={form.basePrice}
                      onChange={(e) => setForm(f => ({ ...f, basePrice: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Offer Price — when active ({form.currency})</Label>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">What customers pay when offer is on</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="pl-7"
                      value={form.discountPrice}
                      onChange={(e) => setForm(f => ({ ...f, discountPrice: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  maxLength={3}
                  className="max-w-[100px] uppercase"
                />
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Switch
                  id="discount-enabled"
                  checked={form.discountEnabled}
                  onCheckedChange={(v) => setForm(f => ({ ...f, discountEnabled: v }))}
                />
                <div>
                  <Label htmlFor="discount-enabled" className="cursor-pointer font-semibold">
                    Discount active — customers see the offer price
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toggle on to show the offer price; toggle off to show the full list price
                  </p>
                </div>
              </div>

              <Button onClick={handleSave} disabled={updatePricing.isPending} className="w-full">
                {saved ? (
                  <>✓ Saved</>
                ) : updatePricing.isPending ? (
                  "Saving..."
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Save Pricing</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
