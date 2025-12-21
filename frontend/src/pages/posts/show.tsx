import React from "react";
import { Show } from "@refinedev/antd";
import { Typography } from "antd";
import { useShow } from "@refinedev/core";

export const PostsShow: React.FC = () => {
  const { queryResult } = useShow();
  const { data, isLoading } = queryResult;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Typography.Title level={5}>Title</Typography.Title>
      <Typography.Text>{record?.title}</Typography.Text>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Status
      </Typography.Title>
      <Typography.Text>{record?.status}</Typography.Text>
    </Show>
  );
};
