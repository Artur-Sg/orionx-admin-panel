import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import type { TablePaginationConfig, SorterResult } from "antd/es/table/interface";
import { useGetIdentity } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "https://api.orionx.one";
const ACCESS_TOKEN_KEY = "orionx_access";

const statusOptions = ["draft", "active", "disabled", "archived"];
const visibilityOptions = ["private", "public"];

type Chain = {
    id: string;
    code: string;
    name: string;
    status: string;
    visibility: string;
    rpc_target_url: string;
    description?: string | null;
    sort_order: number;
    sync_status?: string;
    sync_error?: string | null;
};

type UserChain = {
    id: string;
    code: string;
    name: string;
    status: string;
    visibility: string;
    rpc_target_url: string;
    description?: string | null;
    quota_total: number | null;
    quota_used: number;
    access_status: string;
};

type ChainListResponse = {
    items: Chain[];
    total: number;
};

type UserChainListResponse = {
    items: UserChain[];
    total: number;
};

type PublicChain = {
    id: string;
    name: string;
    status: string;
    description?: string | null;
};

type PublicChainListResponse = {
    items: PublicChain[];
    total: number;
};

type Access = {
    id: string;
    user_id: string;
    chain_id: string;
    status: string;
    quota_total: number | null;
    quota_used: number;
    is_active: boolean;
};

type SortState = {
    field: "name" | "code" | "status" | "visibility" | "sort_order" | "created_at" | "updated_at" | null;
    order: "asc" | "desc" | null;
};

