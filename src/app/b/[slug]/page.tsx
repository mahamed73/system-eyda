import { getClinicBySlug } from "@/lib/booking/queries";
import BookingClient from "./booking-client";
import { notFound } from "next/navigation";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  // تاريخ النهاردة بتوقيت القاهرة (YYYY-MM-DD)؛ الغد هو الافتراضي للحجز
  const defaultDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

  return (
    <BookingClient
      slug={slug}
      clinicName={clinic.name}
      address={clinic.address ?? ""}
      phone={clinic.phone ?? ""}
      doctorName={clinic.doctor_name ?? ""}
      visitTypes={clinic.booking_visit_types}
      defaultDate={defaultDate}
    />
  );
}
