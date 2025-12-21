import React from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Outlet,
  Navigate,
} from "react-router-dom";
import {
  ThemedLayoutV2,
  ThemedTitleV2,
  ErrorComponent,
  notificationProvider,
  RefineThemes,
} from "@refinedev/antd";
import routerProvider, {
  NavigateToResource,
} from "@refinedev/react-router-v6";
import { Authenticated, Refine } from "@refinedev/core";
import { ConfigProvider } from "antd";
import dataProvider from "@refinedev/simple-rest";

import { PostsList } from "./pages/posts/list";
import { PostsCreate } from "./pages/posts/create";
import { PostsEdit } from "./pages/posts/edit";
import { PostsShow } from "./pages/posts/show";
import { LoginPage } from "./pages/login";
import { authProvider } from "./authProvider";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue}>
        <Refine
          dataProvider={dataProvider("https://api.fake-rest.refine.dev")}
          authProvider={authProvider}
          notificationProvider={notificationProvider}
          routerProvider={routerProvider}
          resources={[
            {
              name: "posts",
              list: "/posts",
              create: "/posts/create",
              edit: "/posts/edit/:id",
              show: "/posts/show/:id",
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <Authenticated
                  key="authenticated"
                  fallback={<Navigate to="/login" replace />}
                >
                  <ThemedLayoutV2
                    Title={({ collapsed }) => (
                      <ThemedTitleV2
                        collapsed={collapsed}
                        text="OrionX Admin"
                      />
                    )}
                  >
                    <Outlet />
                  </ThemedLayoutV2>
                </Authenticated>
              }
            >
              <Route index element={<NavigateToResource resource="posts" />} />
              <Route path="/posts" element={<PostsList />} />
              <Route path="/posts/create" element={<PostsCreate />} />
              <Route path="/posts/edit/:id" element={<PostsEdit />} />
              <Route path="/posts/show/:id" element={<PostsShow />} />
              <Route path="*" element={<ErrorComponent />} />
            </Route>
          </Routes>
        </Refine>
      </ConfigProvider>
    </BrowserRouter>
  );
};
