import React from "react";
import { Card, Layout, Typography } from "antd";

export const TermsPage: React.FC = () => (
    <Layout
        style={{
            minHeight: "100vh",
            background:
                "linear-gradient(135deg, #f6f1ea 0%, #e9f2ff 50%, #fef3dc 100%)",
            padding: "40px 16px",
        }}
    >
        <Card style={{ maxWidth: 900, margin: "0 auto" }}>
            <Typography.Title level={2}>Terms of Service</Typography.Title>
            <Typography.Paragraph>
                By accessing this admin panel, you agree to use it only for authorized
                purposes and to comply with all applicable laws.
            </Typography.Paragraph>
            <Typography.Title level={4}>Access</Typography.Title>
            <Typography.Paragraph>
                Access is granted to authorized users. You are responsible for maintaining
                the confidentiality of your credentials.
            </Typography.Paragraph>
            <Typography.Title level={4}>Acceptable use</Typography.Title>
            <Typography.Paragraph>
                You must not misuse the service, attempt unauthorized access, or disrupt
                operations.
            </Typography.Paragraph>
            <Typography.Title level={4}>Changes</Typography.Title>
            <Typography.Paragraph>
                We may update these terms from time to time. Continued use implies
                acceptance of the updated terms.
            </Typography.Paragraph>
            <Typography.Text type="secondary">
                Contact: info@orionx.one • Telegram: @OrionXone
            </Typography.Text>
        </Card>
    </Layout>
);
