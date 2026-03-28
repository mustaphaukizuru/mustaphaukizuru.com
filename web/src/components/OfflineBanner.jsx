import { useEffect, useState } from "react"
import { WifiOff, X } from "lucide-react"

export default function OfflineBanner() {
  const [offline,  setOffline]  = useState(!navigator.onLine)
  const [dismissed,setDismissed]= useState(false)

  useEffect(() => {
    function handleOnline()  { setOffline(false); setDismissed(false) }
    function handleOffline() { setOffline(true);  setDismissed(false) }
    window.addEventListener("online",  handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online",  handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!offline || dismissed) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl bg-[#2E2F3A] px-5 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.30)] text-white">
        <WifiOff className="h-4 w-4 text-[#FFCCAF] shrink-0" />
        <span className="text-[13px] font-medium">No internet connection</span>
        <button type="button" onClick={() => setDismissed(true)}
          className="ml-2 text-white/40 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
