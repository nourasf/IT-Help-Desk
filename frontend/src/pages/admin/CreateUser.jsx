import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getStoredToken } from "../../utils/authStorage";
import { API_ROOT } from "../../config/api";
import "../../styles/admin/Admin.css";

const roles = ["Employee", "IT Support Agent", "Manager", "Admin"];

async function createUserRequest(form) {
  const response = await fetch(`${API_ROOT}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken()}`,
    },
    body: JSON.stringify({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      password: form.password,
      role: form.role,
    }),
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { message: text }; }
  }

  if (!response.ok) throw new Error(data.message || "The user could not be created.");
  return data;
}

function CreateUser() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      role: "Employee",
    },
    mode: "onBlur",
  });

  const password = watch("password");

  const createUserMutation = useMutation({
    mutationFn: createUserRequest,
    onSuccess: (_data, form) => {
      setSuccess(`${form.fullName} was created as ${form.role}.`);
      reset();
      queryClient.invalidateQueries({ queryKey: ["dashboard", "admin"] });
    },
  });

  function onSubmit(form) {
    setSuccess("");
    createUserMutation.mutate(form);
  }

  const requestError = createUserMutation.error?.message || "";

  return (
    <DashboardLayout activePage="create-user">
      <div className="create-user-heading">
        <div>
          <p className="create-user-eyebrow">User management</p>
          <h1>Create User</h1>
          <p>Add an employee, support agent, manager, or administrator.</p>
        </div>
      </div>

      <section className="create-user-card">
        <form className="create-user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {requestError && <div className="create-user-message error" role="alert">{requestError}</div>}
          {success && <div className="create-user-message success" role="status">{success}</div>}

          <div className="create-user-field full-width">
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" type="text" placeholder="Enter the user's full name" autoComplete="off" aria-invalid={Boolean(errors.fullName)} {...register("fullName", { required: "Full name is required.", minLength: { value: 2, message: "Full name must be at least 2 characters." } })} />
            {errors.fullName && <small className="create-user-field-error">{errors.fullName.message}</small>}
          </div>

          <div className="create-user-field full-width">
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" placeholder="user@supporthub.com" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email", { required: "Email address is required.", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address." } })} />
            {errors.email && <small className="create-user-field-error">{errors.email.message}</small>}
          </div>

          <div className="create-user-field full-width">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input id="phoneNumber" type="tel" placeholder="+961 71 123 456" autoComplete="tel" aria-invalid={Boolean(errors.phoneNumber)} {...register("phoneNumber", { required: "Phone number is required.", minLength: { value: 7, message: "Enter a valid phone number." } })} />
            {errors.phoneNumber && <small className="create-user-field-error">{errors.phoneNumber.message}</small>}
          </div>

          <div className="create-user-field full-width"><label htmlFor="role">Role</label><select id="role" {...register("role", { required: true })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>
          <div className="create-user-field"><label htmlFor="password">Temporary Password</label><input id="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password", { required: "Temporary password is required.", minLength: { value: 8, message: "Password must be at least 8 characters." } })} />{errors.password && <small className="create-user-field-error">{errors.password.message}</small>}</div>
          <div className="create-user-field"><label htmlFor="confirmPassword">Confirm Password</label><input id="confirmPassword" type="password" placeholder="Repeat the password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword", { required: "Please confirm the password.", validate: (value) => value === password || "Passwords do not match." })} />{errors.confirmPassword && <small className="create-user-field-error">{errors.confirmPassword.message}</small>}</div>

          <div className="create-user-actions full-width"><button type="button" className="create-user-cancel" onClick={() => navigate("/admin-dashboard")}>Cancel</button><button type="submit" className="create-user-submit" disabled={createUserMutation.isPending}>{createUserMutation.isPending ? "Creating User..." : "Create User"}</button></div>
        </form>

        <aside className="create-user-note"><span className="create-user-note-icon" aria-hidden="true">+</span><h2>Account access</h2><p>The new user can sign in immediately with the email and temporary password you provide.</p><p>The phone number can be used for password recovery and verification.</p><p>Choose roles carefully. Managers and administrators receive additional system permissions.</p></aside>
      </section>
    </DashboardLayout>
  );
}

export default CreateUser;
