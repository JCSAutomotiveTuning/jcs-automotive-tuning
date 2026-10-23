
import type { Metadata } from "next";
import "./globals.css";
import TawkToChat from "@/components/TawkToChat";

export const metadata: Metadata = {
  title: "JCS Automotive Tuning | Customer Portal",
  description:
    "Secure ECU and DSG/TCU tuning file submissions, diagnostics and order tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <TawkToChat />
      </body>
    </html>
  );
}
