export default function TimelineColumn({ title, items = [] }) {
  return (
    <div>
      <h3 className="font-display text-3xl font-bold text-violet">
        {title}
      </h3>

      <div className="relative mt-8 pl-8">
        <div className="absolute left-3 top-0 h-full w-px bg-charcoal-80/15" />

        <div className="space-y-8">
          {items.map((item) => (
            <div key={`${item.period}-${item.title}`} className="relative">
              <div className="absolute -left-[1.9rem] top-6 h-4 w-4 rounded-full border-4 border-mist bg-violet" />

              <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold tracking-wide text-[var(--color-terracotta-800)]">
                  {item.period}
                </div>

                <h4 className="mt-2 font-display text-2xl font-semibold text-violet">
                  {item.title}
                </h4>

                <p className="mt-3 text-base leading-8 text-charcoal-80/80">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}