export default function AuthInput({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
}) {
  const Icon = icon

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#634F40]/75">
        {label}
      </span>
      <div className="flex items-center rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3">
        {Icon && <Icon className="mr-3 h-4 w-4 text-[#634F40]/45" />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none"
        />
      </div>
    </label>
  )
}