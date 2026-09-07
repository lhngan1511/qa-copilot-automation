import { createContext, useContext, useEffect, useState } from "react";
import { currentUser, login as loginRequest, logout as logoutRequest } from "../api/authApi.js";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
    useEffect(() => { currentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
    const login = async (username, password, rememberMe = false) => { const next = await loginRequest(username, password, rememberMe); setUser(next); return next; };
    const logout = async () => { await logoutRequest(); setUser(null); };
    return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
