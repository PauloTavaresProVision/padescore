"use client";

import { MainScene, Stage, type TotemPayload } from "../totem/[token]/TotemView";

/**
 * Página de demo SEM API/DB — apenas para iterar visualmente o layout
 * do totem com mock data. Usa Stage + MainScene exportados do TotemView.
 */
const MOCK: TotemPayload = {
  tournament: {
    name: "Standard Bank Open Padel 2026",
    logoUrl: null,
    primaryColor: "#2d8cff",
  },
  court: "CAMPO 1",
  currentMatch: {
    id: "demo-1",
    status: "scheduled",
    scheduledAt: new Date(
      new Date().setHours(18, 0, 0, 0),
    ).toISOString(),
    teamA: {
      p1: { name: "Carlos Sousa", shortName: "CARLOS SOUSA", photoUrl: null },
      p2: { name: "Sergio Vieira", shortName: "SERGIO VIEIRA", photoUrl: null },
    },
    teamB: {
      p1: { name: "Nicolau M.", shortName: "NICOLAU M.", photoUrl: null },
      p2: { name: "Wojtek D.", shortName: "WOJTEK D.", photoUrl: null },
    },
  },
  nextMatch: {
    id: "demo-2",
    status: "scheduled",
    scheduledAt: null,
    teamA: {
      p1: { name: "Diogo M", shortName: "DIOGO M", photoUrl: null },
      p2: { name: "Manuel P", shortName: "MANUEL P", photoUrl: null },
    },
    teamB: {
      p1: { name: "Miguel R", shortName: "MIGUEL R", photoUrl: null },
      p2: { name: "Tomás G", shortName: "TOMÁS G", photoUrl: null },
    },
  },
  sponsors: {
    footer: [
      { imageUrl: "/totem/standard-bank-angola.svg" },
      { imageUrl: "/totem/standard-bank-angola.svg" },
      { imageUrl: "/totem/standard-bank-angola.svg" },
    ],
    fullscreen: [],
  },
  serverTime: new Date().toISOString(),
};

export default function TotemDemoPage() {
  return (
    <Stage>
      <MainScene data={MOCK} />
    </Stage>
  );
}
