import { db } from "./firebase-init.js";
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { NAV, CATEGORIES, STORE, resolveCategory } from "./site-config.js";

const won = (n) => Number(n).toLocaleString("ko-KR") + "원";

// 네이버 정식 CI 마크 (흰 N)
const NAVER_N = `<svg class="naver-n" viewBox="0 0 28 28" aria-hidden="true"><rect x="4.5" y="5" width="5" height="18"/><rect x="18.5" y="5" width="5" height="18"/><polygon points="4.5,5 9.5,5 23.5,23 18.5,23"/></svg>`;
const naverBtn = (text) => `${NAVER_N}${text}`;

let ALL_PRODUCTS = [];

// 카테고리별 배경 톤 (빈자리 꾸미기용)
const TINTS = {
  전체상품: "#f4f0ea", "숙차_보이차": "#f3ede2", "생차_보이차": "#edf3ea",
  "우롱차 외": "#f4eeed", "차호/도자기": "#f0edf4",
  공지사항: "#f1f1f1", 소개: "#f4f0ea",
};

// 찻잔 사진 (매장에서 우린 보이차)
const TEA_ART = `<img src="/hero-tea.jpg" alt="" width="900" height="900" loading="lazy" />`;

// ---------- 카드 ----------
function priceRow(p) {
  if (p.soldOut) return '<span class="soldout">품절</span>';
  if (p.discount && p.price > p.salePrice) {
    return `<span class="disc">${p.discount}%</span>
            <span class="price-original">${won(p.price)}</span>
            <span class="price-sale">${won(p.salePrice)}</span>`;
  }
  return `<span class="price-sale">${won(p.salePrice || p.price)}</span>`;
}
function ratingBadge(p) {
  if (!p.reviews) return "";
  return `<span class="rating"><span class="star">★</span> ${Number(p.rating).toFixed(1)} (${p.reviews})</span>`;
}
function card(p) {
  const img = p.image
    ? `<img src="${p.image}" alt="${p.name}" />`
    : `<span class="noimg">이미지 없음</span>`;
  return `
    <article class="card" data-id="${p.id}">
      <div class="card-thumb">${img}</div>
      <div class="card-body">
        <p class="card-name">${p.name}</p>
        ${p.desc ? `<p class="card-desc">${p.desc}</p>` : ""}
        <div class="price-row">${priceRow(p)}</div>
      </div>
    </article>`;
}

// ---------- 빈자리 삽화 ----------
function emptyDeco(title, msg, withReserve) {
  const tint = TINTS[title] || "#f3f1ec";
  const btn = withReserve
    ? `<a class="btn-reserve" href="${STORE.naverBookingUrl || "#"}" target="_blank" rel="noopener">${naverBtn("네이버 예약 문의")}</a>`
    : "";
  return `
    <div class="empty-deco" style="--tint:${tint}">
      <div class="deco-art">${TEA_ART}</div>
      <h3>${title}</h3>
      <p>${msg}</p>
      ${btn}
    </div>`;
}

// ---------- 뷰 전환 ----------
function setTitle(t) {
  const pt = document.getElementById("page-title");
  pt.hidden = false;
  pt.textContent = t;
  document.getElementById("crumb-current").textContent = t;
}
function showListing() {
  document.getElementById("page-view").hidden = true;
  document.getElementById("listing-view").hidden = false;
}
function showPage(html) {
  document.getElementById("listing-view").hidden = true;
  const view = document.getElementById("page-view");
  view.innerHTML = html;
  view.hidden = false;
}

function renderProducts(list) {
  document.getElementById("list-count").textContent = `전체 ${list.length}개`;
  const grid = document.getElementById("product-grid");
  if (!list.length) {
    grid.innerHTML = emptyDeco("상품 준비 중", "등록된 상품이 없습니다.", true);
    return;
  }
  grid.innerHTML = list.map(card).join("");
}

// 화면별 상단 요소(히어로/제목/breadcrumb) 표시 제어
function setChrome({ hero, title, crumb }) {
  const h = document.getElementById("hero");
  if (h) h.style.display = hero ? "" : "none";
  document.getElementById("page-title").style.display = title ? "" : "none";
  document.querySelector(".breadcrumb").style.display = crumb ? "" : "none";
}

