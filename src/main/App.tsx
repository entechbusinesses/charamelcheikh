import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShiftProvider } from "@/contexts/ShiftContext";
// import { AuthProvider } from "@/contexts/AuthContext";
import Router from "@/routes/router";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    const storedColor = localStorage.getItem("mainColor") || "#000000";
    document.documentElement.style.setProperty("--color-main", storedColor);
  }, []);

  return (
    <div className="font-poppins">
      <AuthProvider>
        <ShiftProvider>
          <Router />
        </ShiftProvider>
      </AuthProvider>
      <Toaster />
    </div>
  );
}
