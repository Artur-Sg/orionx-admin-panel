import React from "react";
import { Modal } from "antd";

type LogoutConfirmModalProps = {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
    open,
    onCancel,
    onConfirm,
}) => (
    <Modal
        title="Are you sure you want to log out?"
        open={open}
        okText="Log out"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onCancel={onCancel}
        onOk={onConfirm}
    />
);