function selectCategory(cat) {
  setTitle(cat);
  showListing();
  const home = cat === "전체상품";
  setChrome({ hero: home, title: !home, crumb: !home });
  const list = home ? ALL_PRODUCTS : ALL_PRODUCTS.filter((p) => resolveCategory(p) === cat);
  document.getElementById("list-count").textContent = `전체 ${list.length}개`;
  const grid = document.getElementById("product-grid");
  grid.innerHTML = list.length
    ? list.map(card).join("")
    : emptyDeco(cat, "상품을 준비 중입니다. 곧 좋은 차로 찾아뵙겠습니다.", true);
}

// ---------- 상품 상세 ----------
function detailHTML(p) {
  const badge = p.discount ? `<span class="badge">${p.discount}%</span>` : "";
  const mainImg = p.image
    ? `<img src="${p.image}" alt="${p.name}" />`
    : `<span class="noimg">이미지 없음</span>`;
  const thumb = p.image ? `<div class="d-thumb active"><img src="${p.image}" /></div>` : "";
  const name = p.name.replace(/^(특가 할인중|품절)/, '<span class="hl">$1</span>');

  let price;
  if (p.soldOut) price = `<div class="d-price"><span class="d-soldout">품절</span></div>`;
  else if (p.discount && p.price > p.salePrice)
    price = `<div class="d-price">
      <span class="d-original">${won(p.price)}</span>
      <div class="d-saleline"><span class="d-sale">${won(p.salePrice)}</span><span class="d-salelabel">할인가</span></div>
    </div>`;
  else price = `<div class="d-price"><span class="d-sale">${won(p.salePrice || p.price)}</span></div>`;

  const specRow = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : "");
  const specs = `<table class="d-specs">
    ${specRow("분류", resolveCategory(p) || p.category)}
    ${specRow("원산지", p.origin)}
    ${specRow("브랜드", p.brand)}
  </table>`;

  return `
  <div class="detail">
    <div class="d-gallery">
      <div class="d-main">${badge}${mainImg}</div>
      <div class="d-thumbs">${thumb}</div>
    </div>
    <div class="d-info">
      <button class="share-btn" title="공유하기" aria-label="공유하기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
        <span class="share-label">공유</span>
      </button>
      <h2 class="d-name">${name}</h2>
      ${p.desc ? `<p class="d-desc">${p.desc}</p>` : ""}
      ${price}
      <hr class="d-line" />
      ${specs}
      <hr class="d-line" />
      <p class="d-note">구매·재고 문의는 매장 방문 또는 네이버 예약으로 부탁드립니다.</p>
      <div class="d-actions">
        <a class="btn-reserve" href="${STORE.naverBookingUrl || "#"}" target="_blank" rel="noopener">${naverBtn("네이버 예약 문의")}</a>
        <button class="btn-map" id="back-to-list" data-cat="${resolveCategory(p) || "전체상품"}">← 목록으로</button>
      </div>
    </div>
  </div>`;
}

