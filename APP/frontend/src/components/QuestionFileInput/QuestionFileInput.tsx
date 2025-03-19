import { useEffect, useState } from "react";
import { Stack, TextField } from "@fluentui/react";
import { Send28Filled } from "@fluentui/react-icons";
import { Button, List, message, Upload, Space } from "antd";
import type { RcFile, UploadFile, UploadProps } from "antd/es/upload/interface";
import { UploadOutlined, DeleteFilled, FileFilled } from "@ant-design/icons";

import styles from "./QuestionFileInput.module.css";

interface Props {
    onSend: (question: string, files: UploadFile[]) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
}

export const QuestionFileInput = ({ onSend, disabled, placeholder, clearOnSend }: Props) => {
    const [question, setQuestion] = useState<string>("");
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [composing, setComposition] = useState(false);
    const [fileListHeight, setFileListHeight] = useState<number>(0);
    const startComposition = () => setComposition(true);
    const endComposition = () => setComposition(false);

    const props: UploadProps = {
        onRemove: file => {
            const newFileList = fileList.filter(item => item.uid !== file.uid);
            setFileList(newFileList);
        },
        beforeUpload: file => {
            setFileList([...fileList, file]);
            return false;
        },
        showUploadList: false,
        accept: ".csv, .pdf, .txt, .docx, .xlsx"
    };

    const handleRemove = (file: UploadFile) => {
        const newFileList = fileList.filter(item => item.uid !== file.uid);
        setFileList(newFileList);
    };

    const sendQuestion = () => {
        if (disabled || !question.trim()) {
            return;
        }
        onSend(question, fileList);
        if (clearOnSend) {
            setQuestion("");
            setFileList([]);
        }
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey && !composing) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        if (!newValue) {
            setQuestion("");
        } else if (newValue.length <= 10000) {
            setQuestion(newValue);
        }
    };

    const sendQuestionDisabled = disabled || !question.trim();

    useEffect(() => {
        setFileListHeight(fileList.length * 25);
    }, [fileList]);

    return (
        <div className={styles.questionInputContainer} style={{ height: `${94 + fileListHeight}px` }}>
            <Stack horizontal>
                <TextField
                    className={styles.questionInputTextArea}
                    placeholder={placeholder}
                    multiline
                    resizable={false}
                    borderless
                    value={question}
                    onChange={onQuestionChange}
                    onKeyDown={onEnterPress}
                    onCompositionStart={startComposition}
                    onCompositionEnd={endComposition}
                />
                <div className={styles.questionInputButtonsContainer}>
                    <Upload {...props}>
                        <Button icon={<UploadOutlined />} shape="circle"></Button>
                    </Upload>
                    <Space />
                    <div
                        className={`${styles.questionInputSendButton} ${sendQuestionDisabled ? styles.questionInputSendButtonDisabled : ""}`}
                        aria-label="Ask question button"
                        onClick={sendQuestion}
                    >
                        <Space />
                        <Send28Filled primaryFill="rgba(115, 118, 225, 1)" />
                    </div>
                </div>
            </Stack>
            {fileList.length > 0 && (
                <List
                    size="small"
                    style={{ width: "95%" }}
                    locale={{ emptyText: undefined }}
                    dataSource={fileList}
                    renderItem={item => (
                        <List.Item style={{ padding: 0 }}>
                            <div>
                                <FileFilled style={{ paddingLeft: "8px", paddingRight: "5px" }} />
                                <span>{item.name}</span>
                            </div>
                            <Button size="small" icon={<DeleteFilled />} shape="circle" onClick={() => handleRemove(item)} />
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
};
