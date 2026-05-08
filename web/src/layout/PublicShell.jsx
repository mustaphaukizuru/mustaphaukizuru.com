import Header from "./Header"
import Footer from "./Footer"

export default function PublicShell({ children }) {
  return (
    <div className="min-h-screen bg-mist" style={{ color: "var(--color-charcoal-80)" }}>
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
