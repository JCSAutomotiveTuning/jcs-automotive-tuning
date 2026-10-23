"use client";

import Script from "next/script";

export default function TawkToChat() {
  return (
    <Script
      id="tawk-to-chat"
      strategy="afterInteractive"
      src="https://embed.tawk.to/6adb55eaa8d435346081b52b/1k5kcf7pe"
    />
  );
}
