import React, { useEffect, useState, useRef } from "react";
import { UploadOutlined, PlusOutlined } from "@ant-design/icons";
import { Form, Input, Button, message, Upload, Space, Divider, Select } from "antd";
import type { RcFile, UploadFile, UploadProps } from "antd/es/upload/interface";
import { useMsal } from "@azure/msal-react";

import styles from "./FileUpload.module.css";
import * as API from "../../api";

const normFile = (e: any) => {
    if (Array.isArray(e)) {
        return e;
    }
    return e?.fileList;
};

export function Component(): JSX.Element {
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const { accounts } = useMsal();
    const userName = accounts[0] && accounts[0].username;

    const [items, setItems] = useState<{ [key: string]: any }[]>([]);
    const [name, setName] = useState("");

    const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setName(event.target.value);
    };

    const addItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
        e.preventDefault();
        if (!name) {
            message.info("フォルダは既に存在します。");
        } else if (items.some(e => e.value === name)) {
            message.info("フォルダ名を入力してください。");
        } else {
            API.createFolder(name, userName)
                .then(res => {
                    setItems([res, ...items]);
                    setName("");
                })
                .catch(e => {
                    message.error("フォルダの作成を失敗しました。");
                });
        }
    };

    const handleUpload = (values: any) => {
        const formData = new FormData();
        formData.append("file", fileList[0] as RcFile);
        formData.append("created_user", userName);
        formData.append("folder_id", values["folder_id"] ? values["folder_id"] : "");
        formData.append("tag", values["file_tag"] ? values["file_tag"] : "");

        setUploading(true);
        API.uploadEnterpriseFile(formData)
            .then(res => {
                message.success("ファイルをアップロードしました。");
                setFileList([]);
            })
            .catch(e => {
                message.error("ファイルをアップロード失敗しました。");
            })
            .finally(() => {
                setUploading(false);
            });
    };

    const props: UploadProps = {
        onRemove: file => {
            const index = fileList.indexOf(file);
            const newFileList = fileList.slice();
            newFileList.splice(index, 1);
            setFileList(newFileList);
        },
        beforeUpload: file => {
            setFileList([file]);
            return false;
        },
        fileList,
        maxCount: 1,
        accept: ".xlsx, .pdf, .csv, .txt, .docx"
    };

    useEffect(() => {
        API.getFolders().then(res => {
            setItems(res);
        });
    }, []);

    const filterOption = (input: string, option?: { label: string; value: string }) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase());
    return (
        <div className={styles.chatContainer}>
            <Form layout="horizontal" onFinish={handleUpload} labelCol={{ span: 4 }} wrapperCol={{ span: 14 }} style={{ width: 600 }}>
                <h3>ファイルアップロード</h3>
                <Form.Item label="操作者">{userName}</Form.Item>
                <Form.Item label="フォルダ" name="folder_id">
                    <Select
                        showSearch
                        filterOption={filterOption}
                        placeholder="フォルダを選択してください。"
                        dropdownRender={menu => (
                            <>
                                <Divider style={{ margin: "8px 0" }} />
                                <Space style={{ padding: "0 8px 4px" }}>
                                    <Input placeholder="フォルダ名" value={name} onChange={onNameChange} onKeyDown={e => e.stopPropagation()} />
                                    <Button type="text" icon={<PlusOutlined />} onClick={addItem}>
                                        新規フォルダ
                                    </Button>
                                </Space>
                                {menu}
                            </>
                        )}
                        options={items.map(item => ({ label: item.value, value: item.key }))}
                    />
                </Form.Item>
                <Form.Item label="タグ" name="file_tag">
                    <Input value={userName} />
                </Form.Item>
                <Form.Item label="ファイル" valuePropName="fileList" name="file" getValueFromEvent={normFile}>
                    <Upload {...props}>
                        <Button icon={<UploadOutlined />}>Select File</Button>
                    </Upload>
                </Form.Item>
                <Form.Item wrapperCol={{ offset: 4, span: 14 }}>
                    <Space>
                        <Button disabled={fileList.length === 0} loading={uploading} type="primary" htmlType="submit">
                            {uploading ? "アップロード中..." : "アップロード"}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
}
Component.displayName = "FileUpload";
