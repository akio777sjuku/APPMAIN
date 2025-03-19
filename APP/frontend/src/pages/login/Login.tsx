import { useState } from "react";
import { Persona, PersonaSize } from "@fluentui/react/lib/Persona";
import { Link as FluentuiLink } from "@fluentui/react";
import { Stack } from "@fluentui/react/lib/Stack";
import { useMsal } from "@azure/msal-react";
import { useIsAuthenticated } from "@azure/msal-react";
import { AccountInfo } from "@azure/msal-browser";
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import { loginRequest } from "../../auth/authconfig";

const Login: React.FC = () => {
    const { instance, accounts } = useMsal();
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AccountInfo>();
    const [error, setError] = useState<any>(null);
    const handleLogin = async () => {
        await instance.loginPopup(loginRequest).catch(e => {
            setError(e);
            return;
        });
        if (useIsAuthenticated()) {
            setIsAuthenticated(true);
            setUser(accounts[0]);
            navigate("/chat");
        }
    };
    const handleLogout = async () => {
        try {
            await instance.logoutPopup();
            if (useIsAuthenticated()) {
                setIsAuthenticated(false);
                setUser(undefined);
                navigate("/");
            }
        } catch (e) {
            setError(e);
        }
    };
    return (
        <>
            {isAuthenticated ? (
                <Stack horizontal>
                    <Stack.Item align="center">
                        <Persona text={user && user.name} secondaryText={user && user.username} size={PersonaSize.size40} />
                    </Stack.Item>
                    <FluentuiLink onClick={handleLogout} className={styles.headerTitle}>
                        <h4>サインアウト</h4>
                    </FluentuiLink>
                </Stack>
            ) : (
                <FluentuiLink onClick={handleLogin} className={styles.headerTitle}>
                    <h4>サインイン</h4>
                </FluentuiLink>
            )}
        </>
    );
};
export default Login;
