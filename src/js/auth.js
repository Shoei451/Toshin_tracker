import { db } from "./config.js";
import { state } from "./state.js";

let _onLoginCallback = null;
let _onLogoutCallback = null;

export function onLogin(fn) {
  _onLoginCallback = fn;
}

export function onLogout(fn) {
  _onLogoutCallback = fn;
}

export function showApp() {
  document.getElementById("auth-screen")?.classList.add("hidden");
  document.getElementById("app-layout")?.classList.add("visible");
}

export function showAuthScreen() {
  document.getElementById("auth-screen")?.classList.remove("hidden");
  document.getElementById("app-layout")?.classList.remove("visible");
}

export function wireLogoutButton() {
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn?.addEventListener("click", async () => {
    if (!confirm("ログアウトしますか？")) return;
    await db.auth.signOut();
  });
}

export async function initAuth() {
  let initialized = false;

  db.auth.onAuthStateChange(async (_event, session) => {
    if (!initialized) return;
    if (session) {
      state.user = session.user;
      showApp();
      _onLoginCallback?.();
    } else {
      state.user = null;
      showAuthScreen();
      _onLogoutCallback?.();
    }
  });

  const {
    data: { session },
  } = await db.auth.getSession();
  initialized = true;

  if (session) {
    state.user = session.user;
    showApp();
    _onLoginCallback?.();
  } else {
    showAuthScreen();
  }
}

export async function requireAuthOrRedirect(redirectTo = "home.html") {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    location.replace(redirectTo);
    return null;
  }

  state.user = session.user;
  showApp();

  db.auth.onAuthStateChange((_event, latestSession) => {
    if (!latestSession) {
      state.user = null;
      location.replace(redirectTo);
    }
  });

  return session;
}

export function wireAuthForm() {
  const form = document.getElementById("auth-form");
  const emailInput = document.getElementById("auth-email");
  const passInput = document.getElementById("auth-password");
  const submitBtn = document.getElementById("auth-submit");
  const toggleBtn = document.getElementById("auth-toggle");
  const errorEl = document.getElementById("auth-error");

  wireLogoutButton();
  if (!form) return;

  let mode = "login";

  toggleBtn?.addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    submitBtn.textContent = mode === "login" ? "ログイン" : "新規登録";
    toggleBtn.textContent = mode === "login" ? "新規登録" : "ログイン";
    errorEl.classList.add("hidden");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    submitBtn.disabled = true;
    const email = emailInput.value.trim();
    const password = passInput.value;
    try {
      if (mode === "signup") {
        const { error } = await db.auth.signUp({ email, password });
        if (error) throw error;
        errorEl.textContent =
          "確認メールを送りました。メールを確認してからログインしてください。";
        errorEl.className = "auth-error";
        errorEl.style.background = "rgba(0,156,136,0.08)";
        errorEl.style.borderColor = "rgba(0,156,136,0.2)";
        errorEl.style.color = "var(--green-dark)";
        errorEl.classList.remove("hidden");
        form.reset();
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.className = "auth-error";
      errorEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
    }
  });
}
