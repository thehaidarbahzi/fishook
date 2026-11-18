const rawSite = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
const rawGithub = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() ?? "";

export const site = {
  name: "fishook",
  url: rawSite || "http://localhost:3000",
  github: rawGithub,
} as const;

export function absoluteUrl(pathname: string): string {
  return `${site.url.replace(/\/$/, "")}${pathname}`;
}
