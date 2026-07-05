import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type CompanySettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildRedirectPath(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString
    ? `/settings/organization?${queryString}`
    : "/settings/organization";
}

export default async function CompanySettingsPage({
  searchParams,
}: CompanySettingsPageProps) {
  const params = searchParams ? await searchParams : {};
  redirect(buildRedirectPath(params));
}
