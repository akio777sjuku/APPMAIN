import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { Layout, Menu, Button, message, Row, Modal, Input } from "antd";
import { PlusCircleOutlined, CommentOutlined, EditTwoTone, DeleteTwoTone, UploadOutlined, FileSearchOutlined } from "@ant-design/icons";

import * as API from "../../api";
import { CHAT_TYPE, MENU_TYPE, LOCALSTORAGE_AUTH } from "../../constants";
import "./style.css";
interface MenuListProps {
    gptChatlist: API.ChatObj[];
    chatList: API.ChatObj[];
    retrieveChatlist: API.ChatObj[];
    setGptChatList: React.Dispatch<React.SetStateAction<API.ChatObj[]>>;
    setChatList: React.Dispatch<React.SetStateAction<API.ChatObj[]>>;
    setRetrieveChatList: React.Dispatch<React.SetStateAction<API.ChatObj[]>>;
}
const { SubMenu } = Menu;

const MenuList: React.FC<MenuListProps> = props => {
    const { gptChatlist, setGptChatList, chatList, setChatList, retrieveChatlist, setRetrieveChatList } = props;
    const { Sider } = Layout;
    const { accounts } = useMsal();
    const navigate = useNavigate();
    const userName = accounts[0] && accounts[0].username;
    const [currentChatId, setCurrentChatId] = useState("");
    const [currentChatName, setCurrentChatName] = useState("");
    const [currentChatType, setCurrentChatType] = useState("");
    const [openEdit, setOpenEdit] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const user_auth = localStorage.getItem(LOCALSTORAGE_AUTH);

    const getMenuLists = async (chat_type: string) => {
        if (userName) {
            let error_message = "チャットリストの取得を失敗しました。";
            try {
                let chatListResponse: API.ChatObj[];
                switch (chat_type) {
                    case CHAT_TYPE.QA:
                        chatListResponse = await API.getChatList(userName, CHAT_TYPE.QA);
                        setChatList(chatListResponse);
                        error_message = "QA_" + error_message;
                        break;
                    case CHAT_TYPE.RETRIEVE:
                        chatListResponse = await API.getChatList(userName, CHAT_TYPE.RETRIEVE);
                        setRetrieveChatList(chatListResponse);
                        error_message = "情報検索_" + error_message;
                        break;
                    case CHAT_TYPE.GPT:
                        chatListResponse = await API.getChatList(userName, CHAT_TYPE.GPT);
                        setGptChatList(chatListResponse);
                        error_message = "GPT_" + error_message;
                        break;
                    default:
                        break;
                }
            } catch (error) {
                message.error(error_message);
            }
        }
    };

    const createChat = async (chat_type: string) => {
        API.chatCUD("", chat_type, userName, "新規チャット", "POST")
            .then((res: API.ChatObj) => {
                message.success("新規チャットを作成しました。");
                let to = "/";
                switch (chat_type) {
                    case CHAT_TYPE.QA:
                        setChatList([res, ...chatList]);
                        to = "chat/" + res.id;
                        break;
                    case CHAT_TYPE.RETRIEVE:
                        setRetrieveChatList([res, ...retrieveChatlist]);
                        to = "retrievechat/" + res.id;
                        break;
                    case CHAT_TYPE.GPT:
                        setGptChatList([res, ...gptChatlist]);
                        to = "gptchat/" + res.id;
                        break;
                    default:
                        break;
                }
                navigate(to);
            })
            .catch(e => {
                message.error("新規チャットの作成を失敗しました。");
            });
    };

    const deleteChat = (chat_id: string, chat_type: string) => {
        API.chatCUD(chat_id, chat_type, userName, "", "DELETE")
            .then(res => {
                getMenuLists(CHAT_TYPE.QA);
                getMenuLists(CHAT_TYPE.RETRIEVE);
                getMenuLists(CHAT_TYPE.GPT);
                message.success("チャットを削除しました。");
            })
            .catch(e => {
                message.error("チャットの削除を失敗しました。");
            })
            .finally(() => {
                navigate("/");
            });
    };

    const saveChatName = () => {
        setConfirmLoading(true);
        API.chatCUD(currentChatId, currentChatType, userName, currentChatName, "PUT")
            .then(res => {
                getMenuLists(currentChatType);
                message.success("チャット名を変更しました。");
            })
            .catch(e => {
                message.error("チャット名の変更を失敗しました。");
            })
            .finally(() => {
                setConfirmLoading(false);
                setOpenEdit(false);
            });
    };

    const openEditChatModal = (chat_id: string, chat_type: string, chat_name: string) => {
        setCurrentChatId(chat_id);
        setCurrentChatName(chat_name);
        setCurrentChatType(chat_type);
        setOpenEdit(true);
    };

    const cancelChatName = () => {
        setCurrentChatId("");
        setCurrentChatName("");
        setCurrentChatType("");
        setOpenEdit(false);
    };

    useEffect(() => {
        getMenuLists(CHAT_TYPE.QA);
        getMenuLists(CHAT_TYPE.RETRIEVE);
        getMenuLists(CHAT_TYPE.GPT);
    }, []);

    return (
        <div style={{ background: "#dbdbdb" }}>
            <Sider
                width={250}
                style={{
                    overflow: "auto",
                    height: "100vh",
                    position: "fixed",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    paddingTop: 80,
                    background: "#dbdbdb"
                }}
            >
                <Menu style={{ background: "#dbdbdb" }} mode="inline" inlineIndent={6}>
                    <SubMenu className="primary-menu-item" key={MENU_TYPE.GPT} title="GPTチャット">
                        <Row justify="center" style={{ padding: 5 }}>
                            <Button
                                type="primary"
                                icon={<PlusCircleOutlined />}
                                onClick={() => {
                                    createChat(CHAT_TYPE.GPT);
                                }}
                            >
                                新規チャット
                            </Button>
                        </Row>
                        {gptChatlist &&
                            gptChatlist.map(item => {
                                return (
                                    <Menu.Item
                                        key={item.id}
                                        className="secondary-menu-item"
                                        icon={<CommentOutlined />}
                                        onClick={() => {
                                            navigate("gptchat/" + item.id);
                                        }}
                                    >
                                        <Row justify="start" align="middle">
                                            <text style={{ width: 110, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                                {item.chat_name}
                                            </text>
                                            <Button
                                                type="link"
                                                icon={<EditTwoTone />}
                                                onClick={() => {
                                                    openEditChatModal(item.id, CHAT_TYPE.GPT, item.chat_name);
                                                }}
                                            />
                                            <Button
                                                type="link"
                                                icon={<DeleteTwoTone />}
                                                onClick={() => {
                                                    deleteChat(item.id, CHAT_TYPE.GPT);
                                                }}
                                            />
                                        </Row>
                                    </Menu.Item>
                                );
                            })}
                    </SubMenu>
                    <SubMenu className="primary-menu-item" key={MENU_TYPE.RETRIEVE} title="情報検索">
                        <Row justify="center" style={{ padding: 5 }}>
                            <Button
                                type="primary"
                                icon={<PlusCircleOutlined />}
                                onClick={() => {
                                    createChat(CHAT_TYPE.RETRIEVE);
                                }}
                            >
                                新規検索チャット
                            </Button>
                        </Row>
                        {retrieveChatlist &&
                            retrieveChatlist.map(item => {
                                return (
                                    <Menu.Item
                                        key={item.id}
                                        className="secondary-menu-item"
                                        icon={<CommentOutlined />}
                                        onClick={() => {
                                            navigate("retrievechat/" + item.id);
                                        }}
                                    >
                                        <Row justify="start" align="middle">
                                            <text style={{ width: 110, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                                {item.chat_name}
                                            </text>
                                            <Button
                                                type="link"
                                                icon={<EditTwoTone />}
                                                onClick={() => {
                                                    openEditChatModal(item.id, CHAT_TYPE.RETRIEVE, item.chat_name);
                                                }}
                                            />
                                            <Button
                                                type="link"
                                                icon={<DeleteTwoTone />}
                                                onClick={() => {
                                                    deleteChat(item.id, CHAT_TYPE.RETRIEVE);
                                                }}
                                            />
                                        </Row>
                                    </Menu.Item>
                                );
                            })}
                    </SubMenu>
                    <SubMenu className="primary-menu-item" key={MENU_TYPE.QA} title="Q&A">
                        <Row justify="center" style={{ padding: 5 }}>
                            <Button
                                type="primary"
                                icon={<PlusCircleOutlined />}
                                onClick={() => {
                                    createChat(CHAT_TYPE.QA);
                                }}
                            >
                                新規Q&Aチャット
                            </Button>
                        </Row>
                        {chatList &&
                            chatList.map(item => {
                                return (
                                    <Menu.Item
                                        key={item.id}
                                        className="secondary-menu-item"
                                        icon={<CommentOutlined />}
                                        onClick={() => {
                                            navigate("chat/" + item.id);
                                        }}
                                    >
                                        <Row justify="start" align="middle">
                                            <text style={{ width: 110, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                                {item.chat_name}
                                            </text>
                                            <Button
                                                type="link"
                                                icon={<EditTwoTone />}
                                                onClick={() => {
                                                    openEditChatModal(item.id, CHAT_TYPE.QA, item.chat_name);
                                                }}
                                            />
                                            <Button
                                                type="link"
                                                icon={<DeleteTwoTone />}
                                                onClick={() => {
                                                    deleteChat(item.id, CHAT_TYPE.QA);
                                                }}
                                            />
                                        </Row>
                                    </Menu.Item>
                                );
                            })}
                    </SubMenu>
                    <Menu.Item className="primary-menu-item" key={MENU_TYPE.PROCEEDINGS} disabled>
                        議事録作成
                    </Menu.Item>
                    <Menu.Item
                        className="primary-menu-item"
                        key={MENU_TYPE.TRANSLATION}
                        onClick={() => {
                            navigate("translationchat");
                        }}
                    >
                        翻訳
                    </Menu.Item>
                    <Menu.Item
                        className="primary-menu-item"
                        key={MENU_TYPE.PROOFREADING}
                        onClick={() => {
                            navigate("proofreadingchat");
                        }}
                    >
                        文書校正
                    </Menu.Item>
                    <SubMenu className="primary-menu-item" key={MENU_TYPE.FILEMANAGEMENT} title="ファイル管理">
                        {user_auth && JSON.parse(user_auth)["file_upload"] === "yes" && (
                            <Menu.Item
                                className="secondary-menu-item"
                                key={"qa_file_upload"}
                                icon={<UploadOutlined />}
                                onClick={() => {
                                    navigate("fileupload");
                                }}
                            >
                                アップロード
                            </Menu.Item>
                        )}
                        <Menu.Item
                            className="secondary-menu-item"
                            key={"qa_file_list"}
                            icon={<FileSearchOutlined />}
                            onClick={() => {
                                navigate("filelist");
                            }}
                        >
                            ファイル一覧
                        </Menu.Item>
                    </SubMenu>
                    <SubMenu className="primary-menu-item" key={MENU_TYPE.USERINFO} title="ユーザー情報">
                        <Menu.Item
                            className="secondary-menu-item"
                            key={"login_history_list"}
                            onClick={() => {
                                navigate("logininfolist");
                            }}
                        >
                            ログイン履歴一覧
                        </Menu.Item>
                    </SubMenu>
                    {user_auth && JSON.parse(user_auth)["admin"] === "yes" && (
                        <Menu.Item
                            className="primary-menu-item"
                            key={MENU_TYPE.AUTHMANAGEMENT}
                            onClick={() => {
                                navigate("authentication");
                            }}
                        >
                            権限管理
                        </Menu.Item>
                    )}
                </Menu>
            </Sider>

            <Modal title="チャット名変更" open={openEdit} onOk={saveChatName} confirmLoading={confirmLoading} onCancel={cancelChatName}>
                <Input
                    value={currentChatName}
                    allowClear={true}
                    onChange={e => {
                        setCurrentChatName(e.target.value);
                    }}
                />
            </Modal>
        </div>
    );
};
export default MenuList;
