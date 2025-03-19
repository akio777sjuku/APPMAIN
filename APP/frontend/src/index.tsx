import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { initializeIcons } from "@fluentui/react";
import { PublicClientApplication } from "@azure/msal-browser";

import "./index.css";

import PageLayout from "./pages/layout/PageLayout";
import { msalConfig } from "./auth/authconfig";
import { ChatEmpty } from "./components/ChatEmpty";
import AuthGuard from "./auth/authGuard";

initializeIcons();
const msalInstance = new PublicClientApplication(msalConfig);
const router = createBrowserRouter([
    {
        path: "/",
        element: <PageLayout />,
        children: [
            {
                index: true,
                element: <ChatEmpty />
            },
            {
                path: "retrievechat/:chatid",
                lazy: () => import("./pages/retrievechat/RetrieveChat")
            },
            {
                path: "chat/:chatid",
                lazy: () => import("./pages/chat/Chat")
            },
            {
                path: "gptchat/:chatid",
                lazy: () => import("./pages/gptchat/GptChat")
            },
            {
                path: "fileupload",
                lazy: () => import("./pages/fileupload/FileUpload")
            },
            {
                path: "filelist",
                lazy: () => import("./pages/filelist/FileList")
            },
            {
                path: "logininfolist",
                lazy: () => import("./pages/userinfolist/UserInfoList")
            },
            {
                path: "translationchat",
                lazy: () => import("./pages/translationchat/TranslationChat")
            },
            {
                path: "proofreadingchat",
                lazy: () => import("./pages/proofreadingchat/ProofreadingChat")
            },
            {
                path: "authentication",
                lazy: () => import("./pages/authentication/Authentication")
            }
        ]
    }
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <MsalProvider instance={msalInstance}>
            <RouterProvider router={router} />
        </MsalProvider>
    </React.StrictMode>
);
