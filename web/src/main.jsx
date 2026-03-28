import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "./App"
import "./index.css"

import { ToastProvider }        from "./context/ToastContext"
import { AuthProvider }         from "./context/AuthContext"
import { CartProvider }         from "./store/CartContext"
import { NotificationProvider } from "./context/NotificationContext"
import OfflineBanner            from "./components/OfflineBanner"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>
              <App />
              <OfflineBanner />
            </CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
