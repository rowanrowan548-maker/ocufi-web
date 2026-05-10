import { redirect } from 'next/navigation';

// T-974 BUG-038 · /markets/trending → /?tab=trending(Landing 行情区单一信源)
export default async function TrendingRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}?tab=trending`);
}
