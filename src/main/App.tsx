import { Toaster } from "@/components/ui/toaster";
import TableCardLabels from "@/components/TableCardLabels";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShiftProvider } from "@/contexts/ShiftContext";
import { TicketRequestsProvider } from "@/components/ticketRequests/TicketRequestsProvider";
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
          <TicketRequestsProvider>
            <Router />
          </TicketRequestsProvider>
        </ShiftProvider>
      </AuthProvider>
      <Toaster />
      <TableCardLabels />
    </div>
  );
}
