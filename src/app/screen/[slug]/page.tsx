import { getPublicWaitingScreen } from "@/lib/queue/queries";
import { notFound } from "next/navigation";
import ScreenClient from "./screen-client";

export default async function WaitingScreenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicWaitingScreen(slug);
  if (!data) notFound();

  return <ScreenClient slug={slug} initial={JSON.parse(JSON.stringify(data))} />;
}
