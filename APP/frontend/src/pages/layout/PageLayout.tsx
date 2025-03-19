import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { Layout, theme } from "antd";
import { Col, Row, Button, Affix, message } from "antd";
import { Persona, PersonaSize } from "@fluentui/react/lib/Persona";

import MenuList from "../menulist/MenuList";
import LogoImage from "../../assets/cr_logo.svg";
import { loginRequest } from "../../auth/authconfig";
import * as API from "../../api";
import { CHAT_TYPE, LOCALSTORAGE_AUTH, LOCALSTORAGE_USERID, LOCALSTORAGE_USERNAME } from "../../constants";

const { Header, Content, Footer } = Layout;
export interface OutletContextType {
    reloadMenu: (type: string) => void;
}

const PageLayout: React.FC = () => {
    const {
        token: { colorBgContainer }
    } = theme.useToken();
    const { instance, accounts } = useMsal();
    const navigate = useNavigate();
    const [gptChatlist, setGptChatList] = useState<API.ChatObj[]>([]);
    const [chatList, setChatList] = useState<API.ChatObj[]>([]);
    const [retrieveChatlist, setRetrieveChatList] = useState<API.ChatObj[]>([]);

    const handleLogin = async () => {
        await instance
            .loginPopup(loginRequest)
            .then(res => {
                let user_id = res.account.username;
                API.getAuthentication(user_id).then(user_info => {
                    localStorage.setItem(LOCALSTORAGE_USERID, user_info[0][LOCALSTORAGE_USERID]);
                    localStorage.setItem(LOCALSTORAGE_USERNAME, res.account.name ? res.account.name : "");
                    localStorage.setItem(LOCALSTORAGE_AUTH, JSON.stringify(user_info[0][LOCALSTORAGE_AUTH]));
                });
                API.insertUserLoginInfo(res.account.name, res.account.username);
            })
            .catch(e => {
                message.error(e);
                return;
            });
    };

    const handleLogout = async () => {
        navigate("/");
        localStorage.clear();
        await instance.logoutPopup();
        navigate("/");
    };

    const reloadMenu = async (type: string) => {
        const userName = accounts[0] && accounts[0].username;
        if (userName) {
            let error_message = "チャットリストの取得を失敗しました。";
            try {
                let chatListResponse: API.ChatObj[];
                switch (type) {
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

    return (
        <Layout style={{ height: "100vh" }}>
            <Header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    background: "#dbdbdb"
                }}
            >
                <Row style={{ height: 64, width: "100%" }} justify="space-between">
                    <Col span={6} style={{ height: 64 }}>
                        <NavLink style={{ height: 64 }} to={"/"}>
                            <img style={{ height: 64 }} src={LogoImage} alt="CRI_logo" />
                        </NavLink>
                    </Col>
                    <Col span={6} style={{ height: 64 }}>
                        <h3 style={{ margin: 0, height: 64 }}>GPT + Enterprise data</h3>
                    </Col>
                    <Col span={6} style={{ height: 64 }}>
                        <Row style={{ height: 64 }} align="middle" justify="end">
                            {accounts.length > 0 ? (
                                <>
                                    <Persona
                                        text={accounts[0] && accounts[0].name}
                                        secondaryText={accounts[0] && accounts[0].username}
                                        size={PersonaSize.size32}
                                    />
                                    <Button type="primary" onClick={handleLogout}>
                                        サインアウト
                                    </Button>
                                </>
                            ) : (
                                <Button type="primary" onClick={handleLogin}>
                                    サインイン
                                </Button>
                            )}
                        </Row>
                    </Col>
                </Row>
            </Header>
            <Layout hasSider>
                {accounts.length > 0 && (
                    <MenuList
                        gptChatlist={gptChatlist}
                        chatList={chatList}
                        retrieveChatlist={retrieveChatlist}
                        setGptChatList={setGptChatList}
                        setChatList={setChatList}
                        setRetrieveChatList={setRetrieveChatList}
                    />
                )}
                <Layout className="site-layout" style={{ marginLeft: accounts.length > 0 ? 250 : undefined }}>
                    <Content style={{ margin: "24px 16px 0", overflow: "auto" }}>
                        <Outlet context={{ reloadMenu }} />
                    </Content>
                    <Affix offsetBottom={0}>
                        <Footer style={{ textAlign: "center", height: 20, padding: 5 }}>© CREEK & RIVER Co., Ltd.</Footer>
                    </Affix>
                </Layout>
            </Layout>
        </Layout>
    );
};

export default PageLayout;
