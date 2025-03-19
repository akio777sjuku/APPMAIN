export const enum Approaches {
    RetrieveThenRead = "rtr",
    ReadRetrieveRead = "rrr",
    ReadDecomposeAsk = "rda"
}

export const enum RetrievalMode {
    Hybrid = "hybrid",
    Vectors = "vectors",
    Text = "text"
}

export type AskRequestOverrides = {
    retrievalMode?: RetrievalMode;
    semanticRanker?: boolean;
    semanticCaptions?: boolean;
    excludeCategory?: string;
    top?: number;
    temperature?: number;
    promptTemplate?: string;
    promptTemplatePrefix?: string;
    promptTemplateSuffix?: string;
    suggestFollowupQuestions?: boolean;
};

export type AskRequest = {
    question: string;
    approach: Approaches;
    overrides?: AskRequestOverrides;
};

export type AskResponse = {
    answer: string;
    thoughts: string | null;
    data_points: string[];
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: string;
};

export type ChatRequest = {
    chat_id: string;
    openai_model: string;
    history: ChatTurn[];
    approach: Approaches;
    overrides?: AskRequestOverrides;
};

export type RetrieveChatRequest = {
    chat_id: string;
    history: ChatTurn[];
};

export type GptChatRequest = {
    chat_id: string;
    openai_model: string;
    history: ChatTurn[];
};

export type ChatListResponse = {
    chat_List: ChatObj[];
    error?: string;
};

export type ChatObj = {
    id: string;
    chat_type: string;
    user_name: string;
    chat_name: string;
    create_date: string;
    openai_model: string;
    error?: string;
};

export type UserLoginInfoResponse = {
    file_List: UserLoginInfo[];
    error?: string;
};

export type UserLoginInfo = {
    key: string;
    user_name: string;
    user_id: string;
    login_time: string;
};

export type FileListResponse = {
    file_List: FileInfo[];
    error?: string;
};

export type FileInfo = {
    id: string;
    file_name: string;
    attributes: {
        tag: string;
        size: string;
        source: string;
    };
    file_status: string;
    folder_id: string;
    created_user: string;
    created_date: string;
    error?: string;
};

export type ChatContentResponse = {
    chatContent: ChatContent[];
    error?: string;
};

export type ChatContent = {
    chat_id: string;
    index: number;
    question: string;
    answer: string;
    thoughts: string | null;
    data_points: string[];
};

export type Authentication = {
    id: string;
    user_id: string;
    authentication: { admin: string; file_upload: string; openai_model: string[] };
    created_user: string;
    created_date: string;
};
export type Response<T> = {
    result: T[];
    error?: string;
};
