"use client";

import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "./icons";
import { whatsappHref } from "./whatsapp-link";

export interface WhatsAppTemplate {
  id: string;
  label: string;
  build: (patientName: string) => string;
}

/** القوالب الجاهزة — بتتملي تلقائيًا باسم المريض */
export const whatsappTemplates: WhatsAppTemplate[] = [
  {
    id: "confirm",
    label: "تأكيد الموعد",
    build: (name) =>
      `أهلاً ${name} 🌸\nبشّر بتأكيد موعدك في العيادة.\nنتمنّى لكم دوام الصحة والعافية.`,
  },
  {
    id: "remind",
    label: "تذكير بالفحص / المتابعة",
    build: (name) =>
      `أهلاً ${name} 🌸\nتذكير بموعد المتابعة في العيادة.\nلو محتاج تعديل الموعد، كلمنا على الرقم ده.`,
  },
  {
    id: "thanks",
    label: "شكرًا لزيارتك",
    build: (name) =>
      `أهلاً ${name} 🌸\nشكرًا لزيارتكم للعيادة اليوم، وربنا يتمّم شفاكم على خير.\nمع تمنّياتنا بدوام الصحة.`,
  },
];

interface WhatsAppTemplatesProps {
  patientName: string;
  phone: string;
  buttonClassName?: string;
}

/**
 * زرار منسدل بقوالب رسائل واتساب جاهزة. لما المستخدم يختار قالب،
 * بتفتح محادثة واتساب مع المريض والرسالة مكتوبة مسبقًا — يضغط إرسال بنفسه.
 */
export default function WhatsAppTemplates({
  patientName,
  phone,
  buttonClassName,
}: WhatsAppTemplatesProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center justify-center rounded-full text-white bg-[#25D366] hover:bg-[#1ebe5b] transition-colors w-7 h-7 shrink-0 ${buttonClassName ?? ""}`}
        title="إرسال رسالة واتساب جاهزة"
      >
        <WhatsAppIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <p className="text-xs font-semibold text-slate-400 px-3 pt-2 pb-1">رسائل واتساب جاهزة</p>
          {whatsappTemplates.map((t) => (
            <a
              key={t.id}
              href={whatsappHref(phone, t.build(patientName))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block text-right text-sm text-slate-700 hover:bg-slate-50 px-3 py-2"
            >
              {t.label}
            </a>
          ))}
          <a
            href={whatsappHref(phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block text-right text-sm text-slate-500 hover:bg-slate-50 px-3 py-2 border-t border-slate-100"
          >
            رسالة فارغة (بدون قالب)
          </a>
        </div>
      )}
    </div>
  );
}
