export default function TimelineColumn({ title, items = [] }) {
  return (
    <div>
      <h3 className="font-['Sora'] text-3xl font-bold text-[#420060]">
        {title}
      </h3>

      <div className="relative mt-8 pl-8">
        <div className="absolute left-3 top-0 h-full w-px bg-[#634F40]/15" />

        <div className="space-y-8">
          {items.map((item) => (
            <div key={`${item.period}-${item.title}`} className="relative">
              <div className="absolute -left-[1.9rem] top-6 h-4 w-4 rounded-full border-4 border-[#F7F9F4] bg-[#420060]" />

              <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold tracking-wide text-[#d68054]">
                  {item.period}
                </div>

                <h4 className="mt-2 font-['Sora'] text-2xl font-semibold text-[#420060]">
                  {item.title}
                </h4>

                <p className="mt-3 text-base leading-8 text-[#634F40]/80">
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