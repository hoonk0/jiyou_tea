// 사이트 고정 정보 (메뉴·카테고리·가게정보) — 서버 없이 여기서 관리
export const NAV = [
  { label: "전체상품" },
  { label: "숙차_보이차" },
  { label: "생차_보이차" },
  { label: "우롱차 외" },
  { label: "차호/도자기" },
  {
    label: "커뮤니티",
    children: ["지유명차 잠실점 소개", "보이차 바로알기", "공지사항", "오시는길"],
  },
];

export const CATEGORIES = ["숙차_보이차", "생차_보이차", "우롱차 외", "차호/도자기"];

// 예전 분류 → 새 분류 (이미 등록된 상품이 새 메뉴에서도 보이도록)
export const CATEGORY_ALIASES = {
  우롱차: "우롱차 외",
  차도구: "우롱차 외",
  차용품: "우롱차 외",
  차호: "차호/도자기",
  도자기: "차호/도자기",
  숙차: "숙차_보이차",
  숙보이차: "숙차_보이차",
  생차: "생차_보이차",
  생보이차: "생차_보이차",
};

// 상품의 표시 분류를 구한다. 빈 문자열이면 관리자에서 분류 재지정이 필요한 상품.
export function resolveCategory(p) {
  const c = (p?.category || "").trim();
  if (CATEGORIES.includes(c)) return c;
  if (CATEGORY_ALIASES[c]) return CATEGORY_ALIASES[c];
  // 예전 "보이차"는 숙/생 구분이 없었으므로 상품명으로 판별 (숙병·숙차 / 생병·생차)
  if (c === "보이차") {
    const n = p?.name || "";
    if (/숙/.test(n)) return "숙차_보이차";
    if (/생/.test(n)) return "생차_보이차";
  }
  return "";
}

export const STORE = {
  name: "지유명차 잠실점",
  intro:
    "지유명차 잠실점은 건강과 행복의 평생 동반자로서 건강, 다이어트, 피로, 숙취해소 등에 도움을 드립니다. " +
    "차회, 연말 차모임, 보이차 입문, 보이차 배우기 등 다양한 차 문화 프로그램을 운영합니다.",
  items: ["보이차", "우롱차", "차호", "도자기", "차도구", "차용품", "차회"],
  itemsLine: "보이차 · 우롱차 · 차호 · 도자기 · 차도구 · 차용품 전문 · 차회",
  tagline: "건강과 행복의 평생 동반자 _ 지유명차 잠실점",
  hours: ["평일 12:00 ~ 18:00", "토·일요일, 공휴일 : 예약제 운영"],
  reservation: "네이버 예약제로 운영합니다.",
  phone: "0507-1337-0451",
  inquiry: "보이차 관련 문의사항은 0507-1337-0451로 문의 바랍니다.",
  bizNumber: "887-40-01396",
  address: "서울 송파구 가락로18길 7, 1층 3호",
  addressJibun: "지번 · 송파동 98-12",
  mapQuery: "37.5017951,127.1115665",
  naverBookingUrl: "https://map.naver.com/p/entry/place/2056347075?placePath=/ticket",
  naverMapUrl: "https://map.naver.com/p/entry/place/2056347075",
  // 차 문화 프로그램
  programs: [
    { name: "차회", desc: "차를 함께 나누며 즐기는 정기 모임" },
    { name: "연말 차모임", desc: "한 해를 마무리하는 특별한 차 모임" },
    { name: "보이차 입문", desc: "보이차를 처음 접하는 분을 위한 입문 과정" },
    { name: "보이차 배우기", desc: "보이차를 깊이 있게 배우는 심화 과정" },
  ],
};
