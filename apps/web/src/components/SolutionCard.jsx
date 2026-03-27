export default function SectionHeading({
  title,
  subtitle,
  align = "center",
  action = null,
}) {
  const isLeft = align === "left"

  return (
    <div
      className={`mb-10 flex flex-col gap-4 ${
        isLeft ? "items-start text-left" : "items-center text-center"
      } sm:flex-row sm:justify-between sm:gap-6 ${
        isLeft ? "sm:items-end" : "sm:items-end"
      }`}
    >
      <div className={isLeft ? "max-w-3xl" : "max-w-3xl sm:mx-auto"}>
        <h2 className="font-['Sora'] text-4xl font-bold tracking-tight text-[#420060] sm:text-5xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-base leading-8 text-[#634F40]/80 sm:text-lg">
            {subtitle}
          </p>
        )}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}