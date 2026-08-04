const won = (n) => Number(n).toLocaleString("ko-KR") + "원";
const msg = document.getElementById("msg");

// ---------- 인증 ----------
let TOKEN = localStorage.getItem("cha_admin_token") || "";

function authHeaders() {
  return TOKEN ? { Authorization: "Bearer " + TOKEN } : {};
}

// 인증이 필요한 요청 래퍼 (401 이면 로그인 화면으로)
async function apiWrite(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders() },
  });
  if (res.status === 401) {
    TOKEN = "";
    localStorage.removeItem("cha_admin_token");
    showLogin();
  }
  return res;
}

function showLogin() {
  document.getElementById("login-overlay").classList.remove("hidden");
}
function hideLogin() {
  document.getElementById("login-overlay").classList.add("hidden");
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-err");
  err.textContent = "";
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: document.getElementById("login-pw").value }),
  });
  const data = await res.json();
  if (res.ok) {
    TOKEN = data.token;
    localStorage.setItem("cha_admin_token", TOKEN);
    hideLogin();
    document.getElementById("login-pw").value = "";
  } else {
    err.textContent = data.error || "로그인 실패";
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await apiWrite("/api/logout", { method: "POST" });
  TOKEN = "";
  localStorage.removeItem("cha_admin_token");
  showLogin();
});

// ---------- 카테고리 / 목록 ----------
let CATEGORIES = [];

async function loadCategories() {
  const meta = await (await fetch("/api/meta")).json();
  CATEGORIES = meta.categories;
  const opts = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("category-select").innerHTML = opts;
  document.getElementById("edit-category").innerHTML = opts;
}

let PRODUCTS = [];

async function loadProducts() {
  PRODUCTS = await (await fetch("/api/products")).json();
  document.getElementById("count").textContent = PRODUCTS.length;
  const tbody = document.getElementById("product-rows");
  if (!PRODUCTS.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:30px">등록된 상품이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = PRODUCTS.map((p) => `
      <tr>
        <td>${p.image ? `<img class="thumb-sm" src="${p.image}" />` : '<div class="thumb-sm"></div>'}</td>
        <td>${p.name}</td>
        <td><span class="pill">${p.category}</span></td>
        <td>${p.soldOut ? "품절" : won(p.salePrice || p.price)}</td>
        <td>
          <button class="edit-btn" data-id="${p.id}">수정</button>
          <button class="del-btn" data-id="${p.id}">삭제</button>
        </td>
      </tr>`).join("");
}

// ---------- 목록 액션 (수정 / 삭제) ----------
document.getElementById("product-rows").addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".edit-btn");
  const delBtn = e.target.closest(".del-btn");

  if (editBtn) {
    openEdit(PRODUCTS.find((p) => p.id === editBtn.dataset.id));
    return;
  }
  if (delBtn) {
    if (!confirm("이 상품을 삭제할까요?")) return;
    const res = await apiWrite("/api/products/" + delBtn.dataset.id, { method: "DELETE" });
    if (res.ok) loadProducts();
    else alert("삭제 실패");
  }
});

// ---------- 상품 추가 ----------
document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  const fd = new FormData(e.target);
  fd.set("soldOut", e.target.soldOut.checked ? "true" : "false");
  const res = await apiWrite("/api/products", { method: "POST", body: fd });
  const data = await res.json();
  if (res.ok) {
    msg.className = "msg ok";
    msg.textContent = "✓ 등록되었습니다.";
    e.target.reset();
    loadProducts();
  } else {
    msg.className = "msg err";
    msg.textContent = data.error || "등록 실패";
  }
});

// ---------- 상품 수정 모달 ----------
const editForm = document.getElementById("edit-form");

function openEdit(p) {
  if (!p) return;
  editForm.id.value = p.id;
  editForm.name.value = p.name;
  editForm.category.value = p.category;
  editForm.desc.value = p.desc || "";
  editForm.origin.value = p.origin || "";
  editForm.brand.value = p.brand || "";
  editForm.price.value = p.price;
  editForm.salePrice.value = p.salePrice;
  editForm.discount.value = p.discount;
  editForm.rating.value = p.rating;
  editForm.reviews.value = p.reviews;
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
  editMsg.textContent = "";
  const id = editForm.id.value;
  const fd = new FormData(editForm);
  fd.set("soldOut", editForm.soldOut.checked ? "true" : "false");
  fd.set("removeImage", editForm.removeImage.checked ? "true" : "false");
  fd.delete("id");
  const res = await apiWrite("/api/products/" + id, { method: "PUT", body: fd });
  const data = await res.json();
  if (res.ok) {
    document.getElementById("edit-overlay").classList.add("hidden");
    loadProducts();
  } else {
    editMsg.textContent = data.error || "수정 실패";
  }
});

// ---------- 초기화 ----------
if (!TOKEN) showLogin();
loadCategories();
loadProducts();
