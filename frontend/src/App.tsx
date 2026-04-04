import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes, Outlet, Navigate, useLocation, Link } from "react-router-dom";
import {
  ThemedLayoutV2,
  ErrorComponent,
  notificationProvider,
  ThemedSiderV2,
} from "@refinedev/antd";
import routerProvider, { NavigateToResource } from "@refinedev/react-router-v6";
import { Authenticated, Refine } from "@refinedev/core";
import { ConfigProvider } from "antd";
import { UserOutlined, ClusterOutlined, HeartOutlined } from "@ant-design/icons";

import { UsersPage } from "./pages/users";
import { ChainsPage } from "./pages/chains";
import { LoginPage } from "./pages/login";
import { HealthPage } from "./pages/health";
import { PrivacyPage } from "./pages/privacy";
import { TermsPage } from "./pages/terms";
import { authProvider } from "./authProvider";
import { theme } from "./theme";
import { AppSider } from "./components/AppSider";

const AppRoutes: React.FC = () => {
  const [role, setRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const load = async () => {
      if (!authProvider.getIdentity) return;
      const identity = await authProvider.getIdentity();
      setRole(identity?.role ?? null);
    };
    load();
  }, [location.pathname]);

  const resources = useMemo(() => {
    const base = [{ name: "chains", list: "/chains", icon: <ClusterOutlined /> }];
    if (role !== "admin") return base;
    return [
      ...base,
      { name: "users", list: "/users", icon: <UserOutlined /> },
      { name: "health", list: "/health", icon: <HeartOutlined /> },
    ];
  }, [role]);

  return (
    <Refine
      authProvider={authProvider}
      notificationProvider={notificationProvider}
      routerProvider={routerProvider}
      resources={resources}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          element={
            <Authenticated
              key="authenticated"
              fallback={<Navigate to="/login" replace />}
            >
              <ThemedLayoutV2
                Sider={AppSider}
                Title={({ collapsed }) => (
                  <Link to="/" style={{ display: "inline-flex" }}>
                    <img
                      src={
                        collapsed
                          ? "/src/assets/logo/logo_short.svg"
                          : "/src/assets/logo/logo.svg"
                      }
                      alt="OrionX"
                      style={{ height: collapsed ? 26 : 32 }}
                    />
                  </Link>
                )}
              >
                <Outlet />
              </ThemedLayoutV2>
            </Authenticated>
          }
        >
          <Route index element={<NavigateToResource resource="users" />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/chains" element={<ChainsPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<ErrorComponent />} />
        </Route>
      </Routes>
    </Refine>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ConfigProvider theme={theme}>
        <AppRoutes />
      </ConfigProvider>
    </BrowserRouter>
  );
};
