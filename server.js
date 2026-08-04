import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "products.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

// 관리자 비밀번호 (실제 운영 시 환경변수로 설정: ADMIN_PASSWORD=...)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const sessions = new Set(); // 유효한 로그인 토큰 (메모리 저장)

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 관리자 인증 미들웨어 (등록/수정/삭제에만 적용)
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (sessions.has(token)) return next();
  res.status(401).json({ error: "로그인이 필요합니다." });
}

// --- 사이트 메뉴/카테고리 정의 (지유명차 잠실점 취급품목) ---
const NAV = [
  { label: "전체상품" },
  { label: "보이차" },
  { label: "우롱차" },
  { label: "차호" },
  { label: "도자기" },
  { label: "차도구" },
  { label: "차용품" },
  {
    label: "커뮤니티",
    children: ["지유명차 잠실점 소개", "공지사항", "찾아오시는길"],
  },
];
const CATEGORIES = ["보이차", "우롱차", "차호", "도자기", "차도구", "차용품"];

// 가게 정보
const STORE = {
  name: "지유명차 잠실점",
  intro:
    "지유명차 잠실점은 건강과 행복의 평생 동반자로서 건강, 다이어트, 피로, 숙취해소 등에 도움을 드립니다. " +
    "차회, 연말 차모임, 보이차 입문, 보이차 배우기 등 다양한 차 문화 프로그램을 운영합니다.",
  items: ["보이차", "우롱차", "차호", "도자기", "차도구", "차용품"],
  hours: ["평일 12:00 ~ 18:00", "토·일요일, 공휴일 : 예약제 운영"],
  reservation: "네이버 예약제로 운영합니다.",

  // ▼▼▼ 네이버 플레이스(지유명차 잠실점, place id 2056347075) 연동 ▼▼▼
  address: "서울 송파구 잠실 (지유명차 잠실점)",
  mapQuery: "37.5017951,127.1115665",   // 지도 임베드 좌표 (정확한 위치 핀)
  naverBookingUrl: "https://map.naver.com/p/entry/place/2056347075?placePath=/ticket", // 네이버 예약
  naverMapUrl: "https://map.naver.com/p/entry/place/2056347075",                        // 네이버 지도
  // ▲▲▲ ------------------------------------------ ▲▲▲
};

// --- 상품 저장소 (JSON 파일) ---
function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function saveProducts(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// --- 이미지 업로드 설정 ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /image\/(jpe?g|png|webp|gif)/.test(file.mimetype));
  },
});

// 업로드 이미지 파일 삭제 헬퍼
function removeImageFile(image) {
  if (image && image.startsWith("/uploads/")) {
    fs.unlink(path.join(__dirname, "public", image), () => {});
  }
}

// --- 인증 API ---
app.post("/api/login", (req, res) => {
  if ((req.body?.password || "") !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.add(token);
  res.json({ token });
});

app.post("/api/logout", (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  sessions.delete(token);
  res.json({ ok: true });
});

// --- API ---
app.get("/api/meta", (req, res) => res.json({ nav: NAV, categories: CATEGORIES, store: STORE }));

app.get("/api/products", (req, res) => res.json(loadProducts()));

app.post("/api/products", requireAuth, upload.single("image"), (req, res) => {
  const products = loadProducts();
  const b = req.body;
  const product = {
    id: "p" + Date.now(),
    name: (b.name || "").trim(),
    category: b.category || CATEGORIES[0],
    desc: (b.desc || "").trim(),
    origin: (b.origin || "").trim(),
    brand: (b.brand || "").trim(),
    price: Number(b.price) || 0,
    salePrice: Number(b.salePrice) || 0,
    discount: Number(b.discount) || 0,
    rating: Number(b.rating) || 0,
    reviews: Number(b.reviews) || 0,
    soldOut: b.soldOut === "true" || b.soldOut === "on",
    image: req.file ? "/uploads/" + req.file.filename : "",
  };
  if (!product.name) return res.status(400).json({ error: "상품명을 입력하세요." });
  products.unshift(product);
  saveProducts(products);
  res.status(201).json(product);
});

// 상품 수정 (이미지 교체 포함)
app.put("/api/products/:id", requireAuth, upload.single("image"), (req, res) => {
  const products = loadProducts();
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });

  const b = req.body;
  if (b.name !== undefined) product.name = b.name.trim();
  if (b.category !== undefined) product.category = b.category;
  if (b.desc !== undefined) product.desc = b.desc.trim();
  if (b.origin !== undefined) product.origin = b.origin.trim();
  if (b.brand !== undefined) product.brand = b.brand.trim();
  if (b.price !== undefined) product.price = Number(b.price) || 0;
  if (b.salePrice !== undefined) product.salePrice = Number(b.salePrice) || 0;
  if (b.discount !== undefined) product.discount = Number(b.discount) || 0;
  if (b.rating !== undefined) product.rating = Number(b.rating) || 0;
  if (b.reviews !== undefined) product.reviews = Number(b.reviews) || 0;
  if (b.soldOut !== undefined) product.soldOut = b.soldOut === "true" || b.soldOut === "on";

  // 새 이미지가 올라오면 기존 이미지 교체·삭제
  if (req.file) {
    removeImageFile(product.image);
    product.image = "/uploads/" + req.file.filename;
  } else if (b.removeImage === "true") {
    removeImageFile(product.image);
    product.image = "";
  }

  if (!product.name) return res.status(400).json({ error: "상품명을 입력하세요." });
  saveProducts(products);
  res.json(product);
});

app.delete("/api/products/:id", requireAuth, (req, res) => {
  const products = loadProducts();
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  const [removed] = products.splice(idx, 1);
  removeImageFile(removed.image); // 업로드 이미지도 삭제
  saveProducts(products);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`지유명차 잠실점 → http://localhost:${PORT}`));
