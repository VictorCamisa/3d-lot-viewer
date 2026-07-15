import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import type { Lot } from "./Loteamento3D";

const STATUS_LABEL: Record<Lot["status"], string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
};

const STATUS_VARIANT: Record<Lot["status"], "default" | "secondary" | "destructive"> = {
  available: "default",
  reserved: "secondary",
  sold: "destructive",
};

export function LotDetailSheet({
  lot,
  open,
  onOpenChange,
  isAdmin,
  onChanged,
}: {
  lot: Lot | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  if (!lot) return null;

  const setStatus = async (status: Lot["status"]) => {
    setSaving(true);
    const { error } = await supabase.from("lots").update({ status }).eq("id", lot.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Lote ${lot.number} atualizado`);
    onChanged();
  };

  const priceFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(lot.price));

  const waMsg = encodeURIComponent(
    `Olá! Tenho interesse no lote ${lot.number} (${lot.area_m2} m² — ${priceFormatted}).`,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="text-2xl">Lote {lot.number}</SheetTitle>
            <Badge variant={STATUS_VARIANT[lot.status]}>{STATUS_LABEL[lot.status]}</Badge>
          </div>
          <SheetDescription>Detalhes e disponibilidade do lote</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Área</p>
              <p className="text-lg font-semibold">{lot.area_m2} m²</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preço</p>
              <p className="text-lg font-semibold">{priceFormatted}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Dimensões</p>
              <p className="text-lg font-semibold">
                {lot.width} × {lot.depth} m
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Quadra</p>
              <p className="text-lg font-semibold">
                {String.fromCharCode(65 + lot.grid_z)}-{lot.grid_x + 1}
              </p>
            </div>
          </div>

          {lot.status === "available" && lot.whatsapp && (
            <a
              href={`https://wa.me/${lot.whatsapp.replace(/\D/g, "")}?text=${waMsg}`}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Button className="w-full" size="lg">
                Falar com corretor no WhatsApp
              </Button>
            </a>
          )}

          {isAdmin && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-semibold">Painel do administrador</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={lot.status === "available" ? "default" : "outline"}
                  size="sm"
                  disabled={saving}
                  onClick={() => setStatus("available")}
                >
                  Disponível
                </Button>
                <Button
                  variant={lot.status === "reserved" ? "default" : "outline"}
                  size="sm"
                  disabled={saving}
                  onClick={() => setStatus("reserved")}
                >
                  Reservado
                </Button>
                <Button
                  variant={lot.status === "sold" ? "default" : "outline"}
                  size="sm"
                  disabled={saving}
                  onClick={() => setStatus("sold")}
                >
                  Vendido
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
