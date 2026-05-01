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
    chain_name?: string | null;
    name: string;
    key_prefix: string;
    key_last4: string;
    status: string;
    quota_total: number | null;
    quota_mode: string;
    quota_window_seconds: number | null;
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
    quota_mode: string;
    quota_window_seconds: number | null;
    quota_used: number;
    created_at: string;
};
type RevealedKey = { id: string; key: string };
type GroupMode = "none" | "user" | "chain";

type AdminUser = { id: string; email: string; role: string; is_active: boolean };
type AdminUserListResponse = { items: AdminUser[]; total: number };
type Chain = { id: string; name: string };
type ChainListResponse = { items: Chain[]; total: number };
type UserChainListResponse = { items: Chain[]; total: number };

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
    const [groupBy, setGroupBy] = useState<GroupMode>("none");
    const [search, setSearch] = useState("");
    const [filterUserId, setFilterUserId] = useState<string | undefined>(undefined);
    const [filterChainId, setFilterChainId] = useState<string | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
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

    const filteredItems = useMemo(() => {
        if (!isAdmin) return items;

        const normalized = search.trim().toLowerCase();
        return items.filter((item) => {
            if (filterUserId && item.user_id !== filterUserId) return false;
            if (filterChainId && item.chain_id !== filterChainId) return false;
            if (filterStatus && item.status !== filterStatus) return false;
            if (!normalized) return true;

            const user = (usersById.get(item.user_id) ?? item.user_id).toLowerCase();
            const chain = (chainsById.get(item.chain_id) ?? item.chain_id).toLowerCase();
            const name = item.name.toLowerCase();
            const masked = `${item.key_prefix}...${item.key_last4}`.toLowerCase();
            return (
                user.includes(normalized) ||
                chain.includes(normalized) ||
                name.includes(normalized) ||
                masked.includes(normalized)
            );
        });
    }, [isAdmin, items, search, filterUserId, filterChainId, filterStatus, usersById, chainsById]);

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

    const loadUserChainsLookup = async () => {
        const token = getToken();
        if (!token || isAdmin) return;
        const chainsRes = await fetch(`${API_URL}/chains`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const chainsData = (await chainsRes.json()) as UserChainListResponse;
        setChains(chainsData.items || []);
    };

    useEffect(() => {
        load();
    }, [isAdmin]);

    useEffect(() => {
        loadAdminLookups();
    }, [isAdmin]);

    useEffect(() => {
        loadUserChainsLookup();
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

                {isAdmin && (
                    <Space wrap>
                        <Input
                            allowClear
                            placeholder="Search by user, chain, key name"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: 320 }}
                        />
                        <Select
                            allowClear
                            placeholder="Filter by user"
                            value={filterUserId}
                            onChange={(v) => setFilterUserId(v)}
                            style={{ width: 260 }}
                            showSearch
                            optionFilterProp="label"
                            options={users.map((u) => ({
                                value: u.id,
                                label: `${u.email} (${u.role})`,
                            }))}
                        />
                        <Select
                            allowClear
                            placeholder="Filter by chain"
                            value={filterChainId}
                            onChange={(v) => setFilterChainId(v)}
                            style={{ width: 220 }}
                            showSearch
                            optionFilterProp="label"
                            options={chains.map((c) => ({ value: c.id, label: c.name }))}
                        />
                        <Select
                            allowClear
                            placeholder="Filter by status"
                            value={filterStatus}
                            onChange={(v) => setFilterStatus(v)}
                            style={{ width: 180 }}
                            options={[
                                { value: "active", label: "active" },
                                { value: "revoked", label: "revoked" },
                            ]}
                        />
                        <Select<GroupMode>
                            value={groupBy}
                            onChange={setGroupBy}
                            style={{ width: 220 }}
                            options={[
                                { value: "none", label: "No grouping" },
                                { value: "user", label: "Group by user" },
                                { value: "chain", label: "Group by chain" },
                            ]}
                        />
                    </Space>
                )}

                {(() => {
                    const columns = [
                        ...(isAdmin
                            ? [
                                  {
                                      title: "User",
                                      key: "user",
                                      render: (_: unknown, row: ApiKeyItem) =>
                                          usersById.get(row.user_id) ?? row.user_id,
                                  },
                              ]
                            : []),
                        {
                            title: "Chain",
                            key: "chain",
                            render: (_: unknown, row: ApiKeyItem) =>
                                row.chain_name ?? chainsById.get(row.chain_id) ?? row.chain_id,
                        },
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
                        {
                            title: "Reset",
                            key: "quota_mode",
                            render: (_: unknown, row: ApiKeyItem) => {
                                if (row.quota_total == null) return "N/A";
                                if (row.quota_mode === "monthly") return "Monthly";
                                if (row.quota_mode === "daily") return "Daily";
                                if (row.quota_mode === "hourly") return "Hourly";
                                if (row.quota_mode === "lifetime") return "Lifetime";
                                if (row.quota_mode === "custom") {
                                    return row.quota_window_seconds
                                        ? `Custom (${row.quota_window_seconds}s)`
                                        : "Custom";
                                }
                                return row.quota_mode;
                            },
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
                    ];

                    if (!isAdmin || groupBy === "none") {
                        return (
                            <Table
                                rowKey="id"
                                loading={loading}
                                dataSource={filteredItems}
                                columns={columns}
                                pagination={false}
                            />
                        );
                    }

                    const grouped = filteredItems.reduce<Record<string, ApiKeyItem[]>>((acc, item) => {
                        const key = groupBy === "user"
                            ? usersById.get(item.user_id) ?? item.user_id
                            : chainsById.get(item.chain_id) ?? item.chain_id;
                        acc[key] = acc[key] ?? [];
                        acc[key].push(item);
                        return acc;
                    }, {});

                    return (
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            {Object.entries(grouped).map(([title, rows]) => (
                                <Card key={title} size="small" title={title}>
                                    <Table
                                        rowKey="id"
                                        loading={loading}
                                        dataSource={rows}
                                        columns={columns}
                                        pagination={false}
                                    />
                                </Card>
                            ))}
                        </Space>
                    );
                })()}
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
                                quota_mode: values.quota_mode ?? "monthly",
                                quota_window_seconds: values.quota_window_seconds
                                    ? Number(values.quota_window_seconds)
                                    : null,
                            }),
                        });
                        const data = (await res.json()) as CreatedKey;
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
                    <Form.Item name="quota_mode" label="Quota behavior" initialValue="monthly">
                        <Select
                            options={[
                                { value: "monthly", label: "Monthly reset" },
                                { value: "daily", label: "Daily reset" },
                                { value: "hourly", label: "Hourly reset" },
                                { value: "custom", label: "Custom period" },
                                { value: "lifetime", label: "Lifetime total quota" },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item shouldUpdate={(prev, cur) => prev.quota_mode !== cur.quota_mode}>
                        {() => {
                            const mode = issueForm.getFieldValue("quota_mode");
                            if (mode !== "custom") return null;
                            return (
                                <Form.Item
                                    name="quota_window_seconds"
                                    label="Custom reset period (seconds)"
                                    rules={[{ required: true, message: "Required for custom mode" }]}
                                >
                                    <Input placeholder="e.g. 604800 (7 days)" />
                                </Form.Item>
                            );
                        }}
                    </Form.Item>
                    <Typography.Text type="secondary">
                        Set quota behavior per key. For unlimited key leave Quota empty.
                    </Typography.Text>
                </Form>
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
