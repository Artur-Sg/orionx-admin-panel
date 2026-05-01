import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const ACCESS_TOKEN_KEY = "orionx_access";

type ApiKeyItem = {
    id: string;
    user_id: string;
    chain_id: string;
    name: string;
    key_prefix: string;
    key_last4: string;
    status: string;
    quota_total: number | null;
    quota_used: number;
    created_at: string;
    revoked_at: string | null;
};

type CreatedKey = {
    id: string;
    name: string;
    key: string;
    key_prefix: string;
    key_last4: string;
    status: string;
    user_id: string;
    chain_id: string;
    quota_total: number | null;
    quota_used: number;
    created_at: string;
};
type RevealedKey = { id: string; key: string };

type AdminUser = { id: string; email: string; role: string; is_active: boolean };
type AdminUserListResponse = { items: AdminUser[]; total: number };
type Chain = { id: string; name: string };
type ChainListResponse = { items: Chain[]; total: number };

export const ApiKeysPage: React.FC = () => {
    const { data: identity } = useGetIdentity<{ role?: string }>();
    const isAdmin = identity?.role === "admin";

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<ApiKeyItem[]>([]);

    const [users, setUsers] = useState<AdminUser[]>([]);
    const [chains, setChains] = useState<Chain[]>([]);
    const [name, setName] = useState("Default key");
    const [quotaTotal, setQuotaTotal] = useState<string>("");
    const [issueModalOpen, setIssueModalOpen] = useState(false);
    const [issueForm] = Form.useForm();
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [newKeyCopied, setNewKeyCopied] = useState(false);
    const [revealModalOpen, setRevealModalOpen] = useState(false);
    const [revealedKey, setRevealedKey] = useState<string | null>(null);

    const getToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

    const usersById = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach((u) => map.set(u.id, u.email));
        return map;
    }, [users]);

    const chainsById = useMemo(() => {
        const map = new Map<string, string>();
        chains.forEach((c) => map.set(c.id, c.name));
        return map;
    }, [chains]);

    const load = async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const endpoint = isAdmin ? "/admin/api-keys" : "/api-keys/me";
            const res = await fetch(`${API_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as ApiKeyItem[];
            setItems(data || []);
        } finally {
            setLoading(false);
        }
    };

    const loadAdminLookups = async () => {
        const token = getToken();
        if (!token || !isAdmin) return;
        const usersRes = await fetch(`${API_URL}/users/admin/users?limit=200&offset=0`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const usersData = (await usersRes.json()) as AdminUserListResponse;
        setUsers(usersData.items || []);

        const chainsRes = await fetch(`${API_URL}/admin/chains?limit=200&offset=0`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const chainsData = (await chainsRes.json()) as ChainListResponse;
        setChains(chainsData.items || []);
    };

    useEffect(() => {
        load();
    }, [isAdmin]);

    useEffect(() => {
        loadAdminLookups();
    }, [isAdmin]);

    return (
        <Card title={isAdmin ? "API Keys (Admin)" : "My API Keys"}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {isAdmin && (
                    <Space wrap>
                        <Button
                            type="primary"
                            onClick={() => setIssueModalOpen(true)}
                        >
                            Issue key
                        </Button>
                    </Space>
                )}

                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={items}
                    columns={[
                        ...(isAdmin
                            ? [
                                  {
                                      title: "User",
                                      key: "user",
                                      render: (_: unknown, row: ApiKeyItem) =>
                                          usersById.get(row.user_id) ?? row.user_id,
                                  },
                                  {
                                      title: "Chain",
                                      key: "chain",
                                      render: (_: unknown, row: ApiKeyItem) =>
                                          chainsById.get(row.chain_id) ?? row.chain_id,
                                  },
                              ]
                            : []),
                        { title: "Name", dataIndex: "name", key: "name" },
                        {
                            title: "Key",
                            key: "masked",
                            render: (_: unknown, row: ApiKeyItem) =>
                                `${row.key_prefix}...${row.key_last4}`,
                        },
                        {
                            title: "Status",
                            dataIndex: "status",
                            key: "status",
                            render: (value: string) => {
                                if (value === "active") return <Tag color="green">active</Tag>;
                                if (value === "revoked") return <Tag color="red">revoked</Tag>;
                                return <Tag>{value}</Tag>;
                            },
                        },
                        {
                            title: "Quota",
                            key: "quota",
                            render: (_: unknown, row: ApiKeyItem) =>
                                row.quota_total == null ? "Unlimited" : row.quota_total,
                        },
                        { title: "Used", dataIndex: "quota_used", key: "quota_used" },
                        {
                            title: "Remaining",
                            key: "remaining",
                            render: (_: unknown, row: ApiKeyItem) =>
                                row.quota_total == null
                                    ? "Unlimited"
                                    : Math.max(row.quota_total - row.quota_used, 0),
                        },
                        ...(isAdmin
                            ? [
                                  {
                                      title: "Actions",
                                      key: "actions",
                                      render: (_: unknown, row: ApiKeyItem) => (
                                          <Space>
                                              <Button
                                                  type="link"
                                                  danger
                                                  disabled={row.status !== "active"}
                                                  onClick={async () => {
                                                      const token = getToken();
                                                      if (!token) return;
                                                      await fetch(`${API_URL}/admin/api-keys/${row.id}/revoke`, {
                                                          method: "POST",
                                                          headers: { Authorization: `Bearer ${token}` },
                                                      });
                                                      await load();
                                                  }}
                                              >
                                                  Revoke
                                              </Button>
                                              <Popconfirm
                                                  title="Delete API key?"
                                                  description="This will permanently remove this key."
                                                  okText="Delete"
                                                  cancelText="Cancel"
                                                  okButtonProps={{ danger: true }}
                                                  onConfirm={async () => {
                                                      const token = getToken();
                                                      if (!token) return;
                                                      await fetch(`${API_URL}/admin/api-keys/${row.id}`, {
                                                          method: "DELETE",
                                                          headers: { Authorization: `Bearer ${token}` },
                                                      });
                                                      await load();
                                                  }}
                                              >
                                                  <Button type="link" danger>
                                                      Delete
                                                  </Button>
                                              </Popconfirm>
                                          </Space>
                                      ),
                                  },
                              ]
                            : [
                                  {
                                      title: "Actions",
                                      key: "actions",
                                      render: (_: unknown, row: ApiKeyItem) => (
                                          <Button
                                              type="link"
                                              icon={<EyeOutlined />}
                                              onClick={async () => {
                                                  const token = getToken();
                                                  if (!token) return;
                                                  const res = await fetch(
                                                      `${API_URL}/api-keys/me/${row.id}/reveal`,
                                                      {
                                                          headers: {
                                                              Authorization: `Bearer ${token}`,
                                                          },
                                                      }
                                                  );
                                                  if (!res.ok) {
                                                      setRevealedKey("Unable to reveal this key.");
                                                      setRevealModalOpen(true);
                                                      return;
                                                  }
                                                  const data = (await res.json()) as RevealedKey;
                                                  setRevealedKey(data.key);
                                                  setRevealModalOpen(true);
                                              }}
                                          >
                                              Show
                                          </Button>
                                      ),
                                  },
                              ]),
                    ]}
                    pagination={false}
                />
            </Space>

            <Modal
                title="Issue API key"
                open={issueModalOpen}
                onCancel={() => setIssueModalOpen(false)}
                okText="Issue key"
                okButtonProps={{ loading: creating }}
                onOk={async () => {
                    const values = await issueForm.validateFields();
                    const token = getToken();
                    if (!token) return;
                    setCreating(true);
                    try {
                        const res = await fetch(`${API_URL}/admin/api-keys`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                name: values.name,
                                user_id: values.user_id,
                                chain_id: values.chain_id,
                                quota_total: values.quota_total ? Number(values.quota_total) : null,
                            }),
                        });
                        const data = (await res.json()) as CreatedKey;
                        setNewKey(data.key);
                        setNewKeyCopied(false);
                        setIssueModalOpen(false);
                        issueForm.resetFields();
                        await load();
                    } finally {
                        setCreating(false);
                    }
                }}
            >
                <Form
                    form={issueForm}
                    layout="vertical"
                    initialValues={{
                        name,
                        quota_total: quotaTotal,
                    }}
                >
                    <Form.Item name="user_id" label="User" rules={[{ required: true }]}>
                        <Select
                            showSearch
                            placeholder="Select user"
                            optionFilterProp="label"
                            options={users.map((u) => ({
                                value: u.id,
                                label: `${u.email} (${u.role})`,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item name="chain_id" label="Chain" rules={[{ required: true }]}>
                        <Select
                            showSearch
                            placeholder="Select chain"
                            optionFilterProp="label"
                            options={chains.map((c) => ({ value: c.id, label: c.name }))}
                        />
                    </Form.Item>
                    <Form.Item name="name" label="Key name" rules={[{ required: true }]}>
                        <Input placeholder="Key name" />
                    </Form.Item>
                    <Form.Item name="quota_total" label="Quota (optional)">
                        <Input placeholder="e.g. 10000" />
                    </Form.Item>
                    <Typography.Text type="secondary">
                        Selected user must have chain access configured. API key is shown once.
                    </Typography.Text>
                </Form>
            </Modal>

            <Modal
                title="New API key"
                open={!!newKey}
                closable={newKeyCopied}
                maskClosable={false}
                keyboard={false}
                onCancel={() => {
                    if (!newKeyCopied) return;
                    setNewKey(null);
                    setNewKeyCopied(false);
                }}
                onOk={() => {
                    setNewKey(null);
                    setNewKeyCopied(false);
                }}
                okText="Close"
                okButtonProps={{ disabled: !newKeyCopied }}
                cancelButtonProps={{ style: { display: "none" } }}
            >
                <Typography.Text
                    copyable={{
                        text: newKey ?? "",
                        onCopy: () => setNewKeyCopied(true),
                    }}
                >
                    {newKey}
                </Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                    Copy this key now. Close will be enabled after copying.
                </Typography.Paragraph>
            </Modal>

            <Modal
                title="API key"
                open={revealModalOpen}
                onCancel={() => {
                    setRevealModalOpen(false);
                    setRevealedKey(null);
                }}
                onOk={() => {
                    setRevealModalOpen(false);
                    setRevealedKey(null);
                }}
                okText="Close"
                cancelButtonProps={{ style: { display: "none" } }}
            >
                <Typography.Text copyable={revealedKey ? { text: revealedKey } : undefined}>
                    {revealedKey}
                </Typography.Text>
            </Modal>
        </Card>
    );
};
