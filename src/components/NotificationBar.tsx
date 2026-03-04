"use client";

type NoticeType = "info" | "success" | "error";

export type Notice = {
  type: NoticeType;
  message: string;
};

type Props = {
  notice: Notice | null;
  onClose: () => void;
};

const STYLES: Record<
  NoticeType,
  { ring: string; bg: string; dot: string; text: string }
> = {
  info: {
    ring: "ring-sky-200/40",
    bg: "bg-sky-50/20",
    dot: "bg-sky-400",
    text: "text-sky-50",
  },
  success: {
    ring: "ring-emerald-200/40",
    bg: "bg-emerald-50/15",
    dot: "bg-emerald-400",
    text: "text-emerald-50",
  },
  error: {
    ring: "ring-rose-200/40",
    bg: "bg-rose-50/15",
    dot: "bg-rose-400",
    text: "text-rose-50",
  },
};

export default function NotificationBar({ notice, onClose }: Props) {
  if (!notice) return null;
  const s = STYLES[notice.type];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-3">
      <div
        className={[
          "group relative overflow-hidden rounded-2xl border border-white/10",
          "backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
          "ring-1",
          s.ring,
          s.bg,
        ].join(" ")}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/0 to-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative flex items-start gap-3 px-4 py-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
          <div className={`text-sm ${s.text}`}>
            <span className="font-semibold">{notice.type.toUpperCase()}</span>
            <span className="opacity-90"> - {notice.message}</span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
