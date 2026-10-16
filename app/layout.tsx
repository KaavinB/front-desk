import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Front Desk",
  description: "Your Ring doorbell is your receptionist.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
