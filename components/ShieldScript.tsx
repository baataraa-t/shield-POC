import Script from "next/script";

export function ShieldScript() {
  const siteId = process.env.NEXT_PUBLIC_SHIELD_SITE_ID?.trim();

  if (!siteId) {
    return null;
  }

  return (
    <Script
      id="shield-wsdk"
      src={`https://dm7lr0s4n6vk6.webdevicejs.com/${siteId}/wsdk.js`}
      strategy="beforeInteractive"
    />
  );
}
