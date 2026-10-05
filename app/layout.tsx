import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloseLoop — AI Operations Autopilot",
  description: "Reconcile business records, surface exceptions, and turn operational data into approved actions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
