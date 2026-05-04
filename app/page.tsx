"use client";
import LoginForm from "./login/Login";

export default function HomePage() {
  return (
    <div>
      <LoginForm onLoginSuccess={() => {}} />
    </div>
  );
}
