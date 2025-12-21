import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layout, Space, Typography } from "antd";
import { ThemedTitleV2 } from "@refinedev/antd";
import { useLogin } from "@refinedev/core";

type CredentialResponse = {
  credential?: string;
};

export const LoginPage: React.FC = () => {
  const { mutate: login, isLoading } = useLogin<CredentialResponse>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const clientId = useMemo(
    () => import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
    [],
  );

  useEffect(() => {
    if (!clientId) {
      setErrorMessage("Не задан Google Client ID.");
      return;
    }

    const initGoogle = () => {
      if (!divRef.current || !window.google?.accounts?.id) {
        return false;
      }

      try {
        window.google.accounts.id.initialize({
          ux_mode: "popup",
          client_id: clientId,
          callback: (res: CredentialResponse) => {
            if (res.credential) {
              setErrorMessage(null);
              login(res);
            }
          },
        });
        window.google.accounts.id.renderButton(divRef.current, {
          theme: "filled_blue",
          size: "large",
          type: "standard",
        });
        return true;
      } catch (error) {
        setErrorMessage("Google авторизация не удалась. Попробуйте еще раз.");
        console.error(error);
        return false;
      }
    };

    if (initGoogle()) {
      return;
    }

    const script = document.getElementById("google-identity");
    if (!script) {
      return;
    }

    const handleLoad = () => {
      initGoogle();
    };

    script.addEventListener("load", handleLoad);

    return () => {
      script.removeEventListener("load", handleLoad);
    };
  }, [clientId, login]);

  return (
    <Layout
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #f6f1ea 0%, #e9f2ff 50%, #fef3dc 100%)",
      }}
    >
      <Space direction="vertical" align="center" size="large">
        <ThemedTitleV2
          collapsed={false}
          wrapperStyles={{
            fontSize: "22px",
          }}
        />
        <div ref={divRef} />
        {isLoading && (
          <Typography.Text type="secondary">
            Вход в процессе...
          </Typography.Text>
        )}
        {errorMessage ? (
          <Typography.Text type="danger">{errorMessage}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            Powered by Google
          </Typography.Text>
        )}
      </Space>
    </Layout>
  );
};
