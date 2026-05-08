export default function ProgressGroup({ title, items = [] }) {
  return (
    <div className={title ? "rounded-xl border border-charcoal-80/10 bg-white p-7 shadow-sm" : ""}>
      {title ? (
        <h3 className="font-['Sora'] text-2xl font-semibold text-violet">
          {title}
        </h3>
      ) : null}

      <div className={title ? "mt-6 space-y-5" : "space-y-5"}>
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-charcoal-80/80">
              <span>{item.name}</span>
              <span>{item.value}%</span>
            </div>

            <div className="h-3 rounded-full bg-violet-pale">
              <div
                className="h-3 rounded-full bg-violet"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}