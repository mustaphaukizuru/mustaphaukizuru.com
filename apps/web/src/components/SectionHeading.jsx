export default function SectionHeading({
  title,
  subtitle,
  align = "center",
  action = null,
  titleClassName = "",
  subtitleClassName = "",
}) {
  const alignClass =
    align === "left" ? "items-start text-left" : "items-center text-center"

  return (
    <div
      className={`mb-10 flex flex-col gap-3 ${
        action ? "lg:flex-row lg:items-end lg:justify-between" : ""
      }`}
    >
      <div className={`flex flex-col ${alignClass}`}>
        <h2
          className={`font-['Sora'] text-[1.6rem] font-bold tracking-tight text-[#420060] sm:text-[2.05rem] ${titleClassName}`}
        >
          {title}
        </h2>

        {subtitle ? (
          <p
            className={`mt-2 max-w-3xl text-[15px] leading-8 text-[#634F40]/75 sm:text-base ${subtitleClassName}`}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {action && <div className="mt-4 lg:mt-0">{action}</div>}
    </div>
  )
}