import { WhatsAppIcon } from "./icons";

/** يحوّل رقم مصري محلي لصيغة دولية مناسبة لـ wa.me */
export function toWhatsappNumber(phone: string): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "20" + d.slice(1);
  return d;
}

/** يرجّع رابط واتساب جاهز (مع رسالة مكتوبة مسبقًا لو موجودة) */
export function whatsappHref(phone: string, message?: string): string {
  const num = toWhatsappNumber(phone);
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

interface WhatsAppLinkProps {
  phone: string;
  message?: string;
  className?: string;
  title?: string;
}

/**
 * زرار صغير بيفتح محادثة واتساب مع الرقم مباشرة (من غير نسخ ولصق).
 * لو فيه message، الرسالة بتتملي جاهزة والسكرتارية تدوس إرسال بنفسها.
 */
export default function WhatsAppLink({ phone, message, className, title }: WhatsAppLinkProps) {
  return (
    <a
      href={whatsappHref(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "فتح محادثة واتساب"}
      className={`inline-flex items-center justify-center rounded-full text-white bg-[#25D366] hover:bg-[#1ebe5b] transition-colors w-7 h-7 shrink-0 ${className ?? ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <WhatsAppIcon className="w-4 h-4" />
    </a>
  );
}
