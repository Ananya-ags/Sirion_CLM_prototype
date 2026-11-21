"use client";

import { ArrowLeft, ArrowRight, Compass, Loader2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDocketStore } from "@/store/useDocketStore";
import { TOUR } from "./steps";
import { SEEN_KEY, useTour } from "./tourStore";

/** Welcome modal (first load) + lightweight stepper tour. No tour library: a spotlight box and an anchored callout. */
export function Tour() {
  const { welcome, step, openWelcome, closeWelcome, setStep } = useTour();
  const resetDemo = useDocketStore((s) => s.resetDemo);

  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    if (!seen) {
      const t = setTimeout(openWelcome, 400);
      return () => clearTimeout(t);
    }
  }, [openWelcome]);

  const start = () => {
    closeWelcome();
    resetDemo(); // the tour always runs from a fresh demo state
    setTimeout(() => setStep(0), 300);
  };

  return (
    <>
      <Dialog open={welcome} onOpenChange={(o) => !o && closeWelcome()}>
        <DialogContent className="max-w-lg p-0 sm:max-w-lg">
          <div className="rounded-t-lg bg-hero-gradient px-6 py-6 text-white">
            <div className="flex items-center gap-2 text-sm font-medium text-white/85"><Compass className="size-4" /> Welcome to Docket</div>
            <DialogTitle className="mt-2 text-2xl leading-snug font-semibold text-white">Every renewal caught. Only the risky ones need you.</DialogTitle>
          </div>
          <div className="space-y-5 px-6 pt-2 pb-6">
            <DialogDescription asChild>
              <div className="space-y-2 text-base leading-relaxed text-slate-700">
                <p>Velora Consumer has about 2,500 supplier contracts and no CLM. Docket catches renewals before they roll over and routes them to the right people.</p>
                <p>Docket scans contracts and renewal data across shared drives, mailboxes, DocuSign, Excel trackers and the AP ledger, bringing every upcoming renewal into one place.</p>
                <p>Problem contracts are stopped or corrected before they renew, preventing silent auto-renewals, unchecked price increases, missed SLAs and billing mismatches.</p>
              </div>
            </DialogDescription>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" className="flex-1" onClick={start}><Compass /> Take the 3-minute tour</Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={closeWelcome}>Skip, explore on my own</Button>
            </div>
            <p className="text-xs text-slate-500">Starts from a fresh demo state · reopen via “Tour” in the top bar.</p>
          </div>
        </DialogContent>
      </Dialog>
      {step !== null && <TourOverlay index={step} />}
    </>
  );
}

function TourOverlay({ index }: { index: number }) {
  const step = TOUR[index];
  const router = useRouter();
  const pathname = usePathname();
  const { setStep, busy, setBusy } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const entered = useRef(false);
  const scrolled = useRef(false);
  const stepPathname = step.path.split("?")[0];

  // Navigate to this step's page; the persona follows the route (RouteSync), same as any other navigation.
  useEffect(() => {
    entered.current = false;
    scrolled.current = false;
    if (window.location.pathname + window.location.search !== step.path) router.push(step.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Find the target (pages render client-side, sheets open later) and keep the spotlight on it.
  useEffect(() => {
    const t = setInterval(() => {
      if (step.onEnter && !entered.current && pathname === stepPathname) entered.current = step.onEnter();
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      // Scroll once on arrival, and again if late-loading content pushed the target off-screen.
      if (!scrolled.current || r.top > window.innerHeight || r.bottom < 0) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        scrolled.current = true;
      }
      setRect(r);
    }, 200);
    return () => clearInterval(t);
  }, [step, pathname, stepPathname]);

  const last = index === TOUR.length - 1;
  const next = async () => {
    setBusy(true);
    try {
      await step.onNext?.();
    } finally {
      setBusy(false);
    }
    setStep(last ? null : index + 1);
  };

  // Callout placement: below the target if there's room, else above, else centred.
  const W = 380;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  let style: React.CSSProperties = { left: vw / 2 - W / 2, top: vh / 2 - 100 };
  if (rect && step.placement === "left") {
    style = { left: Math.max(16, rect.left - W - 20), top: Math.max(16, Math.min(rect.top + 40, vh - 260)) };
  } else if (rect) {
    const left = Math.min(Math.max(rect.left, 16), vw - W - 16);
    if (vh - rect.bottom > 230) style = { left, top: Math.max(rect.bottom + 14, 16) };
    else if (rect.top > 230) style = { left, top: Math.max(rect.top - 14 - 200, 16) };
    else style = { left: Math.max(16, Math.min(rect.right + 16, vw - W - 16)), top: Math.max(16, Math.min(rect.top, vh - 240)) };
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="tour-spotlight pointer-events-none fixed z-[90]"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: Math.min(rect.height + 12, vh - Math.max(rect.top - 6, 0)) }}
        />
      )}
      <div role="dialog" aria-label={`Tour step ${index + 1}`} className="pointer-events-auto fixed z-[100] w-[380px] rounded-xl border bg-white p-4 shadow-lift" style={{ ...style, pointerEvents: "auto" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-semibold tracking-wide text-brand uppercase">Step {index + 1} of {TOUR.length}</div>
          <button aria-label="Skip tour" onClick={() => setStep(null)} className="text-slate-400 hover:text-navy"><X className="size-4" /></button>
        </div>
        <div className="mt-1 text-base font-semibold text-navy">{step.title}</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{rect ? step.body : "Loading this step…"}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-brand transition-all" style={{ width: `${((index + 1) / TOUR.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep(null)}>Skip tour</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={index === 0 || busy} onClick={() => setStep(index - 1)}><ArrowLeft /> Back</Button>
            <Button size="sm" disabled={busy} onClick={next} data-tour-next>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {step.nextLabel ?? "Next"} {!busy && !last && <ArrowRight />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
