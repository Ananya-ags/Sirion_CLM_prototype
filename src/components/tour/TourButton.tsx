"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "./tourStore";

export function TourButton({ size = "lg" }: { size?: "sm" | "default" | "lg" }) {
  const openWelcome = useTour((s) => s.openWelcome);
  return <Button size={size} onClick={openWelcome}><Compass /> Take the 3-minute tour</Button>;
}
