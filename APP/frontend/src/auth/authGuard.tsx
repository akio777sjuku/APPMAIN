import React from "react";
import { Navigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

interface AuthGuardProps {
    component: React.ElementType;
    [key: string]: any;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ component: Component, ...rest }) => {
    const { accounts } = useMsal();

    return (accounts.length > 0 ? <Component {...rest} /> : <Navigate to="/" />);
};
export default AuthGuard;
