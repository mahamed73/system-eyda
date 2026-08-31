import { getBookingByToken } from "@/lib/booking/queries";
import { notFound } from "next/navigation";
import TrackClient from "./track-client";

export default async function TrackBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  return <TrackClient token={token} initial={JSON.parse(JSON.stringify(booking))} />;
}
