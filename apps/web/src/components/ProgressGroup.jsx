export default function ProgressGroup({ title, items = [] }) {
  return (
    <div className={title ? "rounded-xl border border-[#634F40]/10 bg-white p-7 shadow-sm" : ""}>
      {title ? (
        <h3 className="font-['Sora'] text-2xl font-semibold text-[#420060]">
          {title}
        </h3>
      ) : null}

      <div className={title ? "mt-6 space-y-5" : "space-y-5"}>
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#634F40]/80">
              <span>{item.name}</span>
              <span>{item.value}%</span>
            </div>

            <div className="h-3 rounded-full bg-[#ede4ef]">
              <div
                className="h-3 rounded-full bg-[#420060]"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}