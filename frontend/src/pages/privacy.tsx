import React from "react";
import { Card, Layout, Typography } from "antd";

export const PrivacyPage: React.FC = () => (
    <Layout
        style={{
            minHeight: "100vh",
            background:
                "linear-gradient(135deg, #f6f1ea 0%, #e9f2ff 50%, #fef3dc 100%)",
            padding: "40px 16px",
        }}
    >
        <Card style={{ maxWidth: 900, margin: "0 auto" }}>
            <Typography.Title level={2}>Privacy Policy</Typography.Title>
            <Typography.Paragraph>
                OrionX is the data controller for personal data processed in this application.
                We collect and process your email address, authentication identifiers, and
                basic usage logs to provide access to the admin panel.
            </Typography.Paragraph>
            <Typography.Title level={4}>What we collect</Typography.Title>
            <Typography.Paragraph>
                - Email address and account identifiers (Google OAuth).{" "}
                - Login events and access logs (IP, timestamps).
            </Typography.Paragraph>
            <Typography.Title level={4}>Why we process data</Typography.Title>
            <Typography.Paragraph>
                We process your data to authenticate you, secure the service, and provide
                access to admin functionality.
            </Typography.Paragraph>
            <Typography.Title level={4}>Legal basis</Typography.Title>
            <Typography.Paragraph>
                Processing is necessary for performance of a contract and legitimate
                interests in securing access.
            </Typography.Paragraph>
            <Typography.Title level={4}>Data sharing</Typography.Title>
            <Typography.Paragraph>
                We use Google OAuth for authentication and infrastructure providers for
                hosting. We do not sell personal data.
            </Typography.Paragraph>
            <Typography.Title level={4}>Retention</Typography.Title>
            <Typography.Paragraph>
                Data is kept while your account is active and as required for security
                and compliance.
            </Typography.Paragraph>
            <Typography.Title level={4}>Your rights</Typography.Title>
            <Typography.Paragraph>
                You can request access, correction, deletion, or restriction of your data.
                Contact us to exercise your rights.
            </Typography.Paragraph>
            <Typography.Text type="secondary">
                Contact: info@orionx.one • Telegram: @OrionXone
            </Typography.Text>
        </Card>
    </Layout>
);
