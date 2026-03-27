export default function AuthLayout({ children }) {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "linear-gradient(145deg, #F7F9F4 0%, #f0e9f3 50%, #F1EAE3 100%)" }}
    >
      {children}
    </div>
  )
}