function showDetail(p) {
  setChrome({ hero: false, title: false, crumb: true });
  document.getElementById("crumb-current").textContent = p.name;
  showPage(detailHTML(p));
  document.getElementById("back-to-list").addEventListener("click", (e) => {
    selectCategory(e.target.dataset.cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  // 공유 버튼: 모바일은 공유창, PC는 링크 복사
  const share = document.querySelector(".share-btn");
  if (share) share.addEventListener("click", async () => {
    const data = { title: p.name, text: `${p.name} — 지유명차 잠실점`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        const label = share.querySelector(".share-label");
        if (label) { label.textContent = "복사됨 ✓"; setTimeout(() => (label.textContent = "공유"), 1500); }
      }
    } catch (_) { /* 사용자 취소 등 무시 */ }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 커뮤니티 ----------
function introHTML() {
  const items = STORE.items.map((i) => `<li>${i}</li>`).join("");
  const hours = STORE.hours.map((h) => `<li>${h}</li>`).join("");
  const programs = (STORE.programs || [])
    .map((p) => `<div class="program-card"><h4>${p.name}</h4><p>${p.desc}</p></div>`)
    .join("");
  return `
    <div class="info-block">
      <h3>지유명차 잠실점 소개</h3>
      <p>${STORE.intro}</p>
      <p class="info-note">${STORE.reservation}</p>
      <a class="btn-reserve" href="${STORE.naverBookingUrl}" target="_blank" rel="noopener">${naverBtn("네이버 예약하기")}</a>
    </div>
    <div class="info-block">
      <h3>차 문화 프로그램</h3>
      <p>차를 배우고 나누는 다양한 프로그램을 운영합니다. (예약 문의)</p>
      <div class="program-grid">${programs}</div>
    </div>
    <div class="info-grid">
      <div class="info-block"><h3>취급품목</h3><ul class="info-items">${items}</ul></div>
      <div class="info-block">
        <h3>운영시간 · 연락처</h3>
        <ul class="info-hours">
          ${hours}
          <li>전화 : ${STORE.phone}</li>
          <li>사업자등록번호 : ${STORE.bizNumber}</li>
        </ul>
      </div>
    </div>
    <p class="inquiry-note">${STORE.inquiry}</p>`;
}

// 보이차 바로알기
const TEA_GUIDE = [
  {
    q: "숙차와 생차, 무엇이 다른가요?",
    a: "생차(생병)는 찻잎을 덖어 그대로 눌러 만든 뒤 오랜 시간에 걸쳐 천천히 익어가는 차입니다. " +
       "숙차(숙병)는 인위적으로 발효(악퇴)를 거쳐 짧은 기간에 부드러운 맛을 내도록 만든 차입니다. " +
       "생차는 맑고 산뜻하며 기운이 강하고, 숙차는 둥글고 순해 속이 편안합니다.",
  },
  {
    q: "처음이라면 어떤 차부터 시작할까요?",
    a: "위에 부담이 적은 숙차부터 권해 드립니다. 숙차로 보이차의 결을 익힌 뒤 생차로 넘어가면 " +
       "차마다의 개성이 훨씬 또렷하게 느껴집니다.",
  },
  {
    q: "어떻게 우려야 맛있나요?",
    a: "끓인 물(95~100℃)로 첫 탕은 가볍게 헹궈 버리고(세차), 이후 5~10초씩 짧게 여러 번 우립니다. " +
       "우릴수록 시간을 조금씩 늘려 주시면 열 번 이상도 맛있게 즐기실 수 있습니다.",
  },
  {
    q: "어떻게 보관하나요?",
    a: "직사광선과 습기, 냄새를 피해 통풍이 되는 그늘에 두시면 됩니다. " +
       "비닐로 밀봉하거나 냉장 보관하면 오히려 차가 상하니 종이·죽피 포장 그대로 두시는 편이 좋습니다.",
  },
  {
    q: "언제 마시면 좋은가요?",
    a: "식후 30분쯤 마시면 소화에 도움이 되고, 기름진 음식이나 음주 뒤에도 편안합니다. " +
       "카페인에 예민하신 분은 늦은 밤을 피해 주세요.",
  },
];

function guideHTML() {
  const items = TEA_GUIDE
    .map((g) => `<div class="guide-card"><h4>${g.q}</h4><p>${g.a}</p></div>`)
    .join("");
  return `
    <div class="info-block">
      <h3>보이차 바로알기</h3>
      <p>보이차를 처음 만나는 분들이 가장 많이 물어보시는 것들을 모았습니다.</p>
      <div class="guide-list">${items}</div>
    </div>
    <div class="info-block">
      <h3>더 배우고 싶으시다면</h3>
      <p>매장에서 보이차 입문 · 보이차 배우기 과정과 차회를 운영합니다. 직접 마셔 보며 배우실 수 있습니다.</p>
      <p class="inquiry-note">${STORE.inquiry}</p>
      <a class="btn-reserve" href="${STORE.naverBookingUrl}" target="_blank" rel="noopener">${naverBtn("네이버 예약하기")}</a>
    </div>`;
}
// ---------- 공지사항 ----------
let NOTICES = null; // null = 아직 안 불러옴

function esc(v) {
  return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d ? d.toLocaleDateString("ko-KR") : "";
}

async function loadNotices() {
  try {
    const snap = await getDocs(query(collection(db, "notices"), orderBy("createdAt", "desc")));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // 고정 공지를 위로
    return list;
  } catch (e) {
    return [];
  }
}

function noticesHTML(list) {
  if (!list.length) {
    return emptyDeco("공지사항", "등록된 공지가 없습니다. 새로운 소식으로 곧 찾아뵙겠습니다.");
  }
  const items = list.map((n) => `
    <article class="notice-item" data-id="${n.id}">
      <button class="notice-head" type="button">
        <span class="notice-name">${n.pinned ? '<span class="notice-pin">공지</span>' : ""}${esc(n.title)}</span>
        <span class="notice-day">${fmtDate(n.createdAt)}</span>
      </button>
      <div class="notice-body" hidden>${esc(n.body)}</div>
    </article>`).join("");
  return `
    <div class="info-block">
      <h3>공지사항</h3>
      <div class="notice-list">${items}</div>
    </div>`;
}

function locationHTML() {
  const q = encodeURIComponent(STORE.mapQuery || STORE.address);
  return `
    <div class="info-block">
      <h3>오시는 길</h3>
      <p>${STORE.address}<br /><span style="color:var(--gray);font-size:13px">${STORE.addressJibun || ""}</span></p>
      <p>전화 : <a href="tel:${(STORE.phone || "").replace(/-/g, "")}" style="color:var(--green-dark);font-weight:600">${STORE.phone}</a></p>
      <p class="info-note">방문 전 네이버 예약을 권장드립니다.</p>
      <div class="map-wrap">
        <iframe title="지도" loading="lazy" allowfullscreen
          src="https://maps.google.com/maps?q=${q}&z=16&hl=ko&output=embed"></iframe>
      </div>
      <div class="map-btns">
        <a class="btn-map" href="${STORE.naverMapUrl}" target="_blank" rel="noopener">네이버 지도에서 보기</a>
        <a class="btn-reserve" href="${STORE.naverBookingUrl}" target="_blank" rel="noopener">${naverBtn("네이버 예약하기")}</a>
      </div>
    </div>`;
}
function renderCommunity(sub) {
  setTitle(sub);
  setChrome({ hero: false, title: true, crumb: true });
  if (sub === "지유명차 잠실점 소개") showPage(introHTML());
  else if (sub === "보이차 바로알기") showPage(guideHTML());
  else if (sub === "오시는길") showPage(locationHTML());
  else if (sub === "공지사항") showNotices();
  else showPage(emptyDeco(sub, "준비 중인 페이지입니다."));
}

async function showNotices() {
  if (NOTICES === null) {
    showPage('<div class="info-block"><h3>공지사항</h3><p>불러오는 중...</p></div>');
    NOTICES = await loadNotices();
  }
  showPage(noticesHTML(NOTICES));
  const list = document.querySelector(".notice-list");
  if (list) list.addEventListener("click", (e) => {
    const head = e.target.closest(".notice-head");
    if (!head) return;
    const item = head.closest(".notice-item");
    const body = item.querySelector(".notice-body");
    body.hidden = !body.hidden;
    item.classList.toggle("open", !body.hidden);
  });
}

// ---------- Firestore에서 상품 불러오기 ----------
async function loadProducts() {
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // createdAt 없는 문서 대비: 정렬 없이 재시도
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

// ---------- 초기화 ----------
async function init() {
  // 상단 메뉴
  document.getElementById("nav-menu").innerHTML = NAV
    .map((m) => {
      if (m.children && m.children.length) {
        const sub = m.children.map((c) => `<li class="sub-item" data-sub="${c}">${c}</li>`).join("");
        return `<li class="has-sub">${m.label} <span class="caret">▾</span><ul class="submenu">${sub}</ul></li>`;
      }
      return `<li data-nav="${m.label}">${m.label}</li>`;
    })
    .join("");

  const reserveTop = document.getElementById("reserve-top");
  if (reserveTop) reserveTop.href = STORE.naverBookingUrl || "#";

  // 히어로 버튼 연결
  const heroReserve = document.getElementById("hero-reserve");
  if (heroReserve) heroReserve.href = STORE.naverBookingUrl || "#";
  const heroLoc = document.getElementById("hero-location");
  if (heroLoc) heroLoc.addEventListener("click", () => {
    renderCommunity("오시는길");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 푸터
  const footerReserve = document.getElementById("footer-reserve");
  if (footerReserve) footerReserve.href = STORE.naverBookingUrl || "#";
  const footerLinks = document.getElementById("footer-links");
  if (footerLinks) footerLinks.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    if (li.dataset.nav) selectCategory(li.dataset.nav);
    else if (li.dataset.sub) renderCommunity(li.dataset.sub);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 메뉴 클릭 라우팅
  document.getElementById("nav-menu").addEventListener("click", (e) => {
    const subItem = e.target.closest("li[data-sub]");
    if (subItem) {
      renderCommunity(subItem.dataset.sub);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const li = e.target.closest("li[data-nav]");
    if (!li) return;
    selectCategory(li.dataset.nav);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 상품 카드 클릭 → 상세
  document.getElementById("product-grid").addEventListener("click", (e) => {
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    const p = ALL_PRODUCTS.find((x) => x.id === cardEl.dataset.id);
    if (p) showDetail(p);
  });

  document.getElementById("list-count").textContent = "불러오는 중...";
  ALL_PRODUCTS = await loadProducts();
  selectCategory("전체상품");
}

init();
