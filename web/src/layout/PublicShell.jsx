import Header from "./Header"
import Footer from "./Footer"

export default function PublicShell({ children }) {
  return (
    <div className="min-h-screen bg-[#F7F9F4]" style={{ color: "#634F40" }}>
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
