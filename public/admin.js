import { db, auth } from "./firebase-init.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { CATEGORIES, resolveCategory } from "./site-config.js";

const won = (n) => Number(n).toLocaleString("ko-KR") + "원";
const msg = document.getElementById("msg");

// ---------- 로그인 ----------
function showLogin() { document.getElementById("login-overlay").classList.remove("hidden"); }
function hideLogin() { document.getElementById("login-overlay").classList.add("hidden"); }

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-err");
  err.textContent = "";
  let email = document.getElementById("login-email").value.trim();
  if (email && !email.includes("@")) email += "@jiyou.com"; // "admin" → "admin@jiyou.com"
  const pw = document.getElementById("login-pw").value;
  try {
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (ex) {
    const map = {
      "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
      "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
      "auth/user-not-found": "그 이메일로 만든 관리자 계정이 없습니다.",
      "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
      "auth/operation-not-allowed": "Firebase에서 이메일/비밀번호 로그인이 아직 안 켜졌습니다.",
      "auth/too-many-requests": "시도가 많아 잠시 잠겼습니다. 잠시 후 다시 시도하세요.",
    };
    err.textContent = (map[ex.code] || "로그인 오류") + `  [${ex.code}]`;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    hideLogin();
    document.getElementById("login-pw").value = "";
    loadProducts();
    loadNotices();
  } else {
    showLogin();
  }
});

// ---------- 카테고리 채우기 ----------
const opts = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
document.getElementById("category-select").innerHTML = opts;
// 수정 폼에는 "선택 안 됨" 상태를 둔다 — 예전 분류 상품이 엉뚱한 분류로 저장되지 않도록
document.getElementById("edit-category").innerHTML =
  `<option value="" disabled>— 분류를 선택하세요 —</option>` + opts;

// ---------- 이미지 → 압축 base64 ----------
function fileToResizedBase64(file, maxSize = 900, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- 목록 ----------
let PRODUCTS = [];

async function loadProducts() {
  let snap;
  try {
    snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
  } catch {
    snap = await getDocs(collection(db, "products"));
  }
  PRODUCTS = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  document.getElementById("count").textContent = PRODUCTS.length;
  const tbody = document.getElementById("product-rows");
  if (!PRODUCTS.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:30px">등록된 상품이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = PRODUCTS.map((p) => {
    // 새 메뉴로 분류되지 않는 상품은 손님 화면의 카테고리 목록에 안 보인다
    const shown = resolveCategory(p);
    const cell = shown
      ? `<span class="pill">${shown}</span>` +
        (shown === p.category ? "" : `<span class="pill-note">← ${p.category}</span>`)
      : `<span class="pill pill-warn">${p.category || "분류 없음"}</span>
         <span class="pill-note">분류 재지정 필요</span>`;
    return `
      <tr>
        <td>${p.image ? `<img class="thumb-sm" src="${p.image}" />` : '<div class="thumb-sm"></div>'}</td>
        <td>${p.name}</td>
        <td>${cell}</td>
        <td>${p.soldOut ? "품절" : won(p.salePrice || p.price)}</td>
        <td>
          <button class="edit-btn" data-id="${p.id}">수정</button>
          <button class="del-btn" data-id="${p.id}">삭제</button>
        </td>
      </tr>`;
  }).join("");
}

// 폼 → 상품 객체
function formToProduct(form, imageBase64, keepImage) {
  const p = {
    name: form.name.value.trim(),
    category: form.category.value,
    desc: form.desc.value.trim(),
    origin: form.origin.value.trim(),
    brand: form.brand.value.trim(),
    price: Number(form.price.value) || 0,
    salePrice: Number(form.salePrice.value) || 0,
    discount: Number(form.discount.value) || 0,
    soldOut: form.soldOut.checked,
  };
  if (imageBase64 !== undefined) p.image = imageBase64; // 새 이미지 또는 삭제
  return p;
}

// ---------- 추가 ----------
document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  const form = e.target;
  if (!form.name.value.trim()) { msg.className = "msg err"; msg.textContent = "상품명을 입력하세요."; return; }
  msg.className = "msg"; msg.textContent = "저장 중...";
  try {
    const imageBase64 = await fileToResizedBase64(form.image.files[0]);
    const product = formToProduct(form, imageBase64);
    await addDoc(collection(db, "products"), { ...product, createdAt: serverTimestamp() });
    msg.className = "msg ok"; msg.textContent = "✓ 등록되었습니다.";
    form.reset();
    loadProducts();
  } catch (ex) {
    msg.className = "msg err"; msg.textContent = "등록 실패: " + ex.message;
  }
});

// ---------- 삭제 ----------
document.getElementById("product-rows").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".edit-btn");
  const delBtn = e.target.closest(".del-btn");
  if (editBtn) { openEdit(PRODUCTS.find((p) => p.id === editBtn.dataset.id)); return; }
  if (delBtn) {
    if (!confirm("이 상품을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "products", delBtn.dataset.id));
      loadProducts();
    } catch (ex) { alert("삭제 실패: " + ex.message); }
  }
});

// ---------- 수정 ----------
const editForm = document.getElementById("edit-form");

