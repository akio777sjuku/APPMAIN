import * as Models from "./models";

export async function askApi(options: Models.AskRequest): Promise<Models.AskResponse> {
    const response = await fetch("/ask", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            question: options.question,
            approach: options.approach,
            overrides: {
                retrieval_mode: options.overrides?.retrievalMode,
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory
            }
        })
    });

    const parsedResponse: Models.AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function chatApi(options: Models.ChatRequest): Promise<Models.AskResponse> {
    const response = await fetch("/qaanswer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            chatid: options.chat_id,
            openaimodel: options.openai_model,
            overrides: {
                retrieval_mode: options.overrides?.retrievalMode,
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                suggest_followup_questions: options.overrides?.suggestFollowupQuestions
            }
        })
    });
    const parsedResponse: Models.AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function retrieveChatApi(formData: FormData): Promise<Models.AskResponse> {
    const response = await fetch("/retrievechat", {
        method: "POST",
        body: formData
    });
    const parsedResponse: Models.AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function gptChatApi(options: Models.GptChatRequest): Promise<Models.AskResponse> {
    const response = await fetch("/gptanswer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chatid: options.chat_id,
            openaimodel: options.openai_model,
            history: options.history
        })
    });
    const parsedResponse: Models.AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export function getCitationFilePath(citation: string): string {
    return `/content/${citation}`;
}

export async function getChatList(user_name: string, chat_type: string) {
    const response = await fetch("/api/chatlist", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_name: user_name,
            chat_type: chat_type
        })
    });
    const parsedResponse: Models.ChatListResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return <Models.ChatObj[]>(<unknown>parsedResponse);
}

export async function getChatContent(chat_id: string, chat_type: string) {
    const response = await fetch("/api/chatcontent", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: chat_id,
            chat_type: chat_type
        })
    });
    const parsedResponse: Models.ChatContentResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return <Models.ChatContent[]>(<unknown>parsedResponse);
}

export async function getchat(chat_id: string) {
    const query_params = new URLSearchParams({ chat_id: chat_id });
    const response = await fetch("/api/chat?" + query_params);
    const parsedResponse: Models.ChatObj = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function chatCUD(chat_id: string, chat_type: string, user_name: string, chat_name: string, option: string) {
    const response = await fetch("/api/chat", {
        method: option,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: chat_id,
            chat_type: chat_type,
            user_name: user_name,
            chat_name: chat_name
        })
    });
    const parsedResponse: Models.ChatObj = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

// translate
export async function translatetext(translatetext: string) {
    const response = await fetch("/api/translatetext", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            translatetext: translatetext
        })
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

// proofreading
export async function proofreadingtext(proofreadingtext: string) {
    const response = await fetch("/api/proofreadingtext", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            proofreadingtext: proofreadingtext
        })
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

// EnterpriseFile
export async function uploadEnterpriseFile(formData: FormData) {
    const response = await fetch("/api/enterprisefile", {
        method: "POST",
        body: formData
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

export async function deleteEnterpriseFile(file_id: string, file_name: string) {
    const response = await fetch("/api/enterprisefile", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fileid: file_id,
            filename: file_name
        })
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

export async function searchEnterpriseFile(file_name: string, folder_id: string, tag: string, created_user: string) {
    let access_url = "/api/enterprisefile";
    const query_params = new URLSearchParams({ file_name: file_name, folder_id: folder_id, tag: tag, created_user: created_user });
    access_url += "?" + query_params;
    const response = await fetch(access_url, { method: "GET" });
    const parsedResponse: Models.FileListResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return <Models.FileInfo[]>(<unknown>parsedResponse);
}

// Login History
export async function insertUserLoginInfo(name: string | undefined, mail: string) {
    const response = await fetch("/api/userlogininfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: mail,
            user_name: name
        })
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error((await parsedResponse["error"]) || "Unknown error");
    }
    return parsedResponse;
}

export async function getUserLoginInfo(user_id: string) {
    const query_params = new URLSearchParams({ user_id: user_id });
    const response = await fetch("/api/userlogininfo?" + query_params);
    const parsedResponse: Models.UserLoginInfoResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return <Models.UserLoginInfo[]>(<unknown>parsedResponse);
}

// Folder
export async function createFolder(folder_name: string, user_name: string) {
    const response = await fetch("/api/folder", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            foldername: folder_name,
            username: user_name
        })
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

export async function getFolders() {
    const response = await fetch("/api/folder", { method: "GET" });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

// Authentication
export async function createAuthentication(authData: string) {
    const response = await fetch("api/authentication", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: authData
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

export async function updateAuthentication(authData: string) {
    const response = await fetch("api/authentication", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: authData
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}

export async function getAuthentication(user_id: string = "") {
    let access_url = "/api/authentication";
    if (user_id) {
        const query_params = new URLSearchParams({ user_id: user_id });
        access_url += "?" + query_params;
    }
    const response = await fetch(access_url, { method: "GET" });

    const parsedResponse: Models.Response<Models.Authentication> = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return <Models.Authentication[]>(<unknown>parsedResponse);
}

export async function deleteAuthentication(user_info_id: string) {
    const query_params = new URLSearchParams({ user_info_id: user_info_id });
    const response = await fetch("/api/authentication?" + query_params, { method: "DELETE" });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse["error"] || "Unknown error");
    }
    return parsedResponse;
}
