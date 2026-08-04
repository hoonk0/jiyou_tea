const won = (n) => Number(n).toLocaleString("ko-KR") + "원";

let ALL_PRODUCTS = [];
let STORE = {};

async function fetchJSON(url) {
  return (await fetch(url)).json();
}

// 카테고리별 배경 톤 (빈자리 꾸미기용)
const TINTS = {
  전체상품: "#f4f0ea", 보이차: "#f3ede2", 우롱차: "#edf3ea", 차호: "#f0edf4",
  도자기: "#ecf1f4", 차도구: "#f4eeed", 차용품: "#f4f1e6",
  공지사항: "#f1f1f1", 기타: "#f1f1f1", 소개: "#f4f0ea",
};

// 찻잔 삽화 (인라인 SVG — 외부 이미지 없이 자체 렌더)
const TEA_SVG = `
<svg viewBox="0 0 120 120" width="110" height="110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="60" cy="60" r="58" fill="#ffffff"/>
  <path d="M49 33c-4-6 4-10 0-16" stroke="#c9b7a0" stroke-width="3" stroke-linecap="round"/>
  <path d="M61 33c-4-6 4-10 0-16" stroke="#c9b7a0" stroke-width="3" stroke-linecap="round"/>
  <path d="M73 33c-4-6 4-10 0-16" stroke="#c9b7a0" stroke-width="3" stroke-linecap="round"/>
  <path d="M36 45h48l-4 31a15 15 0 0 1-15 13h-10a15 15 0 0 1-15-13z" fill="#faf7f2" stroke="#8a6f52" stroke-width="3"/>
  <path d="M84 51h7a11 11 0 0 1 0 22h-6" fill="none" stroke="#8a6f52" stroke-width="3"/>
  <ellipse cx="60" cy="49" rx="22" ry="5.5" fill="#ef8f2e" opacity=".7"/>
  <path d="M60 60c9 4 13 13 9 22-9-4-13-13-9-22z" fill="#34a35c"/>
</svg>`;

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
  return `<span class="rating"><span class="star">★</span> ${p.rating.toFixed(1)} (${p.reviews})</span>`;
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
        <div class="price-row">${priceRow(p)}${ratingBadge(p)}</div>
      </div>
    </article>`;
}

// ---------- 빈자리 삽화 ----------
function emptyDeco(title, msg, withReserve) {
  const tint = TINTS[title] || "#f3f1ec";
  const btn = withReserve
    ? `<a class="btn-reserve" href="${STORE.naverBookingUrl || "#"}" target="_blank" rel="noopener">네이버 예약 문의</a>`
    : "";
  return `
    <div class="empty-deco" style="--tint:${tint}">
      <div class="deco-art">${TEA_SVG}</div>
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

// 상품 카테고리 화면
function selectCategory(cat) {
  setTitle(cat);
  showListing();
  const list = cat === "전체상품" ? ALL_PRODUCTS : ALL_PRODUCTS.filter((p) => p.category === cat);
  document.getElementById("list-count").textContent = `전체 ${list.length}개`;
  const grid = document.getElementById("product-grid");
  grid.innerHTML = list.length
    ? list.map(card).join("")
    : emptyDeco(cat, "상품을 준비 중입니다. 곧 좋은 차로 찾아뵙겠습니다.", true);
}

// 커뮤니티 화면 (메뉴마다 각각)
function introHTML() {
  const items = STORE.items.map((i) => `<li>${i}</li>`).join("");
  const hours = STORE.hours.map((h) => `<li>${h}</li>`).join("");
  return `
    <div class="info-block">
      <h3>지유명차 잠실점 소개</h3>
      <p>${STORE.intro}</p>
      <p class="info-note">${STORE.reservation}</p>
      <a class="btn-reserve" href="${STORE.naverBookingUrl || "#"}" target="_blank" rel="noopener">네이버 예약하기</a>
    </div>
    <div class="info-grid">
      <div class="info-block"><h3>취급품목</h3><ul class="info-items">${items}</ul></div>
      <div class="info-block"><h3>운영시간</h3><ul class="info-hours">${hours}</ul></div>
    </div>`;
}
function locationHTML() {
  const q = encodeURIComponent(STORE.mapQuery || STORE.address || "서울 송파구 잠실");
  return `
    <div class="info-block">
      <h3>찾아오시는 길</h3>
      <p>${STORE.address || ""}</p>
      <p class="info-note">방문 전 네이버 예약을 권장드립니다.</p>
      <div class="map-wrap">
        <iframe title="지도" loading="lazy" allowfullscreen
          src="https://maps.google.com/maps?q=${q}&z=16&hl=ko&output=embed"></iframe>
      </div>
      <div class="map-btns">
        <a class="btn-map" href="${STORE.naverMapUrl || "#"}" target="_blank" rel="noopener">네이버 지도에서 보기</a>
        <a class="btn-reserve" href="${STORE.naverBookingUrl || "#"}" target="_blank" rel="noopener">네이버 예약하기</a>
      </div>
    </div>`;
}
function renderCommunity(sub) {
  setTitle(sub);
  if (sub === "지유명차 잠실점 소개") showPage(introHTML());
  else if (sub === "찾아오시는길") showPage(locationHTML());
  else if (sub === "공지사항") showPage(emptyDeco("공지사항", "등록된 공지가 없습니다. 새로운 소식으로 곧 찾아뵙겠습니다."));
  else showPage(emptyDeco(sub, "준비 중인 페이지입니다."));
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
  const rating = p.reviews ? `<span class="star">★</span> ${p.rating.toFixed(1)} (리뷰 ${p.reviews})` : "";
  const specs = `<table class="d-specs">
    ${specRow("분류", p.category)}
    ${specRow("원산지", p.origin)}
    ${specRow("브랜드", p.brand)}
    ${specRow("평점", rating)}
  </table>`;

  return `
  <div class="detail">
    <div class="d-gallery">
      <div class="d-main">${badge}${mainImg}</div>
      <div class="d-thumbs">${thumb}</div>
    </div>
    <div class="d-info">
      <div class="d-icons"><button title="찜">♡</button><button title="공유">↗</button></div>
      <h2 class="d-name">${name}</h2>
      ${p.desc ? `<p class="d-desc">${p.desc}</p>` : ""}
      ${price}
      <hr class="d-line" />
      ${specs}
      <hr class="d-line" />
      <p class="d-note">구매·재고 문의는 매장 방문 또는 네이버 예약으로 부탁드립니다.</p>
      <div class="d-actions">
        <a class="btn-reserve" href="${STORE.naverBookingUrl || "#"}" target="_blank" rel="noopener">네이버 예약 문의</a>
        <button class="btn-map" onclick="backToList('${p.category}')">← 목록으로</button>
      </div>
    </div>
  </div>`;
}

function showDetail(p) {
  document.getElementById("page-title").hidden = true;
  document.getElementById("crumb-current").textContent = p.name;
  showPage(detailHTML(p));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToList(cat) {
  selectCategory(cat);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 초기화 ----------
async function init() {
  const meta = await fetchJSON("/api/meta");
  STORE = meta.store || {};

  // 상단 메뉴 (커뮤니티 하위메뉴는 드롭다운)
  document.getElementById("nav-menu").innerHTML = meta.nav
    .map((m) => {
      if (m.children && m.children.length) {
        const sub = m.children.map((c) => `<li class="sub-item" data-sub="${c}">${c}</li>`).join("");
        return `<li class="has-sub">${m.label} <span class="caret">▾</span><ul class="submenu">${sub}</ul></li>`;
      }
      return `<li data-nav="${m.label}">${m.label}</li>`;
    })
    .join("");

  // 상단바 네이버 예약 버튼
  const reserveTop = document.getElementById("reserve-top");
  if (reserveTop) reserveTop.href = STORE.naverBookingUrl || "#";

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

  // 상품 카드 클릭 → 상세 페이지
  document.getElementById("product-grid").addEventListener("click", (e) => {
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    const p = ALL_PRODUCTS.find((x) => x.id === cardEl.dataset.id);
    if (p) showDetail(p);
  });

  ALL_PRODUCTS = await fetchJSON("/api/products");
  selectCategory("전체상품");
}

init();
