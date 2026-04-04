import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Modal, Space, Table, Tag, Typography, Switch, Select } from "antd";
import { useGetIdentity } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const ACCESS_TOKEN_KEY = "orionx_access";

type AdminUser = {
  id: string;
  email: string;
  is_active: boolean;
  role: string;
};

type AdminUserListResponse = {
  items: AdminUser[];
  total: number;
};

export const UsersPage: React.FC = () => {
  const { data: identity } = useGetIdentity<{ role?: string }>();
  const isAdmin = identity?.role === "admin";

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const getToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (search) {
        params.set("search", search);
      }
      const res = await fetch(`${API_URL}/users/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as AdminUserListResponse;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    if (isAdmin) {
      load();
    }
  }, [isAdmin, load]);

  const columns = [
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "admin" ? "purple" : "blue"}>{role}</Tag>
      ),
    },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) => (active ? "yes" : "no"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: AdminUser) => (
        <Button
          type="link"
          onClick={() => {
            setEditing(record);
            setEditEmail(record.email);
            setEditRole(record.role);
            setEditActive(record.is_active);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Card title="Users" style={{ maxWidth: 640 }}>
        <Typography.Text type="secondary">
          You do not have access to this section.
        </Typography.Text>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="Users">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Input.Search
            placeholder="Search by email"
            allowClear
            onSearch={(value) => {
              setPage(1);
              setSearch(value.trim());
            }}
          />
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (p, size) => {
                setPage(p);
                if (size) setPageSize(size);
              },
            }}
          />
        </Space>
      </Card>

      <Modal
        title="Edit user"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={async () => {
          const token = getToken();
          if (!editing || !token) return;
          setSaving(true);
          try {
            const res = await fetch(`${API_URL}/users/admin/users/${editing.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                email: editEmail,
                role: editRole,
                is_active: editActive,
              }),
            });
            if (res.ok) {
              setEditing(null);
              await load();
            }
          } finally {
            setSaving(false);
          }
        }}
        okButtonProps={{ loading: saving }}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Input
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="Email"
          />
          <Select value={editRole} onChange={setEditRole} style={{ width: "100%" }}>
            <Select.Option value="user">user</Select.Option>
            <Select.Option value="admin">admin</Select.Option>
          </Select>
          <Space>
            <Typography.Text>Active</Typography.Text>
            <Switch checked={editActive} onChange={setEditActive} />
          </Space>
        </Space>
      </Modal>
    </Space>
  );
};
