import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loteamento3D, type Lot, type LotView } from "@/components/Loteamento3D";
import { LotDetailSheet } from "@/components/LotDetailSheet";
import { LAYOUT_LOTS, AREA_SUMMARY } from "@/lib/loteamento";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loteamento 3D — Veja e reserve seu lote" },
      {
        name: "description",
        content:
          "Explore a planta do loteamento em 3D, visualize os lotes disponíveis, reservados e vendidos e fale com o corretor.",
      },
      { property: "og:title", content: "Loteamento 3D — Veja e reserve seu lote" },
      {
        property: "og:description",
        content: "Planta interativa em 3D com status em tempo real dos lotes.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [dbLots, setDbLots] = useState<Lot[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showHouses, setShowHouses] = useState(true);



  const load = useCallback(async () => {
    const { data, error } = await supabase.from("lots").select("*").order("number");
    if (error) {
      toast.error(error.message);
      return;
    }
    setDbLots(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("lots-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Planta real (quadro de áreas do PDF) + status/preço vindos do banco,
  // casados pelo número do lote.
  const lots: LotView[] = useMemo(() => {
    const byNumber = new Map<number, Lot>();
    for (const row of dbLots) {
      const n = Number.parseInt(row.number, 10);
      if (!Number.isNaN(n)) byNumber.set(n, row);
    }
    return LAYOUT_LOTS.map((ll) => {
      const db = byNumber.get(ll.number);
      return {
        ...ll,
        id: db?.id ?? null,
        status: db?.status ?? "available",
        price: db && Number(db.price) > 0 ? Number(db.price) : null,
        whatsapp: db?.whatsapp ?? null,
        notes: db?.notes ?? null,
      };
    });
  }, [dbLots]);

  const selected = useMemo(
    () => lots.find((l) => l.number === selectedNumber) ?? null,
    [lots, selectedNumber],
  );

  const handleSelect = (lot: LotView) => {
    setSelectedNumber(lot.number);
    setSheetOpen(true);
  };

  const stats = {
    total: lots.length,
    available: lots.filter((l) => l.status === "available").length,
    reserved: lots.filter((l) => l.status === "reserved").length,
    sold: lots.filter((l) => l.status === "sold").length,
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu");
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 md:p-6 pointer-events-none">
        <div className="pointer-events-auto rounded-xl bg-background/80 backdrop-blur-md border border-border px-4 py-3 shadow-lg">
          <h1 className="text-lg md:text-xl font-bold">Residencial Vista 3D</h1>
          <p className="text-xs text-muted-foreground">Clique em um lote para ver detalhes</p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant={showHouses ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHouses((v) => !v)}
          >
            {showHouses ? "Casas: ON" : "Casas: OFF"}
          </Button>
          {!authLoading && user ? (
            <>
              {isAdmin && (
                <Badge variant="default" className="hidden md:inline-flex">
                  Admin
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={signOut}>
                Sair
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Entrar</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-xl bg-background/80 backdrop-blur-md border border-border p-4 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
          Legenda
        </p>
        <div className="space-y-2 text-sm">
          <LegendRow color="#22c55e" label="Disponível" count={stats.available} />
          <LegendRow color="#f59e0b" label="Reservado" count={stats.reserved} />
          <LegendRow color="#ef4444" label="Vendido" count={stats.sold} />
          <div className="pt-2 mt-2 border-t border-border text-xs text-muted-foreground space-y-0.5">
            <p>
              {stats.total} lotes em 10 quadras · {AREA_SUMMARY.lotesComerciais} comerciais
            </p>
            <p>
              Loteamento{" "}
              {AREA_SUMMARY.totalM2.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}{" "}
              m²
            </p>
          </div>
        </div>
      </div>

      {/* 3D scene (client-only) */}
      <ClientOnly
        fallback={
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Carregando visualização 3D...
          </div>
        }
      >
        <Loteamento3D lots={lots} selectedNumber={selectedNumber} onSelect={handleSelect} />
      </ClientOnly>

      <LotDetailSheet
        lot={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isAdmin={isAdmin}
        onChanged={load}
      />
    </div>
  );
}

function LegendRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="flex-1">{label}</span>
      <span className="text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}
