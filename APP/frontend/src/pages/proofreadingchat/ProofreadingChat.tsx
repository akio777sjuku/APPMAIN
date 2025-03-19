import React from "react";
import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import styles from "./ProofreadingChat.module.css";
import * as API from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { SparkleFilled } from "@fluentui/react-icons";

export function Component(): JSX.Element {
    const params = useParams();
    const chat_id = String(params.chatid);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: API.AskResponse][]>([]);

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: API.ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const result = await API.proofreadingtext(question);
            setAnswers([...answers, [question, result]]);
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
    };

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
        <>
            <div className={styles.chatContainer}>
                {answers.length <= 0 && lastQuestionRef.current == "" ? (
                    <div className={styles.chatEmptyState}>
                        <SparkleFilled fontSize={"120px"} primaryFill={"rgba(115, 118, 225, 1)"} aria-hidden="true" aria-label="Chat logo" />
                        <h1 className={styles.chatEmptyStateTitle}>Chat with your data</h1>
                        <h2 className={styles.chatEmptyStateSubtitle}>Ask anything to start the chat</h2>
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
                    <QuestionInput
                        clearOnSend
                        placeholder="校正したい文書を入力してください。"
                        disabled={isLoading}
                        onSend={question => makeApiRequest(question)}
                    />
                </div>
            </div>
        </>
    );
}

Component.displayName = "ProofreadingChat";
