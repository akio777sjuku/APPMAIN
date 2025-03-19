import { useEffect, useState } from "react";
import { Table, message } from "antd";
import { useMsal } from "@azure/msal-react";
import type { ColumnsType } from "antd/es/table";
import styles from "./UserInfoList.module.css";
import * as API from "../../api";

interface DataType {
    key: string;
    user_name: string;
    user_id: string;
    login_time: string;
}

export function Component(): JSX.Element {
    const [data, setData] = useState<DataType[]>([]);
    const { accounts } = useMsal();

    const getDataList = async () => {
        try {
            const api_res: API.UserLoginInfo[] = await API.getUserLoginInfo(accounts[0].username);
            const login_info_list = api_res.map((item, index) => {
                let login_info_data: DataType = {
                    key: index.toString(),
                    user_name: item.user_name,
                    user_id: item.user_id,
                    login_time: item.login_time
                };
                return login_info_data;
            });
            setData(login_info_list);
        } catch (e) {
            message.error("ログイン履歴の取得を失敗しました。");
        }
    };

    useEffect(() => {
        getDataList();
    }, []);

    const columns: ColumnsType<DataType> = [
        {
            title: "ユーザー名",
            dataIndex: "user_name",
            key: "user_name"
        },
        {
            title: "ログインID",
            dataIndex: "user_id",
            key: "user_id"
        },
        {
            title: "ログイン時刻",
            dataIndex: "login_time",
            key: "login_time"
        }
    ];

    return (
        <div className={styles.FileListContainer}>
            <Table columns={columns} dataSource={data} />
        </div>
    );
}

Component.displayName = "UserInfoList";
