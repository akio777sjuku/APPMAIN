import { useRef, useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router-dom";

import styles from "./GptChat.module.css";
import * as API from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { ChatEmpty } from "../../components/ChatEmpty";
import { OpenaiModelRadio } from "../../components/OpenaiModelRadio";
import { OutletContextType } from "../layout/PageLayout";
import { CHAT_TYPE, GPT_35_TURBO } from "../../constants";

export function Component(): JSX.Element {
    const chat_type = CHAT_TYPE.GPT;
    const params = useParams();
    const chat_id = String(params.chatid);
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
            const request: API.GptChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                chat_id: chat_id,
                openai_model: openaiModel
            };
            const result = await API.gptChatApi(request);
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
                const init_answers: [user: string, response: API.AskResponse][] = res.map(item => {
                    const answer: API.AskResponse = {
                        answer: item.answer,
                        thoughts: item.thoughts,
                        data_points: item.data_points
                    };
                    return [item.question, answer];
                });
                setAnswers(init_answers);
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
        <div className={styles.chatContainer}>
            <OpenaiModelRadio disabled={answers.length > 0 || isLoading} openaiModel={openaiModel} setOpenaiModel={setOpenaiModel} />
            {answers.length <= 0 && lastQuestionRef.current == "" ? (
                <div className={styles.chatEmptyState}>
                    <ChatEmpty />
                </div>
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
                                    showFollowupQuestions={true}
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
    );
}
Component.displayName = "GptChat";
