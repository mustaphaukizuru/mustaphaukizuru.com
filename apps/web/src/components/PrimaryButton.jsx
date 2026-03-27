export default function PrimaryButton({
  children,
  type = "button",
  fullWidth = false,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${
        fullWidth ? "w-full" : ""
      } rounded-xl bg-[#420060] px-4 py-2 text-white font-medium transition hover:bg-[#2e0044] disabled:opacity-50`}
    >
      {children}
    </button>
  );
}