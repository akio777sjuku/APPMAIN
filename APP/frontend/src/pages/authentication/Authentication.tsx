import React, { useEffect, useState } from "react";
import { Form, message, Table, Space, Button, Modal, Input, Radio, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import * as API from "../../api";
import { OPENAI_MODEL, GPT_35_TURBO, GPT_35_TURBO_16K, GPT_4, GPT_4_32K } from "../../constants";
import "./style.css";
import { useMsal } from "@azure/msal-react";
interface DataType {
    key: string;
    user_id: string;
    admin: string;
    openai_model: string[];
    file_upload: string;
    created_user: string;
    created_date: string;
}
const NEW = "new";
const EDIT = "edit";
export function Component(): JSX.Element {
    const { accounts } = useMsal();
    const userName = accounts[0] && accounts[0].username;
    const [form] = Form.useForm();
    const [optionType, setOptionType] = useState(NEW);
    const [data, setData] = useState<DataType[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editUserInfoId, setEditUserInfoId] = useState("");

    const newAuth = () => {
        setOptionType(NEW);
        setIsModalOpen(true);
    };

    const editAuth = (record: DataType) => {
        setOptionType(EDIT);
        setEditUserInfoId(record.key);
        form.setFieldsValue({ user_id: record.user_id });
        form.setFieldsValue({ admin: record.admin });
        form.setFieldsValue({ openai_model: record.openai_model });
        form.setFieldsValue({ file_upload: record.file_upload });
        setIsModalOpen(true);
    };

    const deleteAuth = (id: string) => {
        API.deleteAuthentication(id)
            .then(res => {
                message.success("権限情報を削除しました。");
            })
            .catch(e => {
                message.error("権限削除を失敗しました。");
            })
            .finally(() => {
                loadUser();
            });
    };

    const handleOk = () => {
        form.validateFields().then(values => {
            form.resetFields();
            onFinish(values);
            setIsModalOpen(false);
        });
    };

    const handleCancel = () => {
        form.resetFields();
        setIsModalOpen(false);
    };

    const onFinish = (values: any) => {
        let user_info = values;
        if (optionType === NEW) {
            user_info["created_user"] = userName;
            API.createAuthentication(JSON.stringify(user_info))
                .then(res => {
                    if (res["error"]) {
                        message.error(res["error"]);
                    } else {
                        form.resetFields();
                        loadUser();
                        message.success("権限を作成しました。");
                    }
                })
                .catch(e => {
                    message.error("権限を作成失敗しました。");
                });
        }
        if (optionType === EDIT) {
            user_info["id"] = editUserInfoId;
            API.updateAuthentication(JSON.stringify(user_info))
                .then(res => {
                    form.resetFields();
                    loadUser();
                    message.success("権限を更新しました。");
                })
                .catch(e => {
                    message.error("権限を更新失敗しました。");
                });
        }
    };

    const model_options = [
        {
            label: OPENAI_MODEL[GPT_35_TURBO],
            value: GPT_35_TURBO
        },
        { label: OPENAI_MODEL[GPT_35_TURBO_16K], value: GPT_35_TURBO_16K },
        { label: OPENAI_MODEL[GPT_4], value: GPT_4 },
        { label: OPENAI_MODEL[GPT_4_32K], value: GPT_4_32K }
    ];

    const loadUser = () => {
        API.getAuthentication()
            .then(res => {
                let table_data: DataType[] = [];
                res.map(item => {
                    let tmp: DataType = {
                        key: item["id"],
                        user_id: item["user_id"],
                        admin: item["authentication"]["admin"],
                        openai_model: item["authentication"]["openai_model"],
                        file_upload: item["authentication"]["file_upload"],
                        created_user: item["created_user"],
                        created_date: item["created_date"]
                    };
                    table_data.push(tmp);
                });
                setData(table_data);
            })
            .catch(e => {
                message.error("ユーザー情報を取得失敗しました。");
            });
    };

    useEffect(() => {
        loadUser();
    }, []);

    const columns: ColumnsType<DataType> = [
        {
            title: "ユーザーID",
            dataIndex: "user_id",
            key: "user_id",

            filterMode: "tree",
            onFilter: (value, record) => record.user_id.includes(value.toString()),
            filterSearch: true
        },
        {
            title: "Admin権限",
            dataIndex: "admin",
            key: "admin",
            render: text => (text === "yes" ? "あり" : "なし")
        },
        {
            title: "アップロード権限",
            dataIndex: "file_upload",
            key: "file_upload",
            render: text => (text === "yes" ? "あり" : "なし")
        },
        {
            title: "利用可能モデル",
            dataIndex: "openai_model",
            key: "openai_model",
            render: (_, { openai_model }: DataType) => (
                <>
                    {openai_model
                        .map(model => {
                            switch (model) {
                                case GPT_35_TURBO:
                                    return OPENAI_MODEL[GPT_35_TURBO];
                                case GPT_35_TURBO_16K:
                                    return OPENAI_MODEL[GPT_35_TURBO_16K];
                                case GPT_4:
                                    return OPENAI_MODEL[GPT_4];
                                case GPT_4_32K:
                                    return OPENAI_MODEL[GPT_4_32K];
                            }
                        })
                        .join("、")}
                </>
            )
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
                        type="primary"
                        onClick={() => {
                            editAuth(record);
                        }}
                    >
                        編集
                    </Button>
                    <Button
                        onClick={() => {
                            deleteAuth(record["key"]);
                        }}
                    >
                        削除
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div className="chatContainer">
            <Button type="primary" onClick={newAuth} style={{ width: 100, marginBottom: 10 }}>
                新規権限
            </Button>
            <Table columns={columns} dataSource={data} />
            <Modal
                title={optionType === NEW ? "新規権限" : "権限編集"}
                maskClosable={false}
                open={isModalOpen}
                onOk={handleOk}
                onCancel={handleCancel}
                okText={optionType === NEW ? "作成" : "更新"}
                cancelText="キャンセル"
            >
                <Form form={form} layout="horizontal" labelWrap>
                    {optionType === NEW && (
                        <Form.Item label="対象者ID" name="user_id" rules={[{ required: true, message: "対象者IDを入力してください。" }]}>
                            <Input placeholder="対象者のログインIDを入力してください。" />
                        </Form.Item>
                    )}
                    {optionType === EDIT && (
                        <Form.Item label="対象者ID" name="user_id" rules={[{ required: true, message: "対象者IDを入力してください。" }]}>
                            <Input placeholder="対象者IDを入力してください。" disabled />
                        </Form.Item>
                    )}
                    <Form.Item label="Admin権限" name="admin" initialValue={"no"}>
                        <Radio.Group>
                            <Radio.Button value="yes">あり</Radio.Button>
                            <Radio.Button value="no">なし</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item label="アップロード権限" name="file_upload" initialValue={"no"}>
                        <Radio.Group>
                            <Radio.Button value="yes">あり</Radio.Button>
                            <Radio.Button value="no">なし</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item label="モデル権限" name="openai_model" rules={[{ required: true, message: "OpenAIモデルを選択してください。" }]}>
                        <Select mode="multiple" allowClear placeholder="OpenAIモデルを選択してください。" options={model_options} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
Component.displayName = "Authentication";