function openEdit(p) {
  if (!p) return;
  editForm.id.value = p.id;
  editForm.name.value = p.name;
  editForm.category.value = resolveCategory(p); // 판별 안 되면 "" → 직접 고르게 둔다
  editForm.desc.value = p.desc || "";
  editForm.origin.value = p.origin || "";
  editForm.brand.value = p.brand || "";
  editForm.price.value = p.price;
  editForm.salePrice.value = p.salePrice;
  editForm.discount.value = p.discount;
  editForm.soldOut.checked = p.soldOut;
  editForm.removeImage.checked = false;
  editForm.image.value = "";
  const img = document.getElementById("edit-cur-img");
  img.src = p.image || "";
  img.style.display = p.image ? "block" : "none";
  document.getElementById("edit-msg").textContent = "";
  document.getElementById("edit-overlay").classList.remove("hidden");
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  document.getElementById("edit-overlay").classList.add("hidden");
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const editMsg = document.getElementById("edit-msg");
  if (!editForm.category.value) { editMsg.textContent = "카테고리를 선택하세요."; return; }
  editMsg.textContent = "저장 중...";
  try {
    const id = editForm.id.value;
    let imageBase64; // undefined = 이미지 그대로 유지
    if (editForm.image.files[0]) imageBase64 = await fileToResizedBase64(editForm.image.files[0]);
    else if (editForm.removeImage.checked) imageBase64 = "";
    const product = formToProduct(editForm, imageBase64);
    await updateDoc(doc(db, "products", id), product);
    document.getElementById("edit-overlay").classList.add("hidden");
    loadProducts();
  } catch (ex) {
    editMsg.textContent = "수정 실패: " + ex.message;
  }
});

// ---------- 탭 전환 ----------
document.querySelector(".tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
  document.getElementById("tab-products").hidden = btn.dataset.tab !== "products";
  document.getElementById("tab-notices").hidden = btn.dataset.tab !== "notices";
});

// ---------- 공지사항 ----------
const noticeMsg = document.getElementById("notice-msg");
let NOTICES = [];

// Firestore Timestamp → "2026. 8. 22."
function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d ? d.toLocaleDateString("ko-KR") : "-";
}

async function loadNotices() {
  const tbodyEl = document.getElementById("notice-rows");
  let snap;
  try {
    try {
      snap = await getDocs(query(collection(db, "notices"), orderBy("createdAt", "desc")));
    } catch {
      snap = await getDocs(collection(db, "notices")); // createdAt 없는 문서 대비
    }
  } catch (ex) {
    const hint = ex.code === "permission-denied"
      ? "Firestore 보안 규칙에 notices 컬렉션이 아직 열려 있지 않습니다."
      : ex.message;
    tbodyEl.innerHTML = `<tr><td colspan="3" style="color:#c0392b;padding:24px">공지를 불러오지 못했습니다. ${esc(hint)}</td></tr>`;
    return;
  }
  NOTICES = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  NOTICES.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // 고정 공지를 위로
  document.getElementById("notice-count").textContent = NOTICES.length;
  const tbody = document.getElementById("notice-rows");
  if (!NOTICES.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#999;padding:30px">등록된 공지가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = NOTICES.map((n) => `
      <tr>
        <td>
          <div class="notice-title">${n.pinned ? '<span class="pin">📌</span>' : ""}${esc(n.title)}</div>
          <div class="notice-preview">${esc(n.body || "")}</div>
        </td>
        <td class="notice-date">${fmtDate(n.createdAt)}</td>
        <td>
          <button class="notice-edit-btn" data-id="${n.id}">수정</button>
          <button class="notice-del-btn" data-id="${n.id}">삭제</button>
        </td>
      </tr>`).join("");
}

// 관리자 화면에도 손님이 쓴 내용이 그대로 들어가므로 이스케이프
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

document.getElementById("notice-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  noticeMsg.className = "msg"; noticeMsg.textContent = "저장 중...";
  try {
    await addDoc(collection(db, "notices"), {
      title: form.title.value.trim(),
      body: form.body.value.trim(),
      pinned: form.pinned.checked,
      createdAt: serverTimestamp(),
    });
    noticeMsg.className = "msg ok"; noticeMsg.textContent = "✓ 공지가 등록되었습니다.";
    form.reset();
    loadNotices();
  } catch (ex) {
    noticeMsg.className = "msg err"; noticeMsg.textContent = "등록 실패: " + ex.message;
  }
});

document.getElementById("notice-rows").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".notice-edit-btn");
  const delBtn = e.target.closest(".notice-del-btn");
  if (editBtn) { openNoticeEdit(NOTICES.find((n) => n.id === editBtn.dataset.id)); return; }
  if (delBtn) {
    if (!confirm("이 공지를 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "notices", delBtn.dataset.id));
      loadNotices();
    } catch (ex) { alert("삭제 실패: " + ex.message); }
  }
});

const noticeEditForm = document.getElementById("notice-edit-form");

function openNoticeEdit(n) {
  if (!n) return;
  noticeEditForm.id.value = n.id;
  noticeEditForm.title.value = n.title || "";
  noticeEditForm.body.value = n.body || "";
  noticeEditForm.pinned.checked = !!n.pinned;
  document.getElementById("notice-edit-msg").textContent = "";
  document.getElementById("notice-edit-overlay").classList.remove("hidden");
}

document.getElementById("notice-edit-cancel").addEventListener("click", () => {
  document.getElementById("notice-edit-overlay").classList.add("hidden");
});

noticeEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const m = document.getElementById("notice-edit-msg");
  m.textContent = "저장 중...";
  try {
    await updateDoc(doc(db, "notices", noticeEditForm.id.value), {
      title: noticeEditForm.title.value.trim(),
      body: noticeEditForm.body.value.trim(),
      pinned: noticeEditForm.pinned.checked,
    });
    document.getElementById("notice-edit-overlay").classList.add("hidden");
    loadNotices();
  } catch (ex) {
    m.textContent = "수정 실패: " + ex.message;
  }
});
