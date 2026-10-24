
import type { Metadata } from "next";
import "./globals.css";
import TawkToChat from "@/components/TawkToChat";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

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

