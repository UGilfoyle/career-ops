/** UPI brand mark + supported-app row for the checkout page. */

export function UpiMark({
  size = 22,
  tone = 'dark',
}: {
  size?: number;
  tone?: 'dark' | 'light';
}) {
  const text = tone === 'light' ? '#FFFFFF' : '#0B1B34';
  return (
    <span className="inline-flex items-center gap-2" aria-label="UPI">
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M6 2 L13 2 L8.5 22 L1.5 22 Z" fill="#F26522" />
        <path d="M11.5 2 L18.5 2 L14 22 L7 22 Z" fill="#0F9D58" />
      </svg>
      <span
        style={{ color: text }}
        className="font-black tracking-tight leading-none"
        aria-hidden="true"
      >
        UPI
      </span>
    </span>
  );
}

export function UpiTagline({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span
      className={`text-[8px] font-bold uppercase tracking-[0.18em] ${
        tone === 'light' ? 'text-white/60' : 'text-[#6B6B6B]'
      }`}
    >
      Unified Payments Interface
    </span>
  );
}

const APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay'];

export function UpiAppsRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {APPS.map((app) => (
        <span
          key={app}
          className="text-[10px] font-semibold text-[#6B6B6B] bg-white border border-[#E5E5E0] rounded-full px-2.5 py-1"
        >
          {app}
        </span>
      ))}
    </div>
  );
}
