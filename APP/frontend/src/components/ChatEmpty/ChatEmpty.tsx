import { SparkleFilled } from "@fluentui/react-icons";

import styles from "./ChatEmpty.module.css";

export const ChatEmpty = () => {
    return (
        <div className={styles.chatEmptyState}>
            <SparkleFilled fontSize={"120px"} primaryFill={"rgba(115, 118, 225, 1)"} aria-hidden="true" aria-label="Chat logo" />
            <h1 className={styles.chatEmptyStateTitle}>Chat with your data</h1>
            <h2 className={styles.chatEmptyStateSubtitle}>Ask anything to start the chat</h2>
        </div>
    );
};
