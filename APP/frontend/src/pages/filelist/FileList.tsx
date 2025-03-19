import React, { useEffect, useState } from "react";
import { Space, Table, message, Button, Form, Row, Select, Input, theme, Divider } from "antd";
import type { ColumnsType } from "antd/es/table";
import styles from "./FileList.module.css";
import * as API from "../../api/";

interface DataType {
    key: string;
    file_id: string;
    file_name: string;
    size: string;
    source: string;
    tag: string;
    file_status: string;
    folder_id: string;
    folder_name: string;
    created_user: string;
    created_date: string;
}

export function Component(): JSX.Element {
    const [data, setData] = useState<DataType[]>([]);
    const [folders, setFolders] = useState<{ [key: string]: any }[]>([]);
    const [deleteFileId, setDeleteFileId] = useState("");
    const { token } = theme.useToken();
    const [form] = Form.useForm();

    const formStyle: React.CSSProperties = {
        maxWidth: "none",
        background: token.colorFillAlter,
        borderRadius: token.borderRadiusLG,
        padding: 12,
        marginBottom: 10
    };

    function size_convert(bite: number, decimal: number) {
        decimal = decimal ? Math.pow(10, decimal) : 10;
        let kiro = 1024;
        let size = bite;
        let unit = "B";
        let units = ["B", "KB", "MB", "GB", "TB"];
        for (var i = units.length - 1; i > 0; i--) {
            if (bite / Math.pow(kiro, i) > 1) {
                size = Math.round((bite / Math.pow(kiro, i)) * decimal) / decimal;
                unit = units[i];
                break;
            }
        }
        return String(size) + " " + unit;
    }

    const edit_enterprise_file = (file_info: DataType) => {};

    const delete_enterprise_file = (file_id: string, file_name: string) => {
        setDeleteFileId(file_id);
        API.deleteEnterpriseFile(file_id, file_name)
            .then(res => {
                message.success("ファイルを削除しました。");
                search_enterprise_file({});
            })
            .catch(e => {
                message.error("ファイルの削除を失敗しました。");
            })
            .finally(() => {
                setDeleteFileId("");
            });
    };

    const search_enterprise_file = async (values: any) => {
        const folder_list: { [key: string]: any }[] = await API.getFolders();
        let file_name = values["file_name"] ? values["file_name"] : "";
        let folder_id = values["folder_id"] ? values["folder_id"] : "";
        let tag = values["tag"] ? values["tag"] : "";
        let created_user = values["created_user"] ? values["created_user"] : "";
        const api_res: API.FileInfo[] = await API.searchEnterpriseFile(file_name, folder_id, tag, created_user);
        try {
            const file_list = api_res.map((item, index) => {
                let folder = folder_list.find(obj => {
                    return obj["key"] == item.folder_id;
                });
                let file_item: DataType = {
                    key: index.toString(),
                    file_id: item.id,
                    file_name: item.file_name,
                    size: size_convert(Number(item.attributes.size), 2),
                    source: item.attributes.source,
                    tag: item.attributes.tag,
                    file_status: item.file_status,
                    folder_id: item.folder_id,
                    folder_name: folder ? folder["value"] : "未分類",
                    created_user: item.created_user,
                    created_date: item.created_date
                };
                return file_item;
            });
            setData(file_list);
            setFolders([{ key: " ", value: "未分類" }, ...folder_list]);
        } catch (e) {
            message.error("ファイルリストの取得を失敗しました。");
        }
    };

    const download_enterprise_file = async (file_id: string, file_name: string) => {
        window.location.href = "/api/downloadEnterpriseFile?file_id=" + file_id + "&file_name=" + file_name;
    };

    const columns: ColumnsType<DataType> = [
        {
            title: "ファイル名",
            dataIndex: "file_name",
            key: "file_name"
        },
        {
            title: "フォルダ名",
            dataIndex: "folder_name",
            key: "folder_name"
        },
        {
            title: "タグ",
            dataIndex: "tag",
            key: "tag"
        },
        {
            title: "サイズ",
            dataIndex: "size",
            key: "size"
        },
        {
            title: "ステータス",
            dataIndex: "file_status",
            key: "file_status"
        },
        {
            title: "作成者",
            dataIndex: "created_user",
            key: "created_user"
        },
        {
            title: "作成時間",
            dataIndex: "created_date",
            key: "created_date"
        },
        {
            title: "操作",
            key: "action",
            render: (_, record) => (
                <Space size="middle">
                    <Button
                        disabled={deleteFileId === record.file_id}
                        type="primary"
                        onClick={() => {
                            delete_enterprise_file(record.file_id, record.file_name);
                        }}
                    >
                        {deleteFileId === record.file_id ? "削除中" : "削除"}
                    </Button>
                    <Button
                        onClick={() => {
                            edit_enterprise_file(record);
                        }}
                    >
                        編集
                    </Button>
                    <Button
                        type="primary"
                        onClick={() => {
                            download_enterprise_file(record.file_id, record.file_name);
                        }}
                    >
                        ダウンロード
                    </Button>
                </Space>
            )
        }
    ];

    useEffect(() => {
        search_enterprise_file({});
    }, []);

    const filterOption = (input: string, option?: { label: string; value: string }) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase());
    return (
        <div className={styles.FileListContainer}>
            <Form style={formStyle} form={form} onFinish={search_enterprise_file}>
                <Row justify="space-around" align="middle">
                    <Form.Item name="file_name" label="ファイル名" style={{ marginBottom: 0 }}>
                        <Input placeholder="入力してください" />
                    </Form.Item>
                    <Form.Item name="folder_id" label="フォルダ名" style={{ marginBottom: 0 }}>
                        <Select
                            showSearch
                            filterOption={filterOption}
                            placeholder="選択してください"
                            style={{ width: 200 }}
                            options={folders.map(item => ({ label: item.value, value: item.key }))}
                        />
                    </Form.Item>
                    <Form.Item name="tag" label="タグ" style={{ marginBottom: 0 }}>
                        <Input placeholder="入力してください" />
                    </Form.Item>
                    <Form.Item name="created_user" label="作成者" style={{ marginBottom: 0 }}>
                        <Input placeholder="入力してください" />
                    </Form.Item>
                    <Space size="small">
                        <Button type="primary" htmlType="submit">
                            検索
                        </Button>
                        <Button
                            onClick={() => {
                                form.resetFields();
                                search_enterprise_file({});
                            }}
                        >
                            クリア
                        </Button>
                    </Space>
                </Row>
            </Form>
            <Table columns={columns} dataSource={data} />
        </div>
    );
}

Component.displayName = "FileList";
