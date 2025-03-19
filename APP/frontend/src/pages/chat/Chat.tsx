import React from "react";
import { useRef, useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton, Dropdown, IDropdownOption } from "@fluentui/react";

import styles from "./Chat.module.css";
import * as API from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { ChatEmpty } from "../../components/ChatEmpty";
import { OpenaiModelRadio } from "../../components/OpenaiModelRadio";
import { OutletContextType } from "../layout/PageLayout";
import { CHAT_TYPE, GPT_35_TURBO } from "../../constants";

export function Component(): JSX.Element {
    const chat_type = CHAT_TYPE.QA;
    const params = useParams();
    const chat_id = String(params.chatid);
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [retrievalMode, setRetrievalMode] = useState<API.RetrievalMode>(API.RetrievalMode.Hybrid);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const { reloadMenu } = useOutletContext() as OutletContextType;

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: API.AskResponse][]>([]);

    const [openaiModel, setOpenaiModel] = useState<string>(GPT_35_TURBO);

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: API.ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: API.ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                approach: API.Approaches.ReadRetrieveRead,
                chat_id: chat_id,
                openai_model: openaiModel,
                overrides: {
                    promptTemplate: promptTemplate.length === 0 ? undefined : promptTemplate,
                    excludeCategory: excludeCategory.length === 0 ? undefined : excludeCategory,
                    top: retrieveCount,
                    retrievalMode: retrievalMode,
                    semanticRanker: useSemanticRanker,
                    semanticCaptions: useSemanticCaptions,
                    suggestFollowupQuestions: useSuggestFollowupQuestions
                }
            };
            const result = await API.chatApi(request);
            setAnswers([...answers, [question, result]]);
            if (answers.length < 1) {
                reloadMenu(chat_type);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);
        setOpenaiModel(GPT_35_TURBO);
    };

    useEffect(() => {
        clearChat();
        API.getChatContent(chat_id, chat_type)
            .then((res: API.ChatContent[]) => {
                const answers: [user: string, response: API.AskResponse][] = res.map(item => {
                    const answer: API.AskResponse = {
                        answer: item.answer,
                        thoughts: item.thoughts,
                        data_points: item.data_points
                    };
                    return [item.question, answer];
                });
                setAnswers(answers);
            })
            .catch(e => {
                setError(e);
            })
            .finally(() => {
                setIsLoading(false);
            });
        API.getchat(chat_id).then((res: API.ChatObj) => {
            if (res.openai_model != undefined && res.openai_model != "") {
                setOpenaiModel(res.openai_model);
            }
        });
    }, [chat_id]);
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const onPromptTemplateChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptTemplate(newValue || "");
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "3"));
    };

    const onRetrievalModeChange = (
        _ev: React.FormEvent<HTMLDivElement>,
        option?: IDropdownOption<API.RetrievalMode> | undefined,
        index?: number | undefined
    ) => {
        setRetrievalMode(option?.data || API.RetrievalMode.Hybrid);
    };

    const onUseSemanticRankerChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticRanker(!!checked);
    };

    const onUseSemanticCaptionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticCaptions(!!checked);
    };

    const onExcludeCategoryChanged = (_ev?: React.FormEvent, newValue?: string) => {
        setExcludeCategory(newValue || "");
    };

    const onUseSuggestFollowupQuestionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSuggestFollowupQuestions(!!checked);
    };

    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }

        setSelectedAnswer(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }
        setSelectedAnswer(index);
    };

    return (
        <>
            <div className={styles.chatContainer}>
                <OpenaiModelRadio disabled={answers.length > 0 || isLoading} openaiModel={openaiModel} setOpenaiModel={setOpenaiModel} />
                {answers.length <= 0 && lastQuestionRef.current == "" ? (
                    <ChatEmpty />
                ) : (
                    <div className={styles.chatMessageStream}>
                        {answers.map((answer, index) => (
                            <div key={index}>
                                <UserChatMessage message={answer[0]} />
                                <div className={styles.chatMessageGpt}>
                                    <Answer
                                        key={index}
                                        answer={answer[1]}
                                        isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                        onCitationClicked={c => onShowCitation(c, index)}
                                        onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                        onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                        onFollowupQuestionClicked={q => makeApiRequest(q)}
                                        showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                    />
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className={styles.chatMessageGptMinWidth}>
                                    <AnswerLoading />
                                </div>
                            </>
                        )}
                        {error ? (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className={styles.chatMessageGptMinWidth}>
                                    <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                </div>
                            </>
                        ) : null}
                        <div ref={chatMessageStreamEnd} />
                    </div>
                )}

                <div className={styles.chatInput}>
                    <QuestionInput clearOnSend placeholder="質問を入力してください。" disabled={isLoading} onSend={question => makeApiRequest(question)} />
                </div>
            </div>

            {answers.length > 0 && activeAnalysisPanelTab && (
                <AnalysisPanel
                    className={styles.chatAnalysisPanel}
                    activeCitation={activeCitation}
                    onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                    citationHeight="810px"
                    answer={answers[selectedAnswer][1]}
                    activeTab={activeAnalysisPanelTab}
                />
            )}

            <Panel
                headerText="Configure answer generation"
                isOpen={isConfigPanelOpen}
                isBlocking={false}
                onDismiss={() => setIsConfigPanelOpen(false)}
                closeButtonAriaLabel="Close"
                onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                isFooterAtBottom={true}
            >
                <TextField
                    className={styles.chatSettingsSeparator}
                    defaultValue={promptTemplate}
                    label="Override prompt template"
                    multiline
                    autoAdjustHeight
                    onChange={onPromptTemplateChange}
                />

                <SpinButton
                    className={styles.chatSettingsSeparator}
                    label="Retrieve this many documents from search:"
                    min={1}
                    max={50}
                    defaultValue={retrieveCount.toString()}
                    onChange={onRetrieveCountChange}
                />
                <TextField className={styles.chatSettingsSeparator} label="Exclude category" onChange={onExcludeCategoryChanged} />
                <Checkbox
                    className={styles.chatSettingsSeparator}
                    checked={useSemanticRanker}
                    label="Use semantic ranker for retrieval"
                    onChange={onUseSemanticRankerChange}
                />
                <Checkbox
                    className={styles.chatSettingsSeparator}
                    checked={useSemanticCaptions}
                    label="Use query-contextual summaries instead of whole documents"
                    onChange={onUseSemanticCaptionsChange}
                    disabled={!useSemanticRanker}
                />
                <Checkbox
                    className={styles.chatSettingsSeparator}
                    checked={useSuggestFollowupQuestions}
                    label="Suggest follow-up questions"
                    onChange={onUseSuggestFollowupQuestionsChange}
                />
                <Dropdown
                    className={styles.chatSettingsSeparator}
                    label="Retrieval mode"
                    options={[
                        { key: "hybrid", text: "Vectors + Text (Hybrid)", selected: retrievalMode == API.RetrievalMode.Hybrid, data: API.RetrievalMode.Hybrid },
                        { key: "vectors", text: "Vectors", selected: retrievalMode == API.RetrievalMode.Vectors, data: API.RetrievalMode.Vectors },
                        { key: "text", text: "Text", selected: retrievalMode == API.RetrievalMode.Text, data: API.RetrievalMode.Text }
                    ]}
                    required
                    onChange={onRetrievalModeChange}
                />
            </Panel>
        </>
    );
}

Component.displayName = "Chat";
