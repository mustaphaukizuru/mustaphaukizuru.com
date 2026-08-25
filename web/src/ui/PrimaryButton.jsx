export default function PrimaryButton({
  children, className="", type="button",
  fullWidth=false, onClick, disabled=false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3",
        "text-meta font-semibold text-white shadow-[0_10px_28px_rgb(var(--color-violet-rgb)/0.22)]",
        "transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_16px_36px_rgb(var(--color-violet-rgb)/0.28)]",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  )
}