export const ChainsPage: React.FC = () => {
    const { data: identity } = useGetIdentity<{ role?: string }>();
    const isAdmin = identity?.role === "admin";

    const [loading, setLoading] = useState(false);
    const [userLoading, setUserLoading] = useState(false);
    const [items, setItems] = useState<Chain[]>([]);
    const [userItems, setUserItems] = useState<UserChain[]>([]);
    const [availableItems, setAvailableItems] = useState<PublicChain[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortState, setSortState] = useState<SortState>({ field: null, order: null });
    const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
    const [filterVisibility, setFilterVisibility] = useState<string | undefined>(undefined);

    const [editing, setEditing] = useState<Chain | null>(null);
    const [form] = Form.useForm();

    const [accessModalChain, setAccessModalChain] = useState<Chain | null>(null);
    const [accessList, setAccessList] = useState<Access[]>([]);
    const [accessLoading, setAccessLoading] = useState(false);
    const [accessForm] = Form.useForm();
    const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([]);
    const [userOptionsLoading, setUserOptionsLoading] = useState(false);

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
            if (search) params.set("search", search);
            if (sortState.field) params.set("sort_by", sortState.field);
            if (sortState.order) params.set("sort_order", sortState.order);
            if (filterStatus) params.set("status", filterStatus);
            if (filterVisibility) params.set("visibility", filterVisibility);

            const res = await fetch(`${API_URL}/admin/chains?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as ChainListResponse;
            setItems(data.items || []);
            setTotal(data.total || 0);
        } finally {
            setLoading(false);
        }
    }, [search, page, pageSize, sortState, filterStatus, filterVisibility]);

    const loadUserChains = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        setUserLoading(true);
        try {
            const res = await fetch(`${API_URL}/chains`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as UserChainListResponse;
            setUserItems(data.items || []);
            setTotal(data.total || 0);
        } finally {
            setUserLoading(false);
        }
    }, []);

    const loadAvailableChains = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/chains/available`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as PublicChainListResponse;
            setAvailableItems(data.items || []);
        } catch {
            setAvailableItems([]);
        }
    }, []);

    const loadAccess = useCallback(async (chainId: string) => {
        const token = getToken();
        if (!token) return;
        setAccessLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/chains/${chainId}/access`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as Access[];
            setAccessList(data || []);
        } finally {
            setAccessLoading(false);
        }
    }, []);

    const searchUsers = useCallback(async (query: string) => {
        const token = getToken();
        if (!token || !query.trim()) {
            setUserOptions([]);
            return;
        }
        setUserOptionsLoading(true);
        try {
            const params = new URLSearchParams({
                search: query.trim(),
                limit: "10",
                offset: "0",
            });
            const res = await fetch(`${API_URL}/users/admin/users?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json()) as { items?: { email: string }[] };
            const options =
                data.items?.map((user) => ({ label: user.email, value: user.email })) ?? [];
            setUserOptions(options);
        } finally {
            setUserOptionsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            load();
        }
    }, [isAdmin, load]);

    useEffect(() => {
        if (!isAdmin) return;
        const hasPending = items.some(
            (item) => item.sync_status === "pending" || item.sync_status === "in_progress"
        );
        if (!hasPending) return;
        const timer = window.setInterval(() => {
            load();
        }, 3000);
        return () => window.clearInterval(timer);
    }, [isAdmin, items, load]);

    useEffect(() => {
        if (!isAdmin) {
            loadUserChains();
            loadAvailableChains();
        }
    }, [isAdmin, loadUserChains, loadAvailableChains]);

    useEffect(() => {
        if (editing) {
            form.setFieldsValue(editing);
        }
    }, [editing, form]);

    const columns = [
        { title: "Name", dataIndex: "name", key: "name", sorter: true },
        { title: "Code", dataIndex: "code", key: "code", sorter: true },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            sorter: true,
            render: (value: string) => (
                <Tag color={value === "active" ? "green" : "orange"}>{value}</Tag>
            ),
        },
        {
            title: "Sync",
            dataIndex: "sync_status",
            key: "sync_status",
            render: (value: string | undefined) => {
                if (!value) return <Tag>unknown</Tag>;
                if (value === "synced") return <Tag color="green">synced</Tag>;
                if (value === "failed") return <Tag color="red">failed</Tag>;
                return <Tag color="orange">{value}</Tag>;
            },
        },
        { title: "Visibility", dataIndex: "visibility", key: "visibility", sorter: true },
        {
            title: "Gateway endpoint",
            key: "gateway_endpoint",
            render: (_: unknown, record: Chain) => `${GATEWAY_URL}/rpc/${record.code}/`,
        },
        { title: "RPC target", dataIndex: "rpc_target_url", key: "rpc_target_url" },
        {
            title: "Actions",
            key: "actions",
            render: (_: unknown, record: Chain) => (
                <Space>
                    <Button
                        type="link"
                        onClick={() => {
                            setEditing(record);
                            form.setFieldsValue(record);
                        }}
                    >
                        Edit
                    </Button>
                    <Button
                        type="link"
                        onClick={async () => {
                            setAccessModalChain(record);
                            await loadAccess(record.id);
                        }}
                    >
                        Access
                    </Button>
                    <Button
                        type="link"
                        onClick={async () => {
                            const token = getToken();
                            if (!token) return;
                            await fetch(`${API_URL}/admin/chains/${record.id}/sync`, {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            await load();
                        }}
                    >
                        Resync
                    </Button>
                    <Popconfirm
                        title="Delete chain?"
                        okText="Delete"
                        cancelText="Cancel"
                        onConfirm={async () => {
                            const token = getToken();
                            if (!token) return;
                            await fetch(`${API_URL}/admin/chains/${record.id}`, {
                                method: "DELETE",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                },
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
    ];

    if (!isAdmin) {
        return (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Card title="Your chains">
                    <Table
                        rowKey="id"
                        dataSource={userItems}
                        loading={userLoading}
                        columns={[
                            { title: "Name", dataIndex: "name", key: "name" },
                            { title: "Status", dataIndex: "access_status", key: "access_status" },
                            {
                                title: "Endpoint",
                                key: "endpoint",
                                render: (_: unknown, record: UserChain) =>
                                    `${GATEWAY_URL}/rpc/${record.code}/`,
                            },
                            {
                                title: "Quota",
                                dataIndex: "quota_total",
                                key: "quota_total",
                                render: (value: number | null) => (value ?? "Unlimited"),
                            },
                            {
                                title: "Used",
                                dataIndex: "quota_used",
                                key: "quota_used",
                            },
                            {
                                title: "Available",
                                key: "quota_available",
                                render: (_: unknown, record: UserChain) =>
                                    record.quota_total == null
                                        ? "Unlimited"
                                        : Math.max(record.quota_total - record.quota_used, 0),
                            },
                        ]}
                        pagination={false}
                    />
                    {userItems.length === 0 && !userLoading && (
                        <Typography.Text type="secondary">
                            No chains assigned to your account yet.
                        </Typography.Text>
                    )}
                    <Typography.Text type="secondary">
                        API key required. Contact info@orionx.one or Telegram @OrionXone.
                    </Typography.Text>
                </Card>

                <Card title="Available chains">
                    <Table
                        rowKey="id"
                        dataSource={availableItems}
                        columns={[
                            { title: "Name", dataIndex: "name", key: "name" },
                            { title: "Status", dataIndex: "status", key: "status" },
                            { title: "Description", dataIndex: "description", key: "description" },
                        ]}
                        pagination={false}
                    />
                    {availableItems.length === 0 && (
                        <Typography.Text type="secondary">
                            No public chains available right now.
                        </Typography.Text>
                    )}
                    <Typography.Text type="secondary">
                        To request access or increase quota, contact info@orionx.one or
                        Telegram @OrionXone.
                    </Typography.Text>
                </Card>
            </Space>
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card title="Chains">
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Space wrap>
                        <Input.Search
                            placeholder="Search by name or code"
                            allowClear
                            onSearch={(value) => {
                                setPage(1);
                                setSearch(value.trim());
                            }}
                        />
                        <Select
                            placeholder="Status"
                            allowClear
                            style={{ width: 160 }}
                            value={filterStatus}
                            onChange={(value) => {
                                setPage(1);
                                setFilterStatus(value);
                            }}
                            options={statusOptions.map((s) => ({ value: s }))}
                        />
                        <Select
                            placeholder="Visibility"
                            allowClear
                            style={{ width: 160 }}
                            value={filterVisibility}
                            onChange={(value) => {
                                setPage(1);
                                setFilterVisibility(value);
                            }}
                            options={visibilityOptions.map((s) => ({ value: s }))}
                        />
                        <Button
                            type="primary"
                            onClick={() => {
                                const defaults = {
                                    id: "",
                                    code: "",
                                    name: "",
                                    status: "draft",
                                    visibility: "private",
                                    rpc_target_url: "",
                                    description: "",
                                    sort_order: 0,
                                };
                                form.resetFields();
                                form.setFieldsValue(defaults);
                                setEditing(defaults);
                            }}
                        >
                            New chain
                        </Button>
                    </Space>
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={items}
                        loading={loading}
                        pagination={{
                            current: page,
                            pageSize,
                            total,
                            showSizeChanger: true,
                            pageSizeOptions: ["10", "20", "50", "100"],
                            locale: { items_per_page: "" },
                            onChange: (p, size) => {
                                setPage(p);
                                if (size) setPageSize(size);
                            },
                        }}
                        onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
                            const sort = sorter as SorterResult<Chain>;
                            if (!sort.order) {
                                setSortState({ field: null, order: null });
                                return;
                            }
                            setSortState({
                                field: (sort.field as SortState["field"]) ?? null,
                                order: sort.order === "ascend" ? "asc" : "desc",
                            });
                        }}
                    />
                    <Typography.Text type="secondary">Total: {total}</Typography.Text>
                </Space>
            </Card>

            <Modal
                title={editing?.id ? "Edit chain" : "New chain"}
                open={!!editing}
                onCancel={() => setEditing(null)}
                okText={editing?.id ? "Save" : "Add chain"}
                onOk={async () => {
                    const token = getToken();
                    if (!token) return;
                    const values = await form.validateFields();
                    const isNew = !editing?.id;
                    const url = isNew
                        ? `${API_URL}/admin/chains`
                        : `${API_URL}/admin/chains/${editing?.id}`;
                    const method = isNew ? "POST" : "PUT";
                    await fetch(url, {
                        method,
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(values),
                    });
                    setEditing(null);
                    await load();
                }}
            >
                <Form layout="vertical" form={form} initialValues={editing ?? {}}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                        <Input disabled={!!editing?.id} />
                    </Form.Item>
                    <Form.Item name="rpc_target_url" label="RPC target" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                        <Select options={statusOptions.map((s) => ({ value: s }))} />
                    </Form.Item>
                    <Form.Item name="visibility" label="Visibility" rules={[{ required: true }]}>
                        <Select options={visibilityOptions.map((s) => ({ value: s }))} />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={accessModalChain ? `Access: ${accessModalChain.name}` : "Access"}
                open={!!accessModalChain}
                onCancel={() => {
                    setAccessModalChain(null);
                    setAccessList([]);
                    accessForm.resetFields();
                    setUserOptions([]);
                }}
                onOk={async () => {
                    const token = getToken();
                    if (!token || !accessModalChain) return;
                    const values = await accessForm.validateFields();
                    await fetch(`${API_URL}/admin/access/by-email`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            ...values,
                            chain_id: accessModalChain.id,
                        }),
                    });
                    await loadAccess(accessModalChain.id);
                    accessForm.resetFields();
                }}
            >
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Form layout="vertical" form={accessForm}>
                        <Form.Item name="email" label="User email" rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder="Search by email"
                                filterOption={false}
                                onSearch={searchUsers}
                                options={userOptions}
                                loading={userOptionsLoading}
                                notFoundContent={userOptionsLoading ? "Loading..." : "No users found"}
                            />
                        </Form.Item>
                        <Form.Item name="quota_total" label="Quota total">
                            <Input type="number" />
                        </Form.Item>
                    </Form>
                    <Table
                        rowKey="id"
                        dataSource={accessList}
                        loading={accessLoading}
                        columns={[
                            { title: "User", dataIndex: "user_id", key: "user_id" },
                            { title: "Status", dataIndex: "status", key: "status" },
                            { title: "Quota", dataIndex: "quota_total", key: "quota_total" },
                            { title: "Used", dataIndex: "quota_used", key: "quota_used" },
                        ]}
                        pagination={false}
                    />
                </Space>
            </Modal>
        </Space>
    );
};
