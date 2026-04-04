import React, { useState } from "react";
import { Divider } from "antd";
import { ThemedSiderV2 } from "@refinedev/antd";

import { LogoutConfirmModal } from "./LogoutConfirmModal";

type AppSiderProps = React.ComponentProps<typeof ThemedSiderV2>;

export const AppSider: React.FC<AppSiderProps> = (props) => {
    const [logoutOpen, setLogoutOpen] = useState(false);
    return (
        <ThemedSiderV2
            {...props}
            render={({ items, logout, dashboard }) => {
                const logoutItem =
                    logout && React.isValidElement(logout)
                        ? React.cloneElement(logout, {
                              danger: true,
                              style: { color: "#cf1322" },
                              onClick: () => {
                                  setLogoutOpen(true);
                              },
                          })
                        : logout;

                return (
                    <>
                        {dashboard}
                        {items}
                        {logoutItem ? <Divider style={{ margin: "8px 0" }} /> : null}
                        {logoutItem}
                        <LogoutConfirmModal
                            open={logoutOpen}
                            onCancel={() => setLogoutOpen(false)}
                            onConfirm={() => {
                                setLogoutOpen(false);
                                logout?.props?.onClick?.();
                            }}
                        />
                    </>
                );
            }}
        />
    );
};
