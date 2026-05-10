// vpn.ts — VPN/IP status checker
// Fetches the device's *real* public IP (which travels via the user's VPN if active)
// and compares geo against the currently spoofed timezone.

export type VpnStatus = {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
  fetchedAt: number;
};

export async function fetchVpnStatus(signal?: AbortSignal): Promise<VpnStatus> {
  // ipapi.co is free, no key, returns JSON. Backup: ip-api.com
  try {
    const res = await fetch("https://ipapi.co/json/", { signal });
    if (!res.ok) throw new Error("ipapi failed: " + res.status);
    const j = await res.json();
    return {
      ip: j.ip || "?",
      country: j.country_name || "?",
      countryCode: j.country_code || "?",
      region: j.region || "?",
      city: j.city || "?",
      timezone: j.timezone || "?",
      isp: j.org || "?",
      fetchedAt: Date.now(),
    };
  } catch (e) {
    // fallback
    const res = await fetch("https://ipwho.is/?fields=ip,country,country_code,region,city,timezone,connection", { signal });
    const j = await res.json();
    return {
      ip: j.ip || "?",
      country: j.country || "?",
      countryCode: j.country_code || "?",
      region: j.region || "?",
      city: j.city || "?",
      timezone: (j.timezone && j.timezone.id) || "?",
      isp: (j.connection && j.connection.isp) || "?",
      fetchedAt: Date.now(),
    };
  }
}

// Compare the real timezone (from VPN exit) vs the spoofed timezone in the identity.
// If they don't match, websites can detect inconsistency and increase risk score.
export function timezoneMismatch(realTz: string, spoofedTz: string): boolean {
  if (!realTz || !spoofedTz || realTz === "?" || spoofedTz === "?") return false;
  // Compare by continent only (e.g., America/New_York vs America/Los_Angeles is OK-ish but still a mismatch)
  const a = realTz.split("/")[0];
  const b = spoofedTz.split("/")[0];
  return a !== b;
}
