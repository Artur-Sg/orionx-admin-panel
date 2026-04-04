import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Space, Tag, Typography } from "antd";
import { useGetIdentity } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type HealthResponse = {
  status: string;
  detail?: string;
};

export const HealthPage: React.FC = () => {
  const { data: identity } = useGetIdentity<{ role?: string }>();
  const isAdmin = identity?.role === "admin";
  const [loading, setLoading] = useState(false);
  const [redisData, setRedisData] = useState<HealthResponse | null>(null);
  const [apisixData, setApisixData] = useState<HealthResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [redisRes, apisixRes] = await Promise.all([
        fetch(`${API_URL}/health/redis`),
        fetch(`${API_URL}/health/apisix`),
      ]);
      const redisJson = (await redisRes.json()) as HealthResponse;
      const apisixJson = (await apisixRes.json()) as HealthResponse;
      setRedisData(redisJson);
      setApisixData(apisixJson);
    } catch (error) {
      setRedisData({ status: "error", detail: String(error) });
      setApisixData({ status: "error", detail: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      load();
    }
  }, [isAdmin, load]);

  const redisOk = redisData?.status === "ok";
  const apisixOk = apisixData?.status === "ok";

  if (!isAdmin) {
    return (
      <Card title="Service Health" style={{ maxWidth: 520 }}>
        <Typography.Text type="secondary">
          You do not have access to this section.
        </Typography.Text>
      </Card>
    );
  }

  return (
    <Card title="Service Health" style={{ maxWidth: 520 }}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Typography.Text>Redis:</Typography.Text>
          <Tag color={redisOk ? "green" : "red"}>
            {redisData?.status ?? "unknown"}
          </Tag>
        </Space>
        {redisData?.detail && (
          <Typography.Text type="secondary">{redisData.detail}</Typography.Text>
        )}
        <Space>
          <Typography.Text>APISIX:</Typography.Text>
          <Tag color={apisixOk ? "green" : "red"}>
            {apisixData?.status ?? "unknown"}
          </Tag>
        </Space>
        {apisixData?.detail && (
          <Typography.Text type="secondary">{apisixData.detail}</Typography.Text>
        )}
        <Button onClick={load} loading={loading}>
          Refresh
        </Button>
      </Space>
    </Card>
  );
};
