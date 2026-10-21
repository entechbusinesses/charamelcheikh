import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import Navbar from "@/components/Navbar";
import { routeConfig } from "@/lib/routes";
import Login from "@/pages/principal/Login";
import UnauthorizedPage from "@/pages/404/unauthorized";

type Role = "ADMIN" | "CAISSIER";

const AuthWrapper = ({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <UnauthorizedPage />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col md:p-5 pb-24 md:pb-5 min-w-0 [&>*]:flex-1 [&>*]:min-w-0">
        {children}
      </div>
    </div>
  );
};

export default function Router() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {routeConfig.map((route) => {
          if (route.isPublic) {
            return (
              <Route
                key={route.path}
                path={route.path}
                element={
                  !user ? <route.element /> : <Navigate to="/" replace />
                }
              />
            );
          }

          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                <AuthWrapper roles={route.roles as any}>
                  <route.element />
                </AuthWrapper>
              }
            />
          );
        })}

        <Route
          path="*"
          element={<Navigate to={user ? "/404" : "/login"} replace />}
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
