import "./styles/App.css";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import AgentDashboard from "./pages/dashboards/AgentDashboard";
import Register from "./pages/auth/Register";
import CreateTicket from "./pages/tickets/CreateTicket";
import MyTickets from "./pages/tickets/MyTickets";
import TicketDetails from "./pages/tickets/TicketDetails";


function normalizeRole(role) {
  return role
    ?.trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

function ProtectedRoute({ children, allowedRole }) {
  const localToken = localStorage.getItem("token");
  const localRole = localStorage.getItem("role");

  const sessionToken = sessionStorage.getItem("token");
  const sessionRole = sessionStorage.getItem("role");

  let token = null;
  let role = null;

  if (localToken && localRole) {
    token = localToken;
    role = localRole;
  } else if (sessionToken && sessionRole) {
    token = sessionToken;
    role = sessionRole;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = normalizeRole(role);
  const normalizedAllowedRole = normalizeRole(allowedRole);

  console.log("Stored role:", normalizedRole);
  console.log("Allowed role:", normalizedAllowedRole);

  if (normalizedRole !== normalizedAllowedRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

function Unauthorized() {
  return (
    <main>
      <h1>Unauthorized</h1>
      <p>You do not have permission to access this page.</p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

   

   <Route path="/register" element={<Register />}/>

  <Route
  path="/create-ticket"
  element={
    <ProtectedRoute allowedRole="Employee">
      <CreateTicket />
    </ProtectedRoute>
  }
/>


     <Route
  path="/my-tickets"
  element={
    <ProtectedRoute allowedRole="Employee">
      <MyTickets />
    </ProtectedRoute>
  }
/>

  <Route
  path="/tickets/:id"
  element={
    <ProtectedRoute allowedRole="Employee">
      <TicketDetails />
    </ProtectedRoute>
  }
/>
   
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRole="Admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager-dashboard"
          element={
            <ProtectedRoute allowedRole="Manager">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agent-dashboard"
          element={
            <ProtectedRoute allowedRole="IT Support Agent">
              <AgentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee-dashboard"
          element={
            <ProtectedRoute allowedRole="Employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />

        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;