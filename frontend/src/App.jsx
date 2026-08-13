import "./styles/App.css";
import "./styles/Auth.css";
import "./styles/TicketDetailsEnhancements.css";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Notifications from "./pages/notifications/Notifications";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyResetCode from "./pages/auth/VerifyResetCode";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import AgentDashboard from "./pages/dashboards/AgentDashboard";
import CreateUser from "./pages/admin/CreateUser";
import AdminTickets from "./pages/admin/AdminTickets";
import CreateTicket from "./pages/tickets/CreateTicket";
import MyTickets from "./pages/tickets/MyTickets";
import AllTickets from "./pages/tickets/AllTickets";
import TicketDetails from "./pages/tickets/TicketDetails";
import Profile from "./pages/profile/Profile";

function normalizeRole(role) { return String(role || "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " "); }
function getStoredAuth() { const localToken=localStorage.getItem("token"), localRole=localStorage.getItem("role"), sessionToken=sessionStorage.getItem("token"), sessionRole=sessionStorage.getItem("role"); if(localToken&&localRole)return{token:localToken,role:localRole}; if(sessionToken&&sessionRole)return{token:sessionToken,role:sessionRole}; return{token:null,role:null}; }
function ProtectedRoute({children,allowedRole,allowedRoles}) { const {token,role}=getStoredAuth(); if(!token)return <Navigate to="/login" replace/>; const normalizedRole=normalizeRole(role); const roles=allowedRoles||(allowedRole?[allowedRole]:[]); if(roles.map(normalizeRole).length>0&&!roles.map(normalizeRole).includes(normalizedRole))return <Navigate to="/unauthorized" replace/>; return children; }
function getDashboardForRole(role){switch(normalizeRole(role)){case"admin":return"/admin-dashboard";case"manager":return"/manager-dashboard";case"it support agent":case"agent":return"/agent-dashboard";case"employee":return"/employee-dashboard";default:return"/login";}}
function Unauthorized(){const navigate=useNavigate();const{role}=getStoredAuth();return <main className="unauthorized-page"><section className="unauthorized-card"><div className="unauthorized-icon" aria-hidden="true">!</div><span className="unauthorized-eyebrow">Access restricted</span><h1>This page isn&apos;t available for your role.</h1><p>Your account is signed in correctly, but this area belongs to a different workspace.</p><div className="unauthorized-actions"><button type="button" className="unauthorized-primary" onClick={()=>navigate(getDashboardForRole(role),{replace:true})}>Back to my dashboard</button><button type="button" className="unauthorized-secondary" onClick={()=>navigate(-1)}>Go back</button></div></section></main>}
function App(){return <BrowserRouter><Routes><Route path="/login" element={<Login/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/verify-reset-code" element={<VerifyResetCode/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/profile" element={<ProtectedRoute allowedRoles={["Admin","Manager","Employee","IT Support Agent","Agent"]}><Profile/></ProtectedRoute>}/><Route path="/notifications" element={<ProtectedRoute allowedRoles={["Admin","Manager","Employee","IT Support Agent","Agent"]}><Notifications/></ProtectedRoute>}/><Route path="/admin/users/create" element={<ProtectedRoute allowedRole="Admin"><CreateUser/></ProtectedRoute>}/><Route path="/admin/tickets" element={<ProtectedRoute allowedRole="Admin"><AdminTickets/></ProtectedRoute>}/><Route path="/tickets/all" element={<ProtectedRoute allowedRoles={["Manager","Admin"]}><AllTickets/></ProtectedRoute>}/><Route path="/create-ticket" element={<ProtectedRoute allowedRole="Employee"><CreateTicket/></ProtectedRoute>}/><Route path="/my-tickets" element={<ProtectedRoute allowedRole="Employee"><MyTickets/></ProtectedRoute>}/><Route path="/tickets/:id" element={<ProtectedRoute allowedRoles={["Employee","Manager","Admin","IT Support Agent","Agent"]}><TicketDetails/></ProtectedRoute>}/><Route path="/admin-dashboard" element={<ProtectedRoute allowedRole="Admin"><AdminDashboard/></ProtectedRoute>}/><Route path="/manager-dashboard" element={<ProtectedRoute allowedRole="Manager"><ManagerDashboard/></ProtectedRoute>}/><Route path="/agent-dashboard" element={<ProtectedRoute allowedRoles={["IT Support Agent","Agent"]}><AgentDashboard/></ProtectedRoute>}/><Route path="/employee-dashboard" element={<ProtectedRoute allowedRole="Employee"><EmployeeDashboard/></ProtectedRoute>}/><Route path="/unauthorized" element={<Unauthorized/>}/><Route path="/" element={<Navigate to="/login" replace/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes></BrowserRouter>}
export default App;
