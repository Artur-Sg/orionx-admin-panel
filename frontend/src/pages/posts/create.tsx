import React from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const PostsCreate: React.FC = () => {
  const { formProps, saveButtonProps } = useForm();

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Title" name="title" rules={[{ required: true }]}>
          <Input placeholder="Post title" />
        </Form.Item>
        <Form.Item label="Status" name="status">
          <Input placeholder="draft | published" />
        </Form.Item>
      </Form>
    </Create>
  );
};
