"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type CardData = {
  id: string; // uuid string
  text: string; // HTML-safe string (text + optional <img class="emoji-img" src="data:image/...">)
  done: boolean;
  color: string;
  boardId?: string;
  sectionId?: string;
  sectionTitle?: string;
  originSectionId?: string;
  originSectionTitle?: string;
  originDateKey?: string;
};

type StickerData = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
};

type SectionData = {
  id: string;
  title: string;
  order: number;
};

type State = {
  cards: Record<string, CardData[]>;
  sections: Record<string, SectionData[]>;
  stickers: Record<string, StickerData[]>;
  weekVisibility: Record<string, boolean[]>;
};

const STORAGE_KEY = "muchi-note-safe-v3";
const LOCAL_STATE_KEY = "muchi-note-state-v3";
const MONTH_NAMES = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];
const WEEKDAY_NAMES_MON_FIRST = ["월", "화", "수", "목", "금", "토", "일"];
const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "크리스마스",
};
const LUNAR_HOLIDAYS_BY_YEAR: Record<number, Record<string, string>> = {
  2025: {
    "01-28": "설날 연휴",
    "01-29": "설날",
    "01-30": "설날 연휴",
  },
};
const CARD_COLORS = ["default", "yellow", "green", "pink"] as const;
const EMOJI_STORE_KEY = "muchi-emoji-store";
const EMOJI_ORDER_KEY = "muchi-emoji-order";
const TAB_STORE_KEY = "muchi-note-tabs-v1";
const ACTIVE_TAB_KEY = "muchi-note-active-tab-v1";
const STICKER_STORE_KEY = "muchi-sticker-store";
const STICKER_ORDER_KEY = "muchi-sticker-order";
const THEME_KEY = "muchi-theme-preset";
const THEME_PRESETS: Record<
  string,
  {
    accent: string;
    accentRgb: string;
    accentOutline: string;
    topbarBg: string;
    tabBg: string;
    tabActiveBg: string;
  }
> = {
  default: {
    accent: "#C96A4A",
    accentRgb: "201, 106, 74",
    accentOutline: "#D9A08D",
    topbarBg: "#F1E9DD",
    tabBg: "#FFFFFF",
    tabActiveBg: "#F1E9DD",
  },
  mint: {
    accent: "#2FAE9B",
    accentRgb: "47, 174, 155",
    accentOutline: "#87D6C8",
    topbarBg: "#E5F6F2",
    tabBg: "#FFFFFF",
    tabActiveBg: "#E5F6F2",
  },
  sky: {
    accent: "#4F78A6",
    accentRgb: "79, 120, 166",
    accentOutline: "#9BB2CB",
    topbarBg: "#E7EDF5",
    tabBg: "#FFFFFF",
    tabActiveBg: "#E7EDF5",
  },
  lavender: {
    accent: "#8A6AD6",
    accentRgb: "138, 106, 214",
    accentOutline: "#C7B5F0",
    topbarBg: "#EEE9FA",
    tabBg: "#FFFFFF",
    tabActiveBg: "#EEE9FA",
  },
  olive: {
    accent: "#7A8F3A",
    accentRgb: "122, 143, 58",
    accentOutline: "#B8C587",
    topbarBg: "#EEF2DF",
    tabBg: "#FFFFFF",
    tabActiveBg: "#EEF2DF",
  },
  charcoal: {
    accent: "#4B5563",
    accentRgb: "75, 85, 99",
    accentOutline: "#9AA1AD",
    topbarBg: "#ECEEF1",
    tabBg: "#FFFFFF",
    tabActiveBg: "#ECEEF1",
  },
  navy: {
    accent: "#2C4A7A",
    accentRgb: "44, 74, 122",
    accentOutline: "#8FA6C8",
    topbarBg: "#E4EAF3",
    tabBg: "#FFFFFF",
    tabActiveBg: "#E4EAF3",
  },
  burgundy: {
    accent: "#8B3D4A",
    accentRgb: "139, 61, 74",
    accentOutline: "#D1A2AA",
    topbarBg: "#F3E4E7",
    tabBg: "#FFFFFF",
    tabActiveBg: "#F3E4E7",
  },
  purple: {
    accent: "#6F4DB7",
    accentRgb: "111, 77, 183",
    accentOutline: "#B9A4E4",
    topbarBg: "#EEE8FA",
    tabBg: "#FFFFFF",
    tabActiveBg: "#EEE8FA",
  },
};
const DEFAULT_EMOJIS = [
  { id: "default-check", ch: "✅" },
  { id: "default-fire", ch: "🔥" },
  { id: "default-star", ch: "⭐️" },
  { id: "default-pin", ch: "📌" },
  { id: "default-heart", ch: "❤️" },
  { id: "default-thumb", ch: "👍" },
  { id: "default-idea", ch: "💡" },
  { id: "default-bang", ch: "❗️" },
  { id: "default-strong", ch: "💪" },
];

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10));

export default function Page() {
  const [authReady, setAuthReady] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserEmailRef = useRef<string | null>(null);
  const periodicSyncTimer = useRef<number | null>(null);
  const currentBoardIdRef = useRef<string>("work");

  useEffect(() => {
    let mounted = true;
    const search = typeof window !== "undefined" ? window.location.search : "";
    const isPreview = search.includes("preview=1");
    setPreviewMode(isPreview);
    if (isPreview) {
      setAuthReady(true);
      return;
    }

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      currentUserIdRef.current = data.session.user.id;
      currentUserEmailRef.current = data.session.user.email ?? null;
      setAuthReady(true);
    }
    checkSession();
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        setAuthReady(false);
        window.location.href = "/login";
      } else {
        currentUserIdRef.current = session.user.id;
        currentUserEmailRef.current = session.user.email ?? null;
        setAuthReady(true);
      }
    });
    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
      if (periodicSyncTimer.current) window.clearInterval(periodicSyncTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    // React 18 StrictMode 초기 mount 중복 실행을 방지하기 위한 플래그
    if ((window as typeof window & { __MUCHI_NOTE_INIT__?: boolean }).__MUCHI_NOTE_INIT__) {
      return;
    }
    (window as typeof window & { __MUCHI_NOTE_INIT__?: boolean }).__MUCHI_NOTE_INIT__ = true;

    const AIRTABLE_BASE_ID =
      process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID ?? "app8KHGcgFezjsSHP";
    const AIRTABLE_TABLE_NAME =
      process.env.NEXT_PUBLIC_AIRTABLE_TABLE_NAME ?? "cards";
    const AIRTABLE_TOKEN =
      process.env.NEXT_PUBLIC_AIRTABLE_TOKEN ??
      "여기에_네_Airtable_토큰_붙여넣기";

    const monthTitle = document.getElementById("monthTitle") as HTMLElement | null;
    const monthPickerToggle = document.getElementById(
      "monthPickerToggle",
    ) as HTMLButtonElement | null;
    const monthDropdown = document.getElementById("monthDropdown") as HTMLElement | null;
    const ymYearLabel = document.getElementById("ymYearLabel") as HTMLElement | null;
    const ymPrevYear = document.getElementById("ymPrevYear") as HTMLButtonElement | null;
    const ymNextYear = document.getElementById("ymNextYear") as HTMLButtonElement | null;
    const ymMonthButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".ym-month-btn"),
    );

    const calendarGrid = document.getElementById("calendarGrid") as HTMLElement | null;
    const calendarWrapper = document.querySelector(".calendar-wrapper") as HTMLElement | null;
    const headerToggle = document.getElementById("headerToggle") as HTMLButtonElement | null;
    const headerToggleFloating = document.getElementById(
      "headerToggleFloating",
    ) as HTMLButtonElement | null;
    const prevBtn = document.getElementById("prevMonth") as HTMLButtonElement | null;
    const nextBtn = document.getElementById("nextMonth") as HTMLButtonElement | null;
    const weekendToggleBtn = document.getElementById("weekendToggle") as HTMLButtonElement | null;
    const scaleResetBtn = document.getElementById("scaleReset") as HTMLButtonElement | null;
    const zoomRange = document.getElementById("zoomRange") as HTMLInputElement | null;
    const zoomInBtn = document.getElementById("zoomIn") as HTMLButtonElement | null;
    const zoomOutBtn = document.getElementById("zoomOut") as HTMLButtonElement | null;
    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    const searchBtn = document.getElementById("searchBtn") as HTMLButtonElement | null;
    const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement | null;
    const airtableSaveBtn = document.getElementById(
      "airtableSaveBtn",
    ) as HTMLButtonElement | null;
    const airtableLoadBtn = document.getElementById(
      "airtableLoadBtn",
    ) as HTMLButtonElement | null;
    const todayBtn = document.getElementById("todayBtn") as HTMLButtonElement | null;
    const scopeMonthBtn = document.getElementById("scopeMonth") as HTMLButtonElement | null;
    const scopeAllBtn = document.getElementById("scopeAll") as HTMLButtonElement | null;
    const toastContainer = document.getElementById(
      "toastContainer",
    ) as HTMLElement | null;
    const expandedOverlay = document.getElementById("expandedOverlay") as HTMLElement | null;
    const expandedContainer = document.getElementById("expandedContainer") as HTMLElement | null;
    const collapseExpandedBtn = document.getElementById(
      "collapseExpandedBtn",
    ) as HTMLButtonElement | null;
    const helpButton = document.getElementById("helpButton") as HTMLButtonElement | null;
    const helpModal = document.getElementById("helpModal") as HTMLElement | null;
    const helpClose = document.getElementById("helpClose") as HTMLButtonElement | null;
    const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement | null;
    const settingsModal = document.getElementById("settingsModal") as HTMLElement | null;
    const settingsClose = document.getElementById("settingsClose") as HTMLButtonElement | null;
    const settingsEmail = document.getElementById("settingsEmail") as HTMLElement | null;
    const settingsPwdNew = document.getElementById("settingsPwdNew") as HTMLInputElement | null;
    const settingsPwdConfirm = document.getElementById("settingsPwdConfirm") as HTMLInputElement | null;
    const settingsPwdBtn = document.getElementById("settingsPwdBtn") as HTMLButtonElement | null;
    const settingsPwdMsg = document.getElementById("settingsPwdMsg") as HTMLElement | null;
    const settingsFeedbackTab = document.querySelector<HTMLButtonElement>('[data-settings-tab="feedback"]');
    const settingsFeedbackPanel = document.querySelector<HTMLElement>('[data-settings-panel="feedback"]');
    const feedbackTextarea = document.getElementById("feedbackTextarea") as HTMLTextAreaElement | null;
    const feedbackSubmit = document.getElementById("feedbackSubmit") as HTMLButtonElement | null;
    const settingsTabButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")
    );
    const settingsPanels = Array.from(
      document.querySelectorAll<HTMLElement>("[data-settings-panel]")
    );
    const themeButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-theme]")
    );

    if (
      !monthTitle ||
      !calendarGrid ||
      !searchInput ||
      !searchBtn ||
      !scopeMonthBtn ||
      !scopeAllBtn ||
      !toastContainer
    ) {
      console.error("필수 DOM 요소를 찾을 수 없습니다. 마크업을 확인하세요.");
      return;
    }

    function applyThemePreset(name: string, persist = true) {
      const preset = THEME_PRESETS[name] ?? THEME_PRESETS.default;
      const root = document.documentElement;
      root.style.setProperty("--theme-accent", preset.accent);
      root.style.setProperty("--theme-accent-rgb", preset.accentRgb);
      root.style.setProperty("--theme-accent-outline", preset.accentOutline);
      root.style.setProperty("--theme-topbar-bg", preset.topbarBg);
      root.style.setProperty("--theme-tab-bg", preset.tabBg);
      root.style.setProperty("--theme-tab-active-bg", preset.tabActiveBg);
      themeButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.theme === name);
      });
      if (persist) {
        localStorage.setItem(THEME_KEY, name);
      }
    }

    const savedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme = savedTheme && THEME_PRESETS[savedTheme] ? savedTheme : "default";
    applyThemePreset(initialTheme, false);
    if (savedTheme !== initialTheme) {
      localStorage.setItem(THEME_KEY, initialTheme);
    }

    themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.theme || "default";
        applyThemePreset(name);
      });
    });

    let current = new Date();
    current.setDate(1);
    let pickerYear = current.getFullYear();
    // 인피니트 스크롤 범위: 시작 달(포함) / 끝 달 시작(제외)
    let startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
    let endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);

    let state: State = { cards: {}, weekVisibility: {}, sections: {}, stickers: {} };
    let headerCollapsed = false;
    let showWeekend = true;
    let marqueeBox: HTMLDivElement | null = null;
    let marqueeStart: { x: number; y: number } | null = null;
    let marqueeActive = false;
    let selectionOutlineBox: HTMLDivElement | null = null;
    let stickerPointerActive = false;
    const SCALE_KEY = "muchi-ui-scale";
    let lastActiveDayCell: HTMLElement | null = null;
    let lastActiveDateKey: string | null = null;
    let cardClipboard: CardData[] = [];
    let emojiList: Array<{ id: string; src: string; name: string }> = [];
    let emojiOrder: string[] = [];
    let stickerList: Array<{ id: string; src: string; name: string }> = [];
    let stickerOrder: string[] = [];
    let activeStickerTarget: HTMLElement | null = null;
    let draggingEmojiId: string | null = null;
    const HISTORY_LIMIT = 200;
    let history: State[] = [];
    let historyIndex = -1;
    let draggingCards: HTMLDivElement[] = [];
    let dragPlaceholder: HTMLDivElement | null = null;
    let searchMode: "month" | "all" = "month";
    let lastFocusedContent: HTMLDivElement | null = null;
    let lastRange: Range | null = null;
    let lastActiveCardContent: HTMLDivElement | null = null;
    let expandedCell: HTMLElement | null = null;
    let expandedPlaceholder: HTMLElement | null = null;
    let keepFocusFromPalette = false;
    let keepFocusFromToolbar = false;
    let tabs: Array<{ id: string; name: string }> = [];
    let activeTabId = "work";
    let editingCardId: string | null = null;
    let lastSelectedCardId: string | null = null;
    let selectionAnchorCardId: string | null = null;
    const tabBar = document.getElementById("tabBar") as HTMLElement | null;
    const DEBUG_SYNC = localStorage.getItem("muchi-debug-sync") === "1";
    const dbg = (...args: unknown[]) => {
      if (DEBUG_SYNC) console.log("[muchi-debug]", ...args);
    };
    // moved to component scope

    function toggleSelection(card: HTMLDivElement) {
      card.classList.toggle("selected");
      if (card.classList.contains("selected")) {
        lastSelectedCardId = card.dataset.cardId || null;
        if (!selectionAnchorCardId) {
          selectionAnchorCardId = lastSelectedCardId;
        }
      } else if (selectionAnchorCardId === card.dataset.cardId) {
        selectionAnchorCardId = null;
      }
    }

    function clearSelection() {
      document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
      lastSelectedCardId = null;
      selectionAnchorCardId = null;
    }

    function sanitizeToTextAndEmojis(html: string) {
      const container = document.createElement("div");
      const output = document.createElement("div");
      container.innerHTML = html;

      const allowedImg = (el: Element) =>
        el.tagName.toLowerCase() === "img" &&
        el.getAttribute("src")?.startsWith("data:image/") &&
        (el as HTMLImageElement).src.length < 500000; // cap size

      const isBlockTag = (tag: string) =>
        ["div", "p", "section", "article", "header", "footer", "li"].includes(tag);

      const normalizeTag = (tag: string) => {
        if (tag === "b") return "strong";
        if (tag === "i") return "em";
        if (tag === "strike") return "s";
        return tag;
      };

      const appendSanitized = (parent: HTMLElement, node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          parent.appendChild(document.createTextNode(node.textContent ?? ""));
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === "br") {
          parent.appendChild(document.createElement("br"));
          return;
        }
        if (allowedImg(el)) {
          const img = document.createElement("img");
          img.className = "emoji-img";
          img.src = el.getAttribute("src") || "";
          parent.appendChild(img);
          return;
        }

        const allowedInline = ["strong", "em", "u", "s", "a", "span"];
        const normalized = normalizeTag(tag);

        if (allowedInline.includes(normalized)) {
          const next = document.createElement(normalized);
          if (normalized === "a") {
            const href = el.getAttribute("href") || "";
            if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
              next.setAttribute("href", href);
              next.setAttribute("rel", "noopener noreferrer");
              next.setAttribute("target", "_blank");
            }
          }
          if (normalized === "span") {
            const style = el.getAttribute("style") || "";
            const colorMatch = style.match(/color\s*:\s*[^;]+/i);
            const sizeMatch = style.match(/font-size\s*:\s*[^;]+/i);
            const nextStyle = [colorMatch?.[0], sizeMatch?.[0]].filter(Boolean).join("; ");
            if (nextStyle) {
              next.setAttribute("style", nextStyle);
            }
          }
          el.childNodes.forEach((child) => appendSanitized(next, child));
          parent.appendChild(next);
          return;
        }

        el.childNodes.forEach((child) => appendSanitized(parent, child));
        if (isBlockTag(tag)) {
          parent.appendChild(document.createElement("br"));
        }
      };

      container.childNodes.forEach((node) => appendSanitized(output, node));
      return output.innerHTML;
    }

    function normalizeCardHtmlForSave(html: string) {
      return sanitizeToTextAndEmojis(html);
    }

    function renderCardHtml(text: string) {
      const sanitized = sanitizeToTextAndEmojis(text || "");
      return sanitized.replace(/\n/g, "<br>");
    }

    function getPlainTextFromStored(value: string) {
      const container = document.createElement("div");
      container.innerHTML = renderCardHtml(value);
      return container.textContent || "";
    }

    function insertAtSelection(htmlFragment: string, opts?: { strictCard?: boolean }) {
      const selection = window.getSelection();
      const strictCard = opts?.strictCard ?? false;
      let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

      if (!range && lastRange) {
        range = lastRange.cloneRange();
        selection?.removeAllRanges();
        if (selection && range) selection.addRange(range);
      }

      const targetContent = lastFocusedContent || lastActiveCardContent;

      if (!range && targetContent) {
        range = document.createRange();
        range.selectNodeContents(targetContent);
        range.collapse(false);
        selection?.removeAllRanges();
        if (selection && range) selection.addRange(range);
      }

      if (!range) return false;
      if (strictCard && (!targetContent || !targetContent.closest(".card"))) return false;

      range.deleteContents();
      const temp = document.createElement("div");
      temp.innerHTML = htmlFragment;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) {
        frag.appendChild(temp.firstChild);
      }
      range.insertNode(frag);
      range.collapse(false);
      selection?.removeAllRanges();
      if (selection) selection.addRange(range);
      lastRange = range.cloneRange();
      return true;
    }

    function loadEmojis() {
      try {
        const raw = localStorage.getItem(EMOJI_STORE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          emojiList = parsed.filter((e) => typeof e.src === "string" && typeof e.id === "string");
        }
      } catch (e) {
        console.error("loadEmojis error", e);
      }
    }

    function saveEmojis() {
      try {
        localStorage.setItem(EMOJI_STORE_KEY, JSON.stringify(emojiList));
      } catch (e) {
        console.error("saveEmojis error", e);
      }
    }

    function loadEmojiOrder() {
      try {
        const raw = localStorage.getItem(EMOJI_ORDER_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) emojiOrder = parsed.filter((id) => typeof id === "string");
      } catch (e) {
        console.error("loadEmojiOrder error", e);
      }
    }

    function saveEmojiOrder() {
      try {
        localStorage.setItem(EMOJI_ORDER_KEY, JSON.stringify(emojiOrder));
      } catch (e) {
        console.error("saveEmojiOrder error", e);
      }
    }

    function loadStickers() {
      try {
        const raw = localStorage.getItem(STICKER_STORE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          stickerList = parsed.filter((e) => typeof e.src === "string" && typeof e.id === "string");
        }
      } catch (e) {
        console.error("loadStickers error", e);
      }
    }

    function saveStickers() {
      try {
        localStorage.setItem(STICKER_STORE_KEY, JSON.stringify(stickerList));
      } catch (e) {
        console.error("saveStickers error", e);
      }
    }

    function loadStickerOrder() {
      try {
        const raw = localStorage.getItem(STICKER_ORDER_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) stickerOrder = parsed.filter((id) => typeof id === "string");
      } catch (e) {
        console.error("loadStickerOrder error", e);
      }
    }

    function saveStickerOrder() {
      try {
        localStorage.setItem(STICKER_ORDER_KEY, JSON.stringify(stickerOrder));
      } catch (e) {
        console.error("saveStickerOrder error", e);
      }
    }

    function setActiveDay(cell: HTMLElement | null) {
      if (!cell || !cell.classList.contains("day-cell")) return;
      const key = cell.dataset.date || null;
      if (lastActiveDayCell && lastActiveDayCell !== cell) {
        lastActiveDayCell.classList.remove("active-day");
      }
      lastActiveDayCell = cell;
      lastActiveDateKey = key;
      cell.classList.remove("hovered-day");
      cell.classList.add("active-day");
    }
    function moveActiveDay(deltaX: number, deltaY: number) {
      const grid = calendarGrid;
      if (!grid) return;
      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".day-cell"));
      const datedCells = cells.filter((c) => c.dataset.date);
      if (!datedCells.length) return;
      const active = lastActiveDayCell && cells.includes(lastActiveDayCell)
        ? lastActiveDayCell
        : datedCells[0];

      const cols = showWeekend ? 7 : 5;
      const activeIdx = cells.indexOf(active);
      if (activeIdx < 0) return;
      const step = deltaY * cols + deltaX;
      if (step === 0) return;

      let targetIdx = activeIdx + step;
      const dir = step > 0 ? 1 : -1;
      while (targetIdx >= 0 && targetIdx < cells.length) {
        const candidate = cells[targetIdx];
        if (candidate.dataset.date) {
          setActiveDay(candidate);
          candidate.scrollIntoView({ block: "center", behavior: "smooth" });
          break;
        }
        targetIdx += dir;
      }
    }

    function deleteCards(targets: HTMLDivElement[]) {
      if (!targets.length) return;
      if (targets.length > 1 && !confirm(`선택된 ${targets.length}개 카드를 삭제할까요?`)) {
        return;
      }
      const affectedDates = new Set<string>();

      targets.forEach((c) => {
        const dateKey = c.dataset.date || c.closest<HTMLElement>(".day-cell")?.dataset.date;
        const idStr = c.dataset.cardId;
        dbg("deleteCards", {
          id: idStr,
          dateKey,
          datasetBoardId: c.dataset.boardId,
          activeTabId,
        });
        const parent = c.parentElement;
        c.remove();
        if (dateKey && idStr) {
          let deleted = deleteCardFromState(dateKey, idStr);
          if (!deleted) {
            for (const key of Object.keys(state.cards)) {
              if (deleteCardFromState(key, idStr)) {
                affectedDates.add(key);
                deleted = true;
                break;
              }
            }
          }
          affectedDates.add(dateKey);
        }
        if (idStr) {
          deleteCardInSupabase(idStr);
        }
        if (parent && parent.classList.contains("day-section-body")) {
          const cell = parent.closest(".day-cell") as HTMLElement | null;
          if (cell) {
            updateSectionHints(cell);
            cleanupDoneSection(cell);
          }
        }
      });

      affectedDates.forEach((dk) => updateDayBadge(dk));
      clearSelection();
      syncCurrentMonthFromDom();
      saveLocalState();
    }

    function ensureMarqueeBox() {
      if (marqueeBox) return marqueeBox;
      const box = document.createElement("div");
      box.className = "marquee-selection";
      document.body.appendChild(box);
      marqueeBox = box;
      return box;
    }

    function ensureSelectionOutlineBox() {
      if (selectionOutlineBox) return selectionOutlineBox;
      const box = document.createElement("div");
      box.className = "selection-outline-box";
      document.body.appendChild(box);
      selectionOutlineBox = box;
      return box;
    }

    // 카드가 1개만 선택되면 표시하지 않고, 2개 이상 선택되면 전체를 감싸는
    // 사각형 하나만 그린다 (개별 카드 테두리 대신).
    function updateSelectionOutlineBox() {
      const box = ensureSelectionOutlineBox();
      const selected = Array.from(document.querySelectorAll<HTMLElement>(".card.selected"));
      if (selected.length < 2) {
        box.style.display = "none";
        return;
      }
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      selected.forEach((el) => {
        const r = el.getBoundingClientRect();
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      });
      box.style.display = "block";
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${right - left}px`;
      box.style.height = `${bottom - top}px`;
    }

    function isEditableTarget(el: HTMLElement | null) {
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return true;
      if ((el as HTMLDivElement).isContentEditable) return true;
      return false;
    }

    function updateMarqueeSelection(rect: { left: number; top: number; right: number; bottom: number }) {
      const cards = document.querySelectorAll<HTMLDivElement>(".card");
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const overlap = !(rect.right < r.left || rect.left > r.right || rect.bottom < r.top || rect.top > r.bottom);
        if (overlap) {
          card.classList.add("selected");
        }
      });
    }

    const formatDateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };


    const formatMonthKey = (year: number, monthIndex: number) =>
      `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    function updateMonthTitle(date: Date = current) {
      if (!monthTitle) return;
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const isMobileView = window.innerWidth <= 768;
      if (isMobileView) {
        const yy = String(year).slice(-2);
        const mm = String(monthIdx + 1).padStart(2, "0");
        monthTitle.innerHTML = `<span class="month-number">${yy}</span>/<span class="month-number">${mm}</span>`;
      } else {
        const mm = String(monthIdx + 1);
        monthTitle.innerHTML = `<span class="month-number">${year}</span>년 <span class="month-number">${mm}</span>월`;
      }
      pickerYear = year;
      if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
    }

    const toggleWeekendUI = () => {
      document.body.classList.toggle("weekend-hidden", !showWeekend);
      if (weekendToggleBtn) {
        weekendToggleBtn.textContent = "WEEKEND";
        weekendToggleBtn.classList.toggle("faded", !showWeekend);
      }
    };

    function snapshotState() {
      return JSON.parse(JSON.stringify(state)) as State;
    }

    function pushHistory() {
      // 현재 인덱스 이후 히스토리 제거 후 추가
      history = history.slice(0, historyIndex + 1);
      history.push(snapshotState());
      if (history.length > HISTORY_LIMIT) {
        history.shift();
      }
      historyIndex = history.length - 1;
    }

    function undo() {
      if (historyIndex <= 0) return;
      const beforeState = state;
      historyIndex--;
      const prev = history[historyIndex];
      state = JSON.parse(JSON.stringify(prev));
      saveState();
      saveLocalState();
      renderCalendar();
      if (!previewMode) {
        // periodicSync는 upsert만 하므로, undo로 사라진(=이전 스냅샷에 없는) 카드/스티커는
        // 서버에서도 명시적으로 삭제해야 새로고침 시 되살아나지 않는다.
        // 주의: 카드는 undo로 날짜가 바뀔 수 있으므로(드래그 이동 되돌리기 등) dateKey별로
        // 비교하면 안 되고, 전체 상태에서 그 id가 어딘가에 여전히 존재하는지로 판단해야 한다.
        const afterCardIds = new Set<string>();
        Object.values(state.cards).forEach((list) => {
          list.forEach((c) => afterCardIds.add(c.id));
        });
        const removedCardIds: string[] = [];
        Object.values(beforeState.cards).forEach((list) => {
          list.forEach((c) => {
            if (!afterCardIds.has(c.id)) removedCardIds.push(c.id);
          });
        });
        const afterStickerIds = new Set<string>();
        Object.values(state.stickers).forEach((list) => {
          list.forEach((s) => afterStickerIds.add(s.id));
        });
        const removedStickerIds: string[] = [];
        Object.values(beforeState.stickers).forEach((list) => {
          list.forEach((s) => {
            if (!afterStickerIds.has(s.id)) removedStickerIds.push(s.id);
          });
        });
        requestAnimationFrame(() => {
          void periodicSync();
          removedCardIds.forEach((id) => void deleteCardInSupabase(id));
          removedStickerIds.forEach((id) => void deleteStickerInSupabase(id));
        });
      }
    }

    function syncZoomRange(v: number) {
      if (!zoomRange) return;
      zoomRange.value = String(Math.round(v * 100));
    }

    function setScale(next: number) {
      const clamped = Math.max(0.8, Math.min(1.3, next));
      document.documentElement.style.setProperty("--ui-scale", String(clamped));
      saveScale(clamped);
      syncZoomRange(clamped);
    }

    function loadScale() {
      try {
        const raw = localStorage.getItem(SCALE_KEY);
        if (!raw) return;
        const v = Number(raw);
        if (Number.isFinite(v) && v >= 0.8 && v <= 1.3) {
          setScale(v);
        }
      } catch (e) {
        console.error("loadScale error", e);
      }
    }

    function saveScale(v: number) {
      try {
        localStorage.setItem(SCALE_KEY, String(v));
      } catch (e) {
        console.error("saveScale error", e);
      }
    }

    const WEEK_COLUMN_WIDTH_KEY = "muchi-week-column-widths-v1";
    const MIN_COL_WIDTH = 140;
    const MAX_COL_WIDTH = 640;
    // 주(월요일 날짜키)별 요일 칸 너비. 이 주에서 드래그로 조정한 칸만 기록되고,
    // 다른 주에는 영향을 주지 않는다.
    let weekColumnWidths: Record<string, Array<number | null>> = {};

    function loadWeekColumnWidths() {
      try {
        const raw = localStorage.getItem(WEEK_COLUMN_WIDTH_KEY);
        if (!raw) return;
        weekColumnWidths = JSON.parse(raw) as Record<string, Array<number | null>>;
      } catch (e) {
        console.error("loadWeekColumnWidths error", e);
      }
    }

    function saveWeekColumnWidths() {
      try {
        localStorage.setItem(WEEK_COLUMN_WIDTH_KEY, JSON.stringify(weekColumnWidths));
      } catch (e) {
        console.error("saveWeekColumnWidths error", e);
      }
    }

    function applyStoredWeekColumnWidths(rowEl: HTMLElement, weekKey: string) {
      const widths = weekColumnWidths[weekKey];
      if (!widths) return;
      widths.forEach((w, i) => {
        if (typeof w === "number" && w >= MIN_COL_WIDTH && w <= MAX_COL_WIDTH) {
          rowEl.style.setProperty(`--col-w-${i}`, `${w}px`);
        }
      });
    }

    function createColumnResizeHandle(colIndex: number) {
      const handle = document.createElement("span");
      handle.className = "col-resize-handle";
      handle.title = "드래그해서 이번 주만 칸 너비 조절 (더블클릭: 이번 주 초기화)";
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rowElNullable = handle.closest(".week-row-grid") as HTMLElement | null;
        const cellEl = handle.closest(".day-cell") as HTMLElement | null;
        if (!rowElNullable || !cellEl) return;
        const rowEl = rowElNullable;
        const weekKey = rowEl.dataset.weekKey || "";
        const startWidth = cellEl.getBoundingClientRect().width / uiScaleValue();
        const startX = e.clientX;
        handle.classList.add("resizing");
        function onMove(ev: MouseEvent) {
          const delta = (ev.clientX - startX) / uiScaleValue();
          const next = Math.min(
            MAX_COL_WIDTH,
            Math.max(MIN_COL_WIDTH, Math.round(startWidth + delta)),
          );
          rowEl.style.setProperty(`--col-w-${colIndex}`, `${next}px`);
        }
        function onUp() {
          handle.classList.remove("resizing");
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (!weekKey) return;
          const raw = rowEl.style.getPropertyValue(`--col-w-${colIndex}`).trim();
          const widths = weekColumnWidths[weekKey] || [];
          widths[colIndex] = raw ? parseFloat(raw) : null;
          weekColumnWidths[weekKey] = widths;
          saveWeekColumnWidths();
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      handle.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rowEl = handle.closest(".week-row-grid") as HTMLElement | null;
        if (!rowEl) return;
        const weekKey = rowEl.dataset.weekKey || "";
        rowEl.style.removeProperty(`--col-w-${colIndex}`);
        if (weekKey && weekColumnWidths[weekKey]) {
          weekColumnWidths[weekKey][colIndex] = null;
          saveWeekColumnWidths();
        }
      });
      return handle;
    }

    function uiScaleValue() {
      const v = Number(
        getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"),
      );
      return Number.isFinite(v) && v > 0 ? v : 1;
    }

    function adjustScale(delta: number) {
      const current = Number(
        getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"),
      );
      setScale(current + delta);
    }

    function onWheelScale(e: WheelEvent) {
      if (!(e.metaKey || e.altKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      adjustScale(delta);
    }

    function toggleMonthDropdown() {
      if (!monthDropdown || !monthPickerToggle) return;
      const willOpen = !monthDropdown.classList.contains("open");
      if (willOpen) {
        pickerYear = current.getFullYear();
        monthDropdown.classList.add("open");
        monthPickerToggle.classList.add("open");
        if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
      } else {
        monthDropdown.classList.remove("open");
        monthPickerToggle.classList.remove("open");
      }
    }

    function closeMonthDropdown() {
      if (!monthDropdown || !monthPickerToggle) return;
      monthDropdown.classList.remove("open");
      monthPickerToggle.classList.remove("open");
    }

    function getLocalStateKey() {
      return `${LOCAL_STATE_KEY}:${activeTabId}`;
    }

    function loadTabs() {
      try {
        const raw = localStorage.getItem(TAB_STORE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Array<{ id: string; name: string }>;
        if (Array.isArray(parsed) && parsed.length) {
          tabs = parsed;
        }
      } catch (e) {
        console.error("loadTabs error", e);
      }
    }

    function ensureTabs() {
      if (tabs.length) return;
      tabs = [
        { id: "work", name: "일" },
        { id: "life", name: "개인" },
      ];
      saveTabs();
    }

    function saveTabs() {
      try {
        localStorage.setItem(TAB_STORE_KEY, JSON.stringify(tabs));
      } catch (e) {
        console.error("saveTabs error", e);
      }
    }

    function loadActiveTab() {
      const raw = localStorage.getItem(ACTIVE_TAB_KEY);
      if (raw && tabs.some((t) => t.id === raw)) {
        activeTabId = raw;
        return;
      }
      activeTabId = tabs[0]?.id ?? "work";
      try {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
      } catch (e) {
        console.error("saveActiveTab error", e);
      }
    }

    function renderTabs() {
      if (!tabBar) return;
      tabBar.innerHTML = "";
      tabs.forEach((tab) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `tab-btn${tab.id === activeTabId ? " active" : ""}`;
        btn.textContent = tab.name;
        btn.title = "더블클릭하여 이름 변경";
        btn.addEventListener("click", () => {
          if (tab.id === activeTabId) return;
          setActiveTab(tab.id);
        });
        btn.addEventListener("dblclick", () => {
          const next = window.prompt("탭 이름 변경", tab.name);
          if (!next) return;
          tab.name = next.trim() || tab.name;
          saveTabs();
          renderTabs();
        });
        tabBar.appendChild(btn);
      });
    }

    async function setActiveTab(id: string) {
      activeTabId = id;
      try {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
      } catch (e) {
        console.error("saveActiveTab error", e);
      }
      currentBoardIdRef.current = id;
      state.cards = {};
      state.sections = {};
      state.stickers = {};
      history = [];
      historyIndex = -1;
      clearSelection();
      renderTabs();
      await loadState();
      currentBoardIdRef.current = activeTabId;
      pushHistory();
      renderCalendar();
    }

    async function fetchCardsFromSupabase(tabId = activeTabId) {
      if (previewMode) return false;
      const uid = currentUserIdRef.current;
      if (!uid) return false;
      const localSnapshot = tabId === activeTabId ? loadLocalState() : undefined;
      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, date_key, text, done, color, board_id, section_id, section_title, origin_section_id, origin_section_title, origin_date_key",
        )
        .eq("user_id", uid)
        .eq("board_id", tabId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("supabase load error", error);
        return false;
      }
      if (tabId !== activeTabId) return false;
      const grouped: Record<string, CardData[]> = {};
      const sectionMap: Record<string, SectionData[]> = {};
      data?.forEach((row) => {
        const dk = row.date_key;
        if (!grouped[dk]) grouped[dk] = [];
        const sectionId = row.section_id ?? "default";
        const sectionTitle = row.section_title ?? "";
        grouped[dk].push({
          id: row.id,
          text: row.text ?? "",
          done: !!row.done,
          color: row.color ?? "default",
          boardId: row.board_id ?? tabId,
          sectionId,
          sectionTitle,
          originSectionId: row.origin_section_id ?? undefined,
          originSectionTitle: row.origin_section_title ?? undefined,
          originDateKey: row.origin_date_key ?? undefined,
        });
        if (!sectionMap[dk]) sectionMap[dk] = [];
        if (sectionId && sectionId !== "done") {
          const exists = sectionMap[dk].some((s) => s.id === sectionId);
          if (!exists) {
            sectionMap[dk].push({
              id: sectionId,
              title: sectionTitle || "",
              order: sectionMap[dk].length,
            });
          }
        }
      });
      if (localSnapshot?.cards) {
        applyLocalCardOrder(grouped, localSnapshot.cards);
      }
      state.cards = grouped;
      state.sections = sectionMap;
      saveLocalState();
      return true;
    }

    async function fetchStickersFromSupabase(tabId = activeTabId) {
      if (previewMode) return false;
      const uid = currentUserIdRef.current;
      if (!uid) return false;
      const { data, error } = await supabase
        .from("stickers")
        .select("id, date_key, src, x, y, width, height, rotation, z, board_id")
        .eq("user_id", uid)
        .eq("board_id", tabId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("supabase sticker load error", error);
        return false;
      }
      if (tabId !== activeTabId) return false;
      const grouped: Record<string, StickerData[]> = {};
      data?.forEach((row) => {
        const dk = row.date_key;
        if (!grouped[dk]) grouped[dk] = [];
        grouped[dk].push({
          id: row.id,
          src: row.src,
          x: Number(row.x),
          y: Number(row.y),
          width: Number(row.width),
          height: Number(row.height),
          rotation: Number(row.rotation),
          z: Number(row.z ?? 1),
        });
      });
      state.stickers = grouped;
      saveLocalState();
      return true;
    }

    async function loadState() {
      const tabId = activeTabId;
      // Supabase 데이터 우선
      let cardsFetched = false;
      let stickersFetched = false;
      if (!previewMode) {
        await repairBoardMappingFromLocal();
        cardsFetched = !!(await fetchCardsFromSupabase(tabId));
        stickersFetched = !!(await fetchStickersFromSupabase(tabId));
      }
      if (tabId !== activeTabId) return;
      currentBoardIdRef.current = tabId;
      // Supabase 조회에 실패했거나(오프라인/에러) 건너뛴 경우(미리보기 모드 등)에만
      // 로컬 캐시로 복구한다. 조회에 성공했다면 카드가 0개인 것도 "진짜 0개"이므로
      // 오래된 로컬 캐시로 덮어쓰지 않는다.
      const local = loadLocalState();
      if (!cardsFetched && !Object.keys(state.cards).length && local?.cards) {
        state.cards = local.cards;
        Object.values(state.cards).forEach((list) => {
          if (!Array.isArray(list)) return;
          list.forEach((c) => {
            if (!c.boardId) c.boardId = tabId;
          });
        });
      }
      if (local?.sections) {
        state.sections = local.sections;
      }
      if (!stickersFetched && !Object.keys(state.stickers).length && local?.stickers) {
        state.stickers = local.stickers;
      }
      ensureCardBoardIds(tabId);
    }

    function saveState() {
      // Supabase를 단일 저장소로 사용 중이므로 로컬 스토리지 저장은 생략
    }

    function saveLocalState() {
      try {
        const payload = { cards: state.cards, sections: state.sections, stickers: state.stickers };
        localStorage.setItem(getLocalStateKey(), JSON.stringify(payload));
      } catch (e) {
        console.error("saveLocalState error", e);
      }
    }

    function loadLocalState() {
      try {
        const raw = localStorage.getItem(getLocalStateKey());
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<State>;
        return parsed;
      } catch (e) {
        console.error("loadLocalState error", e);
      }
      return undefined;
    }

    async function repairBoardMappingFromLocal() {
      const FLAG_KEY = "muchi-note-board-repair-v1";
      if (localStorage.getItem(FLAG_KEY)) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;

      const tabIds = tabs.map((t) => t.id);
      const rows: Array<{
        id: string;
        user_id: string;
        board_id: string;
        date_key: string;
        text: string;
        done: boolean;
        color: string;
        section_id: string;
        section_title: string;
        origin_section_id: string | null;
        origin_section_title: string | null;
        origin_date_key: string | null;
      }> = [];

      tabIds.forEach((tabId) => {
        const raw = localStorage.getItem(`${LOCAL_STATE_KEY}:${tabId}`);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<State>;
          const cards = parsed.cards ?? {};
          Object.entries(cards).forEach(([dateKey, list]) => {
            if (!Array.isArray(list)) return;
            list.forEach((c) => {
              rows.push({
                id: c.id,
                user_id: uid,
                board_id: tabId,
                date_key: dateKey,
                text: c.text ?? "",
                done: !!c.done,
                color: c.color ?? "default",
                section_id: c.sectionId ?? "default",
                section_title: c.sectionTitle ?? "",
                origin_section_id: c.originSectionId ?? null,
                origin_section_title: c.originSectionTitle ?? null,
                origin_date_key: c.originDateKey ?? null,
              });
            });
          });
        } catch (e) {
          console.error("repairBoardMappingFromLocal parse error", e);
        }
      });

      if (!rows.length) {
        localStorage.setItem(FLAG_KEY, "1");
        return;
      }

      const { error } = await supabase.from("cards").upsert(rows);
      if (error) {
        console.error("repairBoardMappingFromLocal upsert error", error);
        return;
      }
      localStorage.setItem(FLAG_KEY, "1");
    }

    async function upsertCardToSupabase(dateKey: string, cardObj: CardData) {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      console.log("[supabase] upsert single", { dateKey, id: cardObj.id });
      const boardId = cardObj.boardId ?? activeTabId;
      const { error } = await supabase
        .from("cards")
        .upsert({
          id: cardObj.id,
          user_id: uid,
          board_id: boardId,
          date_key: dateKey,
          text: cardObj.text,
          done: cardObj.done,
          color: cardObj.color,
          section_id: cardObj.sectionId ?? "default",
          section_title: cardObj.sectionTitle ?? "",
          origin_section_id: cardObj.originSectionId ?? null,
          origin_section_title: cardObj.originSectionTitle ?? null,
          origin_date_key: cardObj.originDateKey ?? null,
        });
      if (error) console.error("supabase upsert error", error);
    }

    async function upsertStickerToSupabase(dateKey: string, sticker: StickerData) {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      const { error } = await supabase.from("stickers").upsert({
        id: sticker.id,
        user_id: uid,
        board_id: activeTabId,
        date_key: dateKey,
        src: sticker.src,
        x: sticker.x,
        y: sticker.y,
        width: sticker.width,
        height: sticker.height,
        rotation: sticker.rotation,
        z: sticker.z ?? 1,
      });
      if (error) console.error("supabase sticker upsert error", error);
    }

    async function deleteStickerInSupabase(stickerId: string) {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      const { error } = await supabase
        .from("stickers")
        .delete()
        .eq("id", stickerId)
        .eq("user_id", uid)
        .eq("board_id", activeTabId);
      if (error) console.error("supabase sticker delete error", error);
    }

    // 주기적 전체 동기화: DOM -> state -> Supabase
    function buildInList(arr: string[]) {
      // PostgREST not.in expects (id1,id2,...) with quotes for text
      return `(${arr.map((id) => `"${id}"`).join(",")})`;
    }

    async function periodicSync() {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      if (currentBoardIdRef.current !== activeTabId) return;
      const syncTabId = currentBoardIdRef.current;

      // DOM 기준으로 state 갱신
      syncCurrentMonthFromDom();

      // 현재 상태를 Supabase에 upsert
      const rows: Array<{
        id: string;
        user_id: string;
        board_id: string;
        date_key: string;
        text: string;
        done: boolean;
        color: string;
        section_id: string;
        section_title: string;
        origin_section_id: string | null;
        origin_section_title: string | null;
        origin_date_key: string | null;
      }> = [];
      const ids: string[] = [];
      Object.entries(state.cards).forEach(([dateKey, list]) => {
        list.forEach((c) => {
          const cardBoardId = c.boardId ?? syncTabId;
          if (cardBoardId !== syncTabId) return;
          ids.push(c.id);
          rows.push({
            id: c.id,
            user_id: uid,
            board_id: cardBoardId,
            date_key: dateKey,
            text: c.text,
            done: c.done,
            color: c.color,
            section_id: c.sectionId ?? "default",
            section_title: c.sectionTitle ?? "",
            origin_section_id: c.originSectionId ?? null,
            origin_section_title: c.originSectionTitle ?? null,
            origin_date_key: c.originDateKey ?? null,
          });
        });
      });

      if (!rows.length) return;
      dbg("periodicSync upsert", { boardId: syncTabId, rows: rows.length, ids: ids.slice(0, 5) });
      const { error: upErr } = await supabase.from("cards").upsert(rows);
      if (upErr) {
        console.error("supabase periodic upsert error", upErr);
      }
      // 주기 동기화에서 삭제는 하지 않는다.
      // (현재 화면/월에 없는 카드까지 지워질 수 있어 데이터 손실 위험)
    }

    async function deleteCardInSupabase(id: string) {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      dbg("deleteCardInSupabase request", { id, uid });
      const { error, data } = await supabase
        .from("cards")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) console.error("supabase delete error", error);
      else dbg("deleteCardInSupabase ok", { id, data });
    }

    const ensureCardBoardIds = (tabId: string) => {
      let changed = false;
      Object.values(state.cards).forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((c) => {
          if (!c.boardId) {
            c.boardId = tabId;
            changed = true;
          }
        });
      });
      if (changed) {
        saveLocalState();
      }
    };

    const applyLocalCardOrder = (
      grouped: Record<string, CardData[]>,
      localCards: Record<string, CardData[]>,
    ) => {
      Object.entries(grouped).forEach(([dateKey, list]) => {
        const localList = localCards[dateKey];
        if (!Array.isArray(localList) || !localList.length) return;
        const order = new Map<string, number>();
        localList.forEach((c, idx) => {
          if (c?.id) order.set(c.id, idx);
        });
        if (!order.size) return;
        const withIndex = list.map((c, idx) => ({
          card: c,
          order: order.has(c.id) ? order.get(c.id)! : Number.MAX_SAFE_INTEGER,
          fallback: idx,
        }));
        withIndex.sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.fallback - b.fallback;
        });
        grouped[dateKey] = withIndex.map((x) => x.card);
      });
    };

    const getCardsForDate = (dateKey: string) => {
      const list = state.cards[dateKey];
      if (!Array.isArray(list)) return [];
      return list.filter((c) => c.boardId === activeTabId);
    };

    const getSectionsForDate = (dateKey: string) => {
      const list = state.sections[dateKey];
      return Array.isArray(list) ? list : [];
    };

    const getStickersForDate = (dateKey: string) => {
      const list = state.stickers[dateKey];
      return Array.isArray(list) ? list : [];
    };

    const ensureStickerList = (dateKey: string) => {
      if (!Array.isArray(state.stickers[dateKey])) state.stickers[dateKey] = [];
      return state.stickers[dateKey];
    };

    const updateStickerInState = (
      dateKey: string,
      stickerId: string,
      updates: Partial<StickerData>,
    ) => {
      const list = ensureStickerList(dateKey);
      const idx = list.findIndex((s) => s.id === stickerId);
      if (idx < 0) return;
      list[idx] = { ...list[idx], ...updates };
      void upsertStickerToSupabase(dateKey, list[idx]);
      saveLocalState();
    };

    const deleteStickerFromState = (dateKey: string, stickerId: string) => {
      const list = ensureStickerList(dateKey);
      state.stickers[dateKey] = list.filter((s) => s.id !== stickerId);
      void deleteStickerInSupabase(stickerId);
      saveLocalState();
    };

    const findDayCellFromPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const cell = el?.closest(".day-cell") as HTMLElement | null;
      if (cell?.dataset.date) return cell;
      const cells = Array.from(document.querySelectorAll<HTMLElement>(".day-cell[data-date]"));
      return (
        cells.find((c) => {
          const rect = c.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        }) || null
      );
    };

    const moveStickerToCell = (
      fromKey: string,
      cell: HTMLElement,
      sticker: StickerData,
      rect: DOMRect,
    ) => {
      const toKey = cell.dataset.date || "";
      if (!toKey || toKey === fromKey) return false;
      const layer = cell.querySelector<HTMLElement>(".day-sticker-layer");
      if (!layer) return false;
      const layerRect = layer.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const maxX = Math.max(0, layerRect.width - width);
      const maxY = Math.max(0, layerRect.height - height);
      const nextX = Math.min(Math.max(rect.left - layerRect.left, 0), maxX);
      const nextY = Math.min(Math.max(rect.top - layerRect.top, 0), maxY);

      const fromList = ensureStickerList(fromKey);
      const idx = fromList.findIndex((s) => s.id === sticker.id);
      if (idx < 0) return false;

      const moved = { ...fromList[idx], x: nextX, y: nextY, width, height };
      fromList.splice(idx, 1);
      if (fromList.length === 0) delete state.stickers[fromKey];

      const toList = ensureStickerList(toKey);
      toList.push(moved);
      void upsertStickerToSupabase(toKey, moved);
      saveLocalState();
      return true;
    };

    const ensureSectionList = (dateKey: string) => {
      if (!Array.isArray(state.sections[dateKey])) state.sections[dateKey] = [];
      return state.sections[dateKey];
    };

    const DONE_SECTION_ID = "done";

    const ensureDefaultSection = (dateKey: string) => {
      const list = ensureSectionList(dateKey);
      if (!list.some((s) => s.id === "default")) {
        list.unshift({ id: "default", title: "", order: 0 });
      }
      return list;
    };

    const getSectionBodyById = (cell: HTMLElement, sectionId: string) => {
      const section = cell.querySelector<HTMLElement>(`.day-section[data-section-id="${sectionId}"]`);
      return section ? (section.querySelector(".day-section-body") as HTMLElement | null) : null;
    };

    const ensureDoneSectionBody = (cell: HTMLElement) => {
      const existing = getSectionBodyById(cell, DONE_SECTION_ID);
      if (existing) return existing;
      const sectionsWrap = cell.querySelector(".day-sections");
      if (!sectionsWrap) return null;

      const doneEl = document.createElement("div");
      doneEl.className = "day-section day-section-done";
      doneEl.dataset.sectionId = DONE_SECTION_ID;
      doneEl.dataset.sectionTitle = "완료";

      const doneHeader = document.createElement("div");
      doneHeader.className = "day-section-header";
      const doneTitle = document.createElement("div");
      doneTitle.className = "day-section-title";
      doneTitle.textContent = "완료";
      doneHeader.appendChild(doneTitle);

      const doneBody = document.createElement("div");
      doneBody.className = "day-section-body";
      doneBody.addEventListener("mouseenter", () => {
        setActiveDay(cell);
        setActiveSection(cell, DONE_SECTION_ID);
      });

      doneEl.appendChild(doneHeader);
      doneEl.appendChild(doneBody);

      sectionsWrap.appendChild(doneEl);

      return doneBody;
    };

    const selectSticker = (el: HTMLElement, dateKey: string, keepExisting = false) => {
      const layer = el.parentElement;
      if (!layer) return;
      if (!keepExisting) {
        const existing = layer.querySelectorAll<HTMLElement>(".sticker-item.selected");
        existing.forEach((node) => node.classList.remove("selected"));
      }
      el.classList.add("selected");
      const list = getStickersForDate(dateKey);
      const maxZ = list.reduce((max, s) => Math.max(max, s.z || 0), 0);
      const id = el.dataset.stickerId || "";
      if (id) {
        updateStickerInState(dateKey, id, { z: maxZ + 1 });
        el.style.zIndex = String(maxZ + 1);
      }
    };

    const clearStickerSelection = () => {
      const selected = document.querySelectorAll<HTMLElement>(".sticker-item.selected");
      selected.forEach((node) => node.classList.remove("selected"));
    };

    const deleteSelectedStickers = () => {
      const selected = Array.from(document.querySelectorAll<HTMLElement>(".sticker-item.selected"));
      if (!selected.length) return;
      selected.forEach((node) => {
        const dateKey = node.dataset.dateKey || "";
        const stickerId = node.dataset.stickerId || "";
        if (!dateKey || !stickerId) return;
        deleteStickerFromState(dateKey, stickerId);
      });
      saveLocalState();
      renderCalendar();
    };

    const createStickerElement = (sticker: StickerData, dateKey: string) => {
      const el = document.createElement("div");
      el.className = "sticker-item";
      el.dataset.stickerId = sticker.id;
      el.dataset.dateKey = dateKey;
      el.style.width = `${sticker.width}px`;
      el.style.height = `${sticker.height}px`;
      el.style.transform = `translate(${sticker.x}px, ${sticker.y}px) rotate(${sticker.rotation}deg)`;
      el.style.zIndex = String(sticker.z || 1);

      const img = document.createElement("img");
      img.src = sticker.src;
      img.alt = "sticker";
      img.draggable = false;

      const del = document.createElement("button");
      del.className = "sticker-delete";
      del.type = "button";
      del.textContent = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        const selected = Array.from(document.querySelectorAll<HTMLElement>(".sticker-item.selected"));
        const isSelected = el.classList.contains("selected");
        if (selected.length > 1 && isSelected) {
          deleteSelectedStickers();
          return;
        }
        deleteStickerFromState(dateKey, sticker.id);
        saveLocalState();
        renderCalendar();
      });

      const handles = ["br"].map((pos) => {
        const h = document.createElement("div");
        h.className = `sticker-handle ${pos}`;
        return h;
      });

      el.appendChild(img);
      el.appendChild(del);
      handles.forEach((h) => el.appendChild(h));

      let dragActive = false;
      let resizeActive = false;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;
      let startLeft = 0;
      let startTop = 0;
      let handleDir = "";

      const onPointerMove = (e: PointerEvent) => {
        if (!dragActive && !resizeActive) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let nextW = startW;
        let nextH = startH;
        let nextX = startLeft;
        let nextY = startTop;

        if (dragActive) {
          nextX = startLeft + dx;
          nextY = startTop + dy;
        } else if (resizeActive) {
          if (handleDir.includes("r")) nextW = Math.max(24, startW + dx);
          if (handleDir.includes("l")) {
            nextW = Math.max(24, startW - dx);
            nextX = startLeft + dx;
          }
          if (handleDir.includes("b")) nextH = Math.max(24, startH + dy);
          if (handleDir.includes("t")) {
            nextH = Math.max(24, startH - dy);
            nextY = startTop + dy;
          }
        }

        if (resizeActive) {
          el.style.width = `${nextW}px`;
          el.style.height = `${nextH}px`;
        }
        el.style.transform = `translate(${nextX}px, ${nextY}px) rotate(${sticker.rotation}deg)`;
      };

      const onPointerUp = () => {
        if (!dragActive && !resizeActive) return;
        const wasResize = resizeActive;
        dragActive = false;
        resizeActive = false;
        const rect = el.getBoundingClientRect();
        const targetCell = findDayCellFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        if (targetCell && targetCell.dataset.date && targetCell.dataset.date !== dateKey) {
          if (moveStickerToCell(dateKey, targetCell, sticker, rect)) {
            renderCalendar();
          }
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          return;
        }
        const matrix = el.style.transform;
        const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(matrix);
        const newX = match ? Number(match[1]) : sticker.x;
        const newY = match ? Number(match[2]) : sticker.y;
        const updates: Partial<StickerData> = { x: newX, y: newY };
        if (wasResize) {
          updates.width = parseFloat(el.style.width);
          updates.height = parseFloat(el.style.height);
        }
        updateStickerInState(dateKey, sticker.id, updates);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      el.addEventListener("pointerdown", (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("sticker-delete")) return;
        const handle = target.closest(".sticker-handle") as HTMLElement | null;
        selectSticker(el, dateKey, e.shiftKey);
        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startW = rect.width;
        startH = rect.height;
        const current = el.style.transform;
        const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(current);
        startLeft = match ? Number(match[1]) : sticker.x;
        startTop = match ? Number(match[2]) : sticker.y;
        if (handle) {
          resizeActive = true;
          handleDir = handle.className.split(" ").slice(-1)[0];
        } else {
          dragActive = true;
        }
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        e.preventDefault();
      });

      el.addEventListener("pointerenter", () => {
        stickerPointerActive = true;
      });
      el.addEventListener("pointerleave", () => {
        stickerPointerActive = false;
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        selectSticker(el, dateKey, (e as MouseEvent).shiftKey);
      });

      return el;
    };

    const cleanupDoneSection = (cell: HTMLElement | null) => {
      if (!cell) return;
      const doneSection = cell.querySelector<HTMLElement>(`.day-section[data-section-id="${DONE_SECTION_ID}"]`);
      if (!doneSection) return;
      const doneBody = doneSection.querySelector(".day-section-body");
      const hasCards = !!doneBody?.querySelector(".card");
      if (!hasCards) {
        if (cell.dataset.activeSectionId === DONE_SECTION_ID) {
          setActiveSection(cell, "default");
        }
        doneSection.remove();
      }
    };

    const setActiveSection = (cell: HTMLElement | null, sectionId?: string | null) => {
      if (!cell) return;
      const targetId = sectionId || "default";
      cell.dataset.activeSectionId = targetId;
      const sections = cell.querySelectorAll<HTMLElement>(".day-section");
      sections.forEach((section) => {
        section.classList.toggle("active-section", section.dataset.sectionId === targetId);
      });
    };

    const getActiveSectionBody = (cell: HTMLElement | null) => {
      if (!cell) return null;
      const targetId = cell.dataset.activeSectionId || "default";
      return (
        getSectionBodyById(cell, targetId) ||
        (cell.querySelector(".day-section-body") as HTMLElement | null)
      );
    };

    const updateSectionHints = (cell: HTMLElement | null) => {
      if (!cell) return;
      const sections = cell.querySelectorAll<HTMLElement>(".day-section");
      sections.forEach((section) => {
        const body = section.querySelector(".day-section-body");
        if (!body) return;
        const hint = body.querySelector<HTMLElement>(".day-empty-hint");
        if (!hint) return;
        if (section.dataset.sectionId === "default") {
          hint.style.display = body.querySelector(".card") ? "none" : "block";
        } else {
          hint.style.display = "none";
        }
      });
    };

    const reorderSections = (dateKey: string, sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const list = ensureSectionList(dateKey);
      const sourceIdx = list.findIndex((s) => s.id === sourceId);
      const targetIdx = list.findIndex((s) => s.id === targetId);
      if (sourceIdx < 0 || targetIdx < 0) return;
      const [moved] = list.splice(sourceIdx, 1);
      list.splice(targetIdx, 0, moved);
      list.forEach((s, idx) => {
        s.order = idx;
      });
      saveLocalState();
    };

    const deleteSection = (dateKey: string, sectionId: string, cell: HTMLElement | null) => {
      if (sectionId === "default" || sectionId === DONE_SECTION_ID) return;
      if (!confirm("라인을 삭제할까요?")) return;
      const list = ensureSectionList(dateKey);
      const idx = list.findIndex((s) => s.id === sectionId);
      if (idx < 0) return;
      list.splice(idx, 1);
      list.forEach((s, i) => {
        s.order = i;
      });

      const cards = getCardsForDate(dateKey);
      cards.forEach((card) => {
        if ((card.sectionId || "default") === sectionId) {
          card.sectionId = "default";
          card.sectionTitle = getSectionTitle(dateKey, "default");
        }
      });

      if (cell && cell.dataset.activeSectionId === sectionId) {
        setActiveSection(cell, "default");
      }
      saveLocalState();
      renderCalendar();
    };

    const setSectionTitle = (dateKey: string, sectionId: string, title: string) => {
      const list = ensureSectionList(dateKey);
      const target = list.find((s) => s.id === sectionId);
      if (target) {
        target.title = title;
        saveLocalState();
      }
    };

    const getSectionTitle = (dateKey: string, sectionId: string) => {
      const list = getSectionsForDate(dateKey);
      return list.find((s) => s.id === sectionId)?.title || "";
    };

    const ensureCardList = (dateKey: string) => {
      if (!Array.isArray(state.cards[dateKey])) state.cards[dateKey] = [];
      return state.cards[dateKey];
    };

    function upsertCard(dateKey: string, cardObj: CardData, persist = false) {
      const list = ensureCardList(dateKey);
      if (!cardObj.boardId) {
        cardObj.boardId = activeTabId;
      }
      const id = cardObj.id;
      const idx = list.findIndex((c) => c.id === id);
      if (idx >= 0) list[idx] = cardObj;
      else list.push(cardObj);
      saveLocalState();
      if (persist) {
        void upsertCardToSupabase(dateKey, cardObj);
      }
    }

    function deleteCardFromState(dateKey: string, id: string) {
      const list = state.cards[dateKey];
      if (!Array.isArray(list)) return false;
      const initLen = list.length;
      state.cards[dateKey] = list.filter((c) => c.id !== id);
      const deleted = state.cards[dateKey].length < initLen;
      if (state.cards[dateKey].length === 0) delete state.cards[dateKey];
      if (deleted) saveLocalState();
      return deleted;
    }

    function applyCardColorClass(card: HTMLElement, colorKey: string) {
      card.classList.remove("color-yellow", "color-green", "color-pink");
      if (colorKey === "yellow") card.classList.add("color-yellow");
      else if (colorKey === "green") card.classList.add("color-green");
      else if (colorKey === "pink") card.classList.add("color-pink");
    }

    function updateDayBadge(dateKey: string) {
      const cell = document.querySelector(`.day-cell[data-date="${dateKey}"]`);
      if (!cell) return;
      const metaEl = cell.querySelector(".day-meta");
      if (!metaEl) return;
      const isToday = cell.classList.contains("today");
      (metaEl as HTMLElement).textContent = isToday ? "오늘" : "";
    }

    function syncOneCardFromDom(card: HTMLDivElement, shouldPush = true) {
      const dateKey = card.dataset.date;
      const idStr = card.dataset.cardId;
      if (!dateKey || !idStr) return;
      const id = idStr;

      const content = card.querySelector(".card-content");
      const text = content ? normalizeCardHtmlForSave(content.innerHTML ?? "") : "";
      const done = card.classList.contains("done");
      const color = card.dataset.color || "default";
      const boardId = card.dataset.boardId || activeTabId;
      const sectionId = card.dataset.sectionId || "default";
      const sectionTitle = card.dataset.sectionTitle || getSectionTitle(dateKey, sectionId);
      const originSectionId = card.dataset.originSectionId || undefined;
      const originSectionTitle = card.dataset.originSectionTitle || undefined;
      const originDateKey = card.dataset.originDateKey || undefined;
      const list = getCardsForDate(dateKey);
      const prev = list.find((c) => c.id === id);
      const changed =
        !prev ||
        prev.text !== text ||
        prev.done !== done ||
        prev.color !== color ||
        prev.boardId !== boardId ||
        prev.sectionId !== sectionId ||
        prev.sectionTitle !== sectionTitle ||
        prev.originSectionId !== originSectionId ||
        prev.originSectionTitle !== originSectionTitle ||
        prev.originDateKey !== originDateKey;
      upsertCard(
        dateKey,
        {
          id,
          text,
          done,
          color,
          boardId,
          sectionId,
          sectionTitle,
          originSectionId,
          originSectionTitle,
          originDateKey,
        },
        true,
      );
      if (changed && shouldPush) {
        pushHistory();
      }
    }

    function syncCurrentMonthFromDom() {
      const dayCells = document.querySelectorAll<HTMLDivElement>(".day-cell[data-date]");
      dayCells.forEach((cell) => {
        const dateKey = cell.dataset.date;
        if (!dateKey) return;
        const cards = Array.from(cell.querySelectorAll<HTMLDivElement>(".card"));
        if (cards.length === 0) {
          delete state.cards[dateKey];
          return;
        }
        ensureDefaultSection(dateKey);
        const list: CardData[] = [];
        cards.forEach((card) => {
          const idStr = card.dataset.cardId;
          if (!idStr) return;
          const content = card.querySelector(".card-content");
          const text = content ? normalizeCardHtmlForSave(content.innerHTML ?? "") : "";
          const done = card.classList.contains("done");
          const color = card.dataset.color || "default";
          const boardId = card.dataset.boardId || activeTabId;
          const sectionId = card.dataset.sectionId || "default";
          const sectionTitle = card.dataset.sectionTitle || getSectionTitle(dateKey, sectionId);
          const originSectionId = card.dataset.originSectionId || undefined;
          const originSectionTitle = card.dataset.originSectionTitle || undefined;
          const originDateKey = card.dataset.originDateKey || undefined;
          if (sectionId !== "done") {
            const sections = ensureSectionList(dateKey);
            if (!sections.some((s) => s.id === sectionId)) {
              sections.push({ id: sectionId, title: sectionTitle || "", order: sections.length });
            }
          }
          list.push({
            id: idStr,
            text,
            done,
            color,
            boardId,
            sectionId,
            sectionTitle,
            originSectionId,
            originSectionTitle,
            originDateKey,
          });
        });
        state.cards[dateKey] = list;
      });
    }

    function makeEditable(card: HTMLDivElement) {
      const content = card.querySelector(".card-content") as HTMLDivElement | null;
      if (!content || content.isContentEditable) return;
      const safeContent: HTMLDivElement = content;

      let finished = false;
      let isComposing = false;
      let pendingFinish = false;
      editingCardId = card.dataset.cardId || null;

      safeContent.contentEditable = "true";
      safeContent.focus();
      const range = document.createRange();
      range.selectNodeContents(safeContent);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      function finishEditing() {
        if (finished) return;
        finished = true;
        editingCardId = null;
        safeContent.removeEventListener("blur", onBlur);
        safeContent.removeEventListener("keydown", onKey);
        safeContent.removeEventListener("compositionstart", onCompositionStart);
        safeContent.removeEventListener("compositionend", onCompositionEnd);
        safeContent.removeEventListener("compositioncancel", onCompositionEnd);
        safeContent.contentEditable = "false";
        syncOneCardFromDom(card);
      }

      function onBlur() {
        setTimeout(() => {
          if (keepFocusFromPalette || keepFocusFromToolbar) {
            safeContent.focus();
            return;
          }
          const active = document.activeElement as HTMLElement | null;
          if (active && active.closest(".text-toolbar")) {
            safeContent.focus();
            return;
          }
          if (isComposing) {
            pendingFinish = true;
            return;
          }
          finishEditing();
        }, 0);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          pendingFinish = true;
          safeContent.blur();
        }
      }
      function onCompositionStart() {
        isComposing = true;
      }
      function onCompositionEnd() {
        isComposing = false;
        if (pendingFinish) {
          pendingFinish = false;
          finishEditing();
        }
      }
      safeContent.addEventListener("blur", onBlur);
      safeContent.addEventListener("keydown", onKey);
      safeContent.addEventListener("compositionstart", onCompositionStart);
      safeContent.addEventListener("compositionend", onCompositionEnd);
      safeContent.addEventListener("compositioncancel", onCompositionEnd);
    }

    function createCard(
      container: HTMLElement,
      cardData?: Partial<CardData>,
      options?: { autoEdit?: boolean; fromState?: boolean },
    ) {
      const opts = Object.assign({ autoEdit: true, fromState: false }, options || {});
      const hint = container.querySelector(".day-empty-hint") as HTMLElement | null;
      if (hint) hint.style.display = "none";

      const card = document.createElement("div");
      card.className = "card";
      const handle = document.createElement("div");
      handle.className = "card-handle";
      const doneBadge = document.createElement("div");
      doneBadge.className = "card-done-badge";
      doneBadge.textContent = "✓";
      const content = document.createElement("div");
      content.className = "card-content";
      content.dataset.placeholder = "새 할 일을 적어보세요";

      const toolbar = document.createElement("div");
      toolbar.className = "card-toolbar";
      const btnEmoji = document.createElement("button");
      btnEmoji.className = "card-btn card-btn-emoji";
      btnEmoji.textContent = "😊";
      const btnDone = document.createElement("button");
      btnDone.className = "card-btn card-btn-done";
      btnDone.textContent = "✓";
      const btnColor = document.createElement("button");
      btnColor.className = "card-btn card-btn-color";
      btnColor.textContent = "색";
      const btnDelete = document.createElement("button");
      btnDelete.className = "card-btn card-btn-delete";
      btnDelete.textContent = "×";
      toolbar.appendChild(btnEmoji);
      toolbar.appendChild(btnColor);
      toolbar.appendChild(btnDone);
      toolbar.appendChild(btnDelete);

      btnEmoji.addEventListener("mousedown", (e) => {
        handleEmojiTriggerMouseDown(btnEmoji, e);
      });
      btnEmoji.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleEmojiPaletteForTrigger(btnEmoji, false);
      });

      const sectionEl = container.closest(".day-section") as HTMLElement | null;
      const dayCell = container.closest(".day-cell") as HTMLElement | null;
      const dateKey = dayCell?.dataset.date;
      const resolvedSectionId = cardData?.sectionId || sectionEl?.dataset.sectionId || "default";
      const isDoneSection = resolvedSectionId === DONE_SECTION_ID;
      const resolvedSectionTitle =
        (isDoneSection ? "완료" : null) ||
        cardData?.sectionTitle ||
        sectionEl?.dataset.sectionTitle ||
        (dateKey ? getSectionTitle(dateKey, resolvedSectionId) : "");
      const text = cardData?.text ?? "";
      const done = isDoneSection ? true : !!cardData?.done;
      const color = cardData?.color ?? "default";
      const id = typeof cardData?.id === "string" ? cardData.id : newId();

      card.dataset.cardId = String(id);
      card.id = `card-${id}`;
      card.dataset.color = color;
      const resolvedBoardId = cardData?.boardId || activeTabId;
      card.dataset.boardId = resolvedBoardId;
      card.dataset.sectionId = resolvedSectionId;
      card.dataset.sectionTitle = resolvedSectionTitle;
      if (cardData?.originSectionId) card.dataset.originSectionId = cardData.originSectionId;
      if (cardData?.originSectionTitle) card.dataset.originSectionTitle = cardData.originSectionTitle;
      if (cardData?.originDateKey) card.dataset.originDateKey = cardData.originDateKey;
      applyCardColorClass(card, color);
      content.innerHTML = renderCardHtml(text || "");

      content.addEventListener("focus", () => {
        lastFocusedContent = content;
        lastActiveCardContent = content;
      });

      content.addEventListener("mouseup", () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          lastRange = sel.getRangeAt(0).cloneRange();
        }
        lastActiveCardContent = content;
      });

      content.addEventListener("keyup", () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          lastRange = sel.getRangeAt(0).cloneRange();
        }
        lastActiveCardContent = content;
      });

      content.addEventListener("blur", () => {
        setTimeout(() => {
          if (keepFocusFromPalette || keepFocusFromToolbar) return;
          const active = document.activeElement as HTMLElement | null;
          if (
            active &&
            (active.closest(".emoji-palette") ||
              active.closest(".card-content") ||
              active.closest(".text-toolbar"))
          ) {
            return;
          }
          lastFocusedContent = null;
          lastRange = null;
          lastActiveCardContent = null;
        }, 0);
      });

      // 복사/붙여넣기: 텍스트+이모지(img dataURL)만 허용
      content.addEventListener("copy", (e) => {
        const sel = window.getSelection();
        if (!sel) return;
        const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (!range) return;
        const div = document.createElement("div");
        div.appendChild(range.cloneContents());
        const sanitized = sanitizeToTextAndEmojis(div.innerHTML);
        if (e.clipboardData) {
          e.clipboardData.setData("text/html", sanitized);
          e.clipboardData.setData("text/plain", div.textContent || "");
          e.preventDefault();
        }
      });

      content.addEventListener("paste", (e) => {
        if (!content.isContentEditable) {
          return;
        }
        const jsonData = e.clipboardData?.getData("application/json");
        if (jsonData) {
          let isCardPayload = false;
          try {
            const parsed = JSON.parse(jsonData);
            if (Array.isArray(parsed)) {
              isCardPayload = parsed.every(
                (c) =>
                  c &&
                  typeof c === "object" &&
                  typeof c.text === "string" &&
                  typeof c.done === "boolean",
              );
            }
          } catch {
            /* ignore */
          }
          if (isCardPayload) {
            e.preventDefault();
            showToast("카드 복사는 카드 밖에서 붙여넣기 해주세요.");
            return;
          }
        }
        const activeEl = document.activeElement as HTMLElement | null;
        const canPaste =
          card.classList.contains("selected") ||
          activeEl === content ||
          lastActiveCardContent === content;
        if (!canPaste) {
          return;
        }
        e.preventDefault();
        const html = e.clipboardData?.getData("text/html");
        const plain = e.clipboardData?.getData("text/plain") ?? "";
        const sanitized = html ? sanitizeToTextAndEmojis(html) : plain;
        if (sanitized) {
          insertAtSelection(sanitized);
          syncOneCardFromDom(card);
          // 안전망
          setTimeout(() => syncOneCardFromDom(card), 0);
        }
      });

      content.addEventListener("dblclick", () => {
        if (!content.isContentEditable) {
          makeEditable(card);
        }
      });

      if (dayCell && dayCell.dataset.date) {
        const key = dayCell.dataset.date;
        card.dataset.date = key;
        if (!opts.fromState) {
          const payload: CardData = {
            id,
            text,
            done,
            color,
            sectionId: resolvedSectionId,
            sectionTitle: resolvedSectionTitle,
            originSectionId: card.dataset.originSectionId,
            originSectionTitle: card.dataset.originSectionTitle,
            originDateKey: card.dataset.originDateKey,
          };
          upsertCard(key, payload, true);
        }
      }

      if (done) {
        card.classList.add("done");
        wrapTextNodesInSpans(content);
      }

      card.appendChild(handle);
      card.appendChild(doneBadge);
      card.appendChild(content);
      card.appendChild(toolbar);
      container.appendChild(card);

      card.addEventListener("click", (e) => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        if (e.shiftKey) {
          e.stopPropagation();
          toggleSelection(card);
          return;
        }
        clearSelection();
        card.classList.add("selected");
        lastSelectedCardId = card.dataset.cardId || null;
        selectionAnchorCardId = lastSelectedCardId;
        const day = card.closest(".day-cell") as HTMLElement | null;
        setActiveDay(day);
        setActiveSection(day, card.dataset.sectionId || "default");
        const contentEl = card.querySelector(".card-content") as HTMLDivElement | null;
        if (!contentEl) return;
        if (editingCardId && editingCardId !== card.dataset.cardId) {
          contentEl.blur();
          contentEl.contentEditable = "false";
        }
        // 엑셀처럼 한 번 클릭으로 바로 편집: 이미 편집 중이면 makeEditable이 no-op 처리.
        makeEditable(card);
      });

      btnDone.addEventListener("click", (e) => {
        e.stopPropagation();
        // 완료 처리해도 카드를 다른 섹션으로 옮기지 않고 제자리에서 스타일만 바꾼다.
        const cell = card.closest(".day-cell") as HTMLElement | null;
        card.classList.toggle("done");
        if (card.classList.contains("done")) {
          const contentEl = card.querySelector(".card-content") as HTMLElement | null;
          if (contentEl) wrapTextNodesInSpans(contentEl);
        }
        syncOneCardFromDom(card);
        syncCurrentMonthFromDom();
        saveLocalState();
        const dKey = card.dataset.date;
        if (dKey) updateDayBadge(dKey);
        if (cell) updateSectionHints(cell);
      });

      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        const isSelected = card.classList.contains("selected");
        if (selectedCards.length > 1 && isSelected) {
          deleteCards(selectedCards);
          return;
        }
        deleteCards([card]);
      });

      btnColor.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentColor = card.dataset.color || "default";
        const idx = CARD_COLORS.indexOf(currentColor as (typeof CARD_COLORS)[number]);
        const nextColor = CARD_COLORS[(idx + 1 + CARD_COLORS.length) % CARD_COLORS.length];
        card.dataset.color = nextColor;
        applyCardColorClass(card, nextColor);
        syncOneCardFromDom(card);
        // 안전망: DOM 기준으로 재저장
        syncCurrentMonthFromDom();
        saveLocalState();
      });

      handle.draggable = true;
      handle.addEventListener("dragstart", (e) => {
        if (!card.classList.contains("selected")) {
          clearSelection();
          toggleSelection(card);
        }

        draggingCards = Array.from(
          document.querySelectorAll<HTMLDivElement>(".card.selected"),
        );
        if (!draggingCards.includes(card)) {
          draggingCards.push(card);
        }

        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        setTimeout(() => {
          draggingCards.forEach((c) => {
            c.style.opacity = "0.4";
          });
        }, 0);
      });

      handle.addEventListener("dragend", () => {
        if (draggingCards) {
          draggingCards.forEach((c) => {
            c.style.opacity = "1";
          });
        }
        draggingCards = [];

        const targets = document.querySelectorAll(".day-cell.drop-target");
        targets.forEach((c) => c.classList.remove("drop-target"));
        if (dragPlaceholder && dragPlaceholder.parentElement) {
          dragPlaceholder.parentElement.removeChild(dragPlaceholder);
        }
      dragPlaceholder = null;
    });

      if (opts.autoEdit) {
        makeEditable(card);
      }

      return card;
    }

    function renderCalendar() {
      if (!calendarGrid) return;
      collapseExpandedCell();
      calendarGrid.innerHTML = "";
      lastActiveDayCell = null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 현재 표시 범위: startCursor ~ endCursor
      const viewYear = current.getFullYear();
      const viewMonth = current.getMonth();
      const startMonth = new Date(startCursor);
      const endMonth = new Date(endCursor);

      const firstOfRange = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
      const lastOfRange = new Date(endMonth.getFullYear(), endMonth.getMonth(), 0); // endCursor는 다음달 1일(제외)

      const startDate = new Date(firstOfRange);
      const endDate = new Date(lastOfRange);
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
      const columns = showWeekend ? 7 : 5;
      let leadingEmpty = 0;
      if (showWeekend) {
        leadingEmpty = (startDate.getDay() + 6) % 7; // Monday-first
      } else {
        const wd = startDate.getDay();
        leadingEmpty = wd >= 1 && wd <= 5 ? wd - 1 : 0; // Monday-first, weekends hidden
      }
      let renderedCount = 0;

      // 주(week) 단위로 독립된 그리드를 만들어서, 칸 너비 조정이 그 주에만 적용되게 한다.
      const mondayOfFirstRow = new Date(startDate);
      mondayOfFirstRow.setDate(mondayOfFirstRow.getDate() - leadingEmpty);
      let currentWeekRow: HTMLDivElement | null = null;
      let colInRow = 0;
      let rowIndex = 0;
      const appendToGrid = (el: HTMLDivElement) => {
        if (!currentWeekRow || colInRow >= columns) {
          const weekStart = new Date(mondayOfFirstRow);
          weekStart.setDate(weekStart.getDate() + rowIndex * 7);
          const weekKey = formatDateKey(weekStart);
          currentWeekRow = document.createElement("div");
          currentWeekRow.className = "week-row-grid";
          currentWeekRow.dataset.weekKey = weekKey;
          applyStoredWeekColumnWidths(currentWeekRow, weekKey);
          calendarGrid!.appendChild(currentWeekRow);
          colInRow = 0;
          rowIndex++;
        }
        const thisColIndex = colInRow;
        currentWeekRow.appendChild(el);
        if (
          el.classList.contains("day-cell") &&
          !el.classList.contains("placeholder") &&
          thisColIndex < columns - 1
        ) {
          el.appendChild(createColumnResizeHandle(thisColIndex));
        }
        colInRow++;
      };

      // 앞쪽 빈 셀로 요일 정렬
      for (let i = 0; i < leadingEmpty; i++) {
        const placeholder = document.createElement("div");
        placeholder.className = "day-cell placeholder";
        appendToGrid(placeholder);
      }

      for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";

        const header = document.createElement("div");
        header.className = "day-header";
        const numEl = document.createElement("div");
        numEl.className = "day-number";
        const metaEl = document.createElement("div");
        metaEl.className = "day-meta";
        const metaWrap = document.createElement("div");
        metaWrap.className = "day-meta-wrap";
        const expandBtn = document.createElement("button");
        expandBtn.className = "day-expand-btn";
        expandBtn.type = "button";
        expandBtn.textContent = "↗";
        expandBtn.title = "확대";

        const sectionsWrap = document.createElement("div");
        sectionsWrap.className = "day-sections";

        const stickerLayer = document.createElement("div");
        stickerLayer.className = "day-sticker-layer";

        const thisDate = new Date(startDate);
        thisDate.setDate(startDate.getDate() + dayIndex);

        const jsDay = thisDate.getDay();
        if (!showWeekend && (jsDay === 0 || jsDay === 6)) {
          continue; // 주말 숨김
        }

        if (thisDate.getMonth() !== viewMonth) {
          cell.classList.add("other-month");
        }

        const w = thisDate.getDay(); // 0(일)~6(토)
        const dayOfMonth = thisDate.getDate();

        const label = WEEKDAY_NAMES_MON_FIRST[w === 0 ? 6 : w - 1];
        const mmdd = `${String(thisDate.getMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(
          2,
          "0",
        )}`;
        const holidayName = FIXED_HOLIDAYS[mmdd] || LUNAR_HOLIDAYS_BY_YEAR[thisDate.getFullYear()]?.[mmdd];
        numEl.textContent = `${thisDate.getMonth() + 1}월 ${dayOfMonth}일(${label})${
          holidayName ? ` ${holidayName}` : ""
        }`;
        if (w === 0 || holidayName) numEl.classList.add("sun", "holiday");
        else if (w === 6) numEl.classList.add("sat");

        const key = formatDateKey(thisDate);
        cell.dataset.date = key;

        const cmp = new Date(thisDate.getTime());
        cmp.setHours(0, 0, 0, 0);
        if (cmp.getTime() === today.getTime()) {
          cell.classList.add("today");
          metaEl.textContent = "오늘";
        }

        ensureDefaultSection(key);
        const sections = [{ id: "default", title: "", order: 0 }];
        const cards = getCardsForDate(key);
        // 완료 처리된 카드도 별도 섹션으로 옮기지 않고 원래 자리에 그대로 둔다
        // (완료 표시는 .done 클래스로만 처리).
        const cardsBySection = new Map<string, CardData[]>();
        cards.forEach((card) => {
          const sectionId = "default";
          if (!cardsBySection.has(sectionId)) cardsBySection.set(sectionId, []);
          cardsBySection.get(sectionId)!.push(card);
        });

        sections.forEach((section) => {
          const sectionEl = document.createElement("div");
          sectionEl.className = "day-section";
          sectionEl.dataset.sectionId = section.id;
          sectionEl.dataset.sectionTitle = section.title || "";

          const sectionHeader = document.createElement("div");
          sectionHeader.className = "day-section-header";
          sectionHeader.addEventListener("click", () => {
            setActiveDay(cell);
            setActiveSection(cell, section.id);
          });
          sectionHeader.draggable = true;
          sectionHeader.addEventListener("dragstart", (e) => {
            e.dataTransfer?.setData("text/plain", section.id);
            e.dataTransfer?.setData("text/day-date", key);
            e.dataTransfer?.setDragImage(sectionHeader, 0, 0);
          });
          sectionHeader.addEventListener("dragover", (e) => {
            e.preventDefault();
            sectionHeader.classList.add("drag-over");
          });
          sectionHeader.addEventListener("dragleave", () => {
            sectionHeader.classList.remove("drag-over");
          });
          sectionHeader.addEventListener("drop", (e) => {
            e.preventDefault();
            sectionHeader.classList.remove("drag-over");
            const sourceId = e.dataTransfer?.getData("text/plain") || "";
            const sourceDate = e.dataTransfer?.getData("text/day-date") || "";
            if (!sourceId || sourceDate !== key) return;
            reorderSections(key, sourceId, section.id);
            renderCalendar();
          });

          const sectionBody = document.createElement("div");
          sectionBody.className = "day-section-body";
          sectionBody.addEventListener("mouseenter", () => {
            if (stickerPointerActive) return;
            setActiveDay(cell);
            setActiveSection(cell, section.id);
          });

          const sectionCards = cardsBySection.get(section.id) || [];
          if (section.id === "default" && sectionCards.length === 0) {
            const hint = document.createElement("div");
            hint.className = "day-empty-hint";
            hint.textContent = "더블클릭해서 카드 추가";
            sectionBody.appendChild(hint);
          }

          sectionCards.forEach((data) => {
            createCard(sectionBody, data, { autoEdit: false, fromState: true });
          });

          sectionEl.appendChild(sectionHeader);
          sectionEl.appendChild(sectionBody);
          sectionsWrap.appendChild(sectionEl);
        });

        updateDayBadge(key);

        const stickers = getStickersForDate(key);
        if (stickers.length > 0) {
          cell.classList.add("has-sticker");
        }
        stickers.forEach((sticker) => {
          stickerLayer.appendChild(createStickerElement(sticker, key));
        });

        metaWrap.appendChild(numEl);
        metaWrap.appendChild(metaEl);
        header.appendChild(metaWrap);
        header.appendChild(expandBtn);
        cell.appendChild(header);
        cell.appendChild(sectionsWrap);
        cell.appendChild(stickerLayer);

        const stickerBtn = document.createElement("button");
        stickerBtn.className = "day-sticker-btn";
        stickerBtn.type = "button";
        stickerBtn.textContent = "➕";
        stickerBtn.title = "스티커 추가";
        stickerBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          activeStickerTarget = cell;
          openStickerPalette(stickerBtn);
        });
        cell.appendChild(stickerBtn);
        appendToGrid(cell);

        if (!cell.dataset.activeSectionId) {
          cell.dataset.activeSectionId = "default";
        }
        setActiveSection(cell, cell.dataset.activeSectionId);

        cell.addEventListener("mouseenter", () => {
          if (stickerPointerActive) return;
          if (cell.classList.contains("sticker-hover-cell")) return;
          if (cell.classList.contains("active-day")) return;
          cell.classList.add("hovered-day");
        });

        cell.addEventListener("mouseleave", () => {
          if (stickerPointerActive) return;
          if (cell.classList.contains("sticker-hover-cell")) return;
          if (cell.classList.contains("active-day")) return;
          cell.classList.remove("hovered-day");
        });

        cell.addEventListener("click", (e) => {
          const target = e.target as HTMLElement | null;
          if (target && target.closest(".card")) {
            return;
          }
          setActiveDay(cell);
          const active = document.activeElement as HTMLElement | null;
          if (active && active.closest(".card-content")) {
            active.blur();
          }
        });

        expandBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (expandedCell === cell) {
            collapseExpandedCell();
          } else {
            expandDayCell(cell);
          }
        });

        cell.addEventListener("dblclick", (e) => {
          if (!cell.dataset.date) return;
          const target = e.target as HTMLElement | null;
          if (!target) return;
          if (target.closest(".card")) return;
          if (target.closest(".day-section-header")) return;
          if (target.closest(".day-header")) return;
          if (target.closest(".day-expand-btn")) return;
          const body = getSectionBodyById(cell, "default") || getActiveSectionBody(cell);
          if (!body) return;
          createCard(body, { text: "", done: false, color: "default" }, { autoEdit: true, fromState: false });
          updateDayBadge(cell.dataset.date);
          setActiveDay(cell);
          setActiveSection(cell, "default");
          pushHistory();
        });

        cell.addEventListener("dragover", (e) => {
          if (!draggingCards || draggingCards.length === 0) return;
          e.preventDefault();

          const allCells = document.querySelectorAll(".day-cell.drop-target");
          allCells.forEach((c) => c.classList.remove("drop-target"));
          cell.classList.add("drop-target");

          const activeSectionId = cell.dataset.activeSectionId || "default";
          const targetSectionId = draggingCards.some((c) => c.classList.contains("done"))
            ? DONE_SECTION_ID
            : activeSectionId;
          const bodyEl =
            targetSectionId === DONE_SECTION_ID
              ? ensureDoneSectionBody(cell)
              : getSectionBodyById(cell, targetSectionId) || getActiveSectionBody(cell);
          if (!bodyEl) return;

          if (!dragPlaceholder) {
            dragPlaceholder = document.createElement("div");
            dragPlaceholder.className = "card-placeholder";
          }

          const cardsInBody = Array.from(bodyEl.querySelectorAll<HTMLDivElement>(".card"));
          const filtered = cardsInBody.filter((c) => !draggingCards.includes(c));

          if (filtered.length === 0) {
            if (dragPlaceholder.parentElement !== bodyEl) {
              bodyEl.appendChild(dragPlaceholder);
            }
            return;
          }

          const mouseY = e.clientY;
          let inserted = false;
          for (const cardEl of filtered) {
            const rect = cardEl.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (mouseY < midY) {
              if (dragPlaceholder.parentElement !== bodyEl || dragPlaceholder.nextSibling !== cardEl) {
                bodyEl.insertBefore(dragPlaceholder, cardEl);
              }
              inserted = true;
              break;
            }
          }

          if (!inserted) {
            if (dragPlaceholder.parentElement !== bodyEl || dragPlaceholder.nextSibling != null) {
              bodyEl.appendChild(dragPlaceholder);
            }
          }
        });

        cell.addEventListener("drop", (e) => {
          e.preventDefault();
          if (!draggingCards || draggingCards.length === 0 || !cell.dataset.date) return;
          const newKey = cell.dataset.date;
          const activeSectionId = cell.dataset.activeSectionId || "default";
          const targetSectionId = draggingCards.some((c) => c.classList.contains("done"))
            ? DONE_SECTION_ID
            : activeSectionId;
          const bodyEl =
            targetSectionId === DONE_SECTION_ID
              ? ensureDoneSectionBody(cell)
              : getSectionBodyById(cell, targetSectionId) || getActiveSectionBody(cell);
          if (!bodyEl) return;

          if (dragPlaceholder && dragPlaceholder.parentElement === bodyEl) {
            draggingCards.forEach((c) => bodyEl.insertBefore(c, dragPlaceholder));
          } else {
            draggingCards.forEach((c) => bodyEl.appendChild(c));
          }

          const affectedDateKeys = new Set<string>();
          affectedDateKeys.add(newKey);

          draggingCards.forEach((card) => {
            const oldKey = card.dataset.date;
            if (oldKey) affectedDateKeys.add(oldKey);

            card.dataset.date = newKey;

            const prevSectionId = card.dataset.sectionId || "default";
            const prevSectionTitle = card.dataset.sectionTitle || getSectionTitle(oldKey || newKey, prevSectionId);
            const nextSectionId = targetSectionId;
            const nextSectionTitle = getSectionTitle(newKey, nextSectionId);
            card.dataset.sectionId = nextSectionId;
            card.dataset.sectionTitle = nextSectionTitle;

            if (nextSectionId === DONE_SECTION_ID) {
              card.classList.add("done");
              if (!card.dataset.originSectionId) {
                card.dataset.originSectionId = prevSectionId;
                card.dataset.originSectionTitle = prevSectionTitle;
                card.dataset.originDateKey = oldKey || newKey;
              }
            } else {
              card.classList.remove("done");
            }

            if (oldKey && oldKey !== newKey) {
              const id = card.dataset.cardId;
              if (id) {
                const oldList = getCardsForDate(oldKey);
                const idx = oldList.findIndex((c) => c.id === id);
                let obj: CardData | null = null;
                if (idx >= 0) {
                  obj = oldList.splice(idx, 1)[0];
                  if (oldList.length === 0) delete state.cards[oldKey];
                }

                if (obj) {
                  const newList = ensureCardList(newKey);
                  newList.push({ ...obj, id: obj.id });
                }
              }
            }
          });

          draggingCards.forEach((card) => syncOneCardFromDom(card, false));
          // 드래그 결과로 DOM 순서가 바뀌므로 전체 상태를 DOM 기준으로 재구성
          syncCurrentMonthFromDom();
          saveLocalState();
          saveState();

          affectedDateKeys.forEach((key) => {
            updateDayBadge(key);
            const cellEl = document.querySelector(`.day-cell[data-date="${key}"]`);
            if (cellEl) {
              updateSectionHints(cellEl as HTMLElement);
              cleanupDoneSection(cellEl as HTMLElement);
            }
          });

          const targets = document.querySelectorAll(".day-cell.drop-target");
          targets.forEach((c) => c.classList.remove("drop-target"));

          if (dragPlaceholder && dragPlaceholder.parentElement) {
            dragPlaceholder.parentElement.removeChild(dragPlaceholder);
          }
          if (draggingCards) {
            draggingCards.forEach((c) => {
              c.style.opacity = "1";
            });
          }
          dragPlaceholder = null;
          draggingCards = [];
          pushHistory();
        });
      }

      // 뒷쪽 빈 셀로 마지막 주 채우기
      const totalCells = leadingEmpty + renderedCount;
      const trailing = (columns - (totalCells % columns)) % columns;
      for (let i = 0; i < trailing; i++) {
        const placeholder = document.createElement("div");
        placeholder.className = "day-cell placeholder";
        appendToGrid(placeholder);
      }

      // 선택 유지: 기존 선택된 날짜가 있으면 새 DOM에서 다시 표시
      if (lastActiveDateKey) {
        const activeCell = calendarGrid.querySelector<HTMLElement>(
          `.day-cell[data-date="${lastActiveDateKey}"]`,
        );
        if (activeCell) {
          activeCell.classList.add("active-day");
          lastActiveDayCell = activeCell;
        } else {
          lastActiveDateKey = null;
        }
      }

      // 스크롤 위치 기준으로 월 타이틀을 동기화
      syncMonthHeaderWithScroll();
    }

    const switchSearchScope = (mode: "month" | "all") => {
      searchMode = mode;
      if (mode === "month") {
        scopeMonthBtn.classList.add("active");
        scopeAllBtn.classList.remove("active");
        searchInput.placeholder = "이 달에서 검색";
      } else {
        scopeMonthBtn.classList.remove("active");
        scopeAllBtn.classList.add("active");
        searchInput.placeholder = "전체 기간 검색";
      }
      searchInput.focus();
    };

    function showToast(message: string) {
      if (!toastContainer) return;
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "toast-out 0.3s ease forwards";
        toast.addEventListener("animationend", () => {
          toast.remove();
        });
      }, 3000);
    }

    function collapseExpandedCell() {
      if (expandedOverlay) expandedOverlay.classList.remove("open");
      if (expandedCell && expandedPlaceholder && expandedPlaceholder.parentElement) {
        expandedPlaceholder.parentElement.replaceChild(expandedCell, expandedPlaceholder);
      }
      if (expandedCell) expandedCell.classList.remove("expanded");
      expandedCell = null;
      expandedPlaceholder = null;
    }

    function expandDayCell(cell: HTMLElement) {
      if (!expandedOverlay || !expandedContainer) return;
      collapseExpandedCell();
      expandedPlaceholder = document.createElement("div");
      expandedPlaceholder.className = "day-placeholder-slot";
      cell.parentElement?.insertBefore(expandedPlaceholder, cell);
      cell.classList.add("expanded");
      expandedContainer.innerHTML = "";
      expandedContainer.appendChild(cell);
      expandedCell = cell;
      expandedOverlay.classList.add("open");
    }

    function clearSearchHighlights() {
      document.querySelectorAll(".card.search-hit").forEach((c) => {
        c.classList.remove("search-hit");
      });
      if (searchInput) {
        searchInput.classList.remove("error");
      }
    }

    function highlightCard(card: HTMLElement) {
      card.classList.add("search-hit");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        card.classList.remove("search-hit");
      }, 4000);
    }

    function handleSearchFail() {
      if (searchInput) {
        searchInput.classList.add("error");
      }
      showToast("검색 결과 없음");
      setTimeout(() => {
        if (searchInput) {
          searchInput.classList.remove("error");
        }
      }, 1500);
    }

    function runSearch() {
      if (!searchInput) return;
      const q = searchInput.value.trim().toLowerCase();
      clearSearchHighlights();

      if (!q) return;

      if (searchMode === "month") {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
        let found: HTMLElement | null = null;
        for (const card of cards) {
          const text = card.innerText.toLowerCase();
          if (text.includes(q)) {
            found = card;
            break;
          }
        }

        if (found) {
          highlightCard(found);
        } else {
          handleSearchFail();
        }
      } else {
        let foundDateKey: string | null = null;
        let foundCardId: string | null = null;
        const dateKeys = Object.keys(state.cards).sort();

        for (const key of dateKeys) {
          const list = state.cards[key];
          if (!Array.isArray(list)) continue;
          const match = list.find((c) =>
            getPlainTextFromStored(c.text || "").toLowerCase().includes(q),
          );
          if (match) {
            foundDateKey = key;
            foundCardId = match.id;
            break;
          }
        }

        if (foundDateKey && foundCardId) {
          const [y, m] = foundDateKey.split("-").map(Number);
          current = new Date(y, m - 1, 1);
          renderCalendar();

          setTimeout(() => {
            const targetCard = document.querySelector<HTMLElement>(
              `.card[data-card-id="${foundCardId}"]`,
            );
            if (targetCard) {
              highlightCard(targetCard);
            }
          }, 50);
        } else {
          handleSearchFail();
        }
      }
    }

    function ensureAirtableConfig() {
      if (!AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
        alert("Airtable 설정(Base ID / Table Name)이 비어 있습니다.");
        return false;
      }
      if (!AIRTABLE_TOKEN || AIRTABLE_TOKEN.includes("여기에_네_Airtable_토큰_붙여넣기")) {
        alert("Airtable 토큰이 설정되지 않았습니다. pat... 토큰을 AIRTABLE_TOKEN에 넣어주세요.");
        return false;
      }
      return true;
    }

    async function saveToAirtableSnapshot() {
      if (!ensureAirtableConfig()) return;
      try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
          AIRTABLE_TABLE_NAME,
        )}`;
        const snapshotName = new Date().toISOString().slice(0, 19).replace("T", " ");
        const snapshotJson = JSON.stringify(state);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: [
              {
                fields: {
                  cardID: snapshotName,
                  json: snapshotJson,
                },
              },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[Airtable] save error", res.status, res.statusText, text);
          alert(`에어테이블 저장 중 오류가 발생했습니다. (HTTP ${res.status})`);
          return;
        }

        alert("에어테이블에 스냅샷 저장 완료!");
      } catch (e) {
        console.error("saveToAirtableSnapshot error", e);
        alert("에어테이블 저장 중 예외가 발생했습니다. 콘솔을 확인해주세요.");
      }
    }

    async function loadFromAirtableSnapshot() {
      if (!ensureAirtableConfig()) return;
      try {
        const url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
            AIRTABLE_TABLE_NAME,
          )}` + `?maxRecords=1&sort[0][field]=createdTime&sort[0][direction]=desc`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[Airtable] load error", res.status, res.statusText, text);
          alert("에어테이블에서 데이터 불러오기 실패. 콘솔을 확인해주세요.");
          return;
        }

        const data = await res.json();
        if (!data.records || data.records.length === 0) {
          alert("에어테이블에 저장된 스냅샷이 없습니다.");
          return;
        }

        const latest = data.records[0];
        const rawJson = latest.fields.json as string | undefined;
        if (!rawJson) {
          alert("마지막 스냅샷에 json 필드가 없습니다.");
          return;
        }

        const parsed = JSON.parse(rawJson) as Partial<State>;
        if (!parsed || typeof parsed !== "object" || !parsed.cards) {
          alert("스냅샷 구조가 예상과 다릅니다.");
          return;
        }

        state = {
          cards: parsed.cards ?? {},
          sections: parsed.sections ?? {},
          weekVisibility: parsed.weekVisibility ?? {},
          stickers: parsed.stickers ?? {},
        };
        ensureCardBoardIds(activeTabId);
        renderCalendar();
        alert("에어테이블 스냅샷을 불러왔습니다!");
      } catch (e) {
        console.error("loadFromAirtableSnapshot error", e);
        alert("에어테이블에서 데이터 불러오는 중 예외가 발생했습니다. 콘솔을 확인해주세요.");
      }
    }

    loadTabs();
    ensureTabs();
    loadActiveTab();
    renderTabs();
    loadWeekColumnWidths();

    // 카드의 selected 클래스가 바뀔 때마다(클릭/Shift+클릭/드래그 다중선택/방향키 선택 등
    // 여러 경로가 있어 각각 훅을 걸지 않고) 그룹 선택 테두리를 다시 계산한다.
    if (calendarGrid) {
      const selectionObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "class") {
            const el = m.target as HTMLElement;
            if (el.classList && el.classList.contains("card")) {
              updateSelectionOutlineBox();
              break;
            }
          }
        }
      });
      selectionObserver.observe(calendarGrid, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true,
      });
    }

    loadState()
      .then(() => {
        pushHistory();
        loadScale();
        renderCalendar();
        // 새로고침 직후에도 TODAY를 눌렀을 때와 같은 화면(오늘 중심)에서 시작하도록
        scrollToTodayCell("auto");
        // 3초마다 주기 동기화 (Supabase + 로컬)
        if (!previewMode) {
          periodicSyncTimer.current = window.setInterval(() => {
            void periodicSync();
          }, 3000);
        }
      })
      .catch((err) => {
        console.error("loadState error", err);
        renderCalendar();
      });

    // 편집 중 blur 없이 탭을 닫거나 새로고침하면 마지막 입력이 저장되지 않고
    // 유실될 수 있어, 페이지가 사라지기 직전 편집 중이던 카드를 강제로 flush한다.
    // (supabase 클라이언트는 keepalive fetch를 사용하므로 요청이 페이지 종료 후에도 이어진다)
    function flushEditingCardBeforeLeave() {
      if (editingCardId) {
        const activeCard = document.querySelector<HTMLDivElement>(
          `.card[data-card-id="${editingCardId}"]`,
        );
        if (activeCard) syncOneCardFromDom(activeCard, false);
      }
      saveLocalState();
    }
    window.addEventListener("beforeunload", flushEditingCardBeforeLeave);
    window.addEventListener("pagehide", flushEditingCardBeforeLeave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushEditingCardBeforeLeave();
    });

    // 이전/다음 달 버튼: 인피니트 스크롤과 함께 범위 재설정
    // prev/next 버튼은 숨김 상태 (동작 비활성)

    // TODAY 버튼과 새로고침 직후 초기 로딩 둘 다, 오늘 칸을 화면 중앙에 오도록
    // 스크롤한다는 점에서 동일해야 하므로 로직을 공유한다.
    function scrollToTodayCell(behavior: ScrollBehavior) {
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLDivElement>(".day-cell.today");
        if (target) {
          const container = calendarWrapper || document.documentElement;
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          // 실제 화면상 위치(getBoundingClientRect)를 기준으로 오늘 칸의 중심을
          // 스크롤 영역 중심에 맞춘다. 헤더 높이를 하드코딩해서 추정하지 않는다.
          const targetCenter = targetRect.top + targetRect.height / 2;
          const containerCenter = containerRect.top + containerRect.height / 2;
          const delta = targetCenter - containerCenter;
          const offset = container.scrollTop + delta;
          skipAutoExtend = true;
          container.scrollTo({ top: Math.max(offset, 0), behavior });
          setTimeout(
            () => {
              skipAutoExtend = false;
              syncMonthHeaderWithScroll();
            },
            behavior === "smooth" ? 450 : 50,
          );
        } else if (calendarWrapper) {
          skipAutoExtend = true;
          calendarWrapper.scrollTop = 0;
          setTimeout(() => {
            skipAutoExtend = false;
            syncMonthHeaderWithScroll();
          }, 120);
        }
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        syncCurrentMonthFromDom();
        const now = new Date();
        current = new Date(now.getFullYear(), now.getMonth(), 1);
        startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
        endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        renderCalendar();
        scrollToTodayCell("smooth");
      });
    }

    scopeMonthBtn.addEventListener("click", () => switchSearchScope("month"));
    scopeAllBtn.addEventListener("click", () => switchSearchScope("all"));

    searchBtn.addEventListener("click", runSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
    });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      });
    }

    const closeHelp = () => {
      if (helpModal) helpModal.classList.remove("open");
    };

    const openHelp = () => {
      if (helpModal) helpModal.classList.add("open");
    };

    if (helpButton) {
      helpButton.addEventListener("click", () => {
        if (helpModal?.classList.contains("open")) {
          closeHelp();
        } else {
          openHelp();
        }
      });
    }

    if (helpClose) {
      helpClose.addEventListener("click", () => closeHelp());
    }

    if (helpModal) {
      helpModal.addEventListener("click", (e) => {
        if (e.target === helpModal) closeHelp();
      });
    }

    const closeSettings = () => {
      if (settingsModal) settingsModal.classList.remove("open");
    };

    const switchSettingsTab = (tab: string) => {
      settingsTabButtons.forEach((btn) => {
        if (btn.dataset.settingsTab === tab) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      settingsPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.settingsPanel === tab);
      });
    };

    const openSettings = () => {
      if (settingsEmail && currentUserEmailRef.current) {
        settingsEmail.textContent = currentUserEmailRef.current;
      }
      if (feedbackTextarea) feedbackTextarea.value = "";
      if (settingsModal) settingsModal.classList.add("open");
      switchSettingsTab("profile");
    };

    async function handlePasswordChange() {
      if (!settingsPwdNew || !settingsPwdConfirm || !settingsPwdBtn) return;
      const newPwd = settingsPwdNew.value.trim();
      const confirm = settingsPwdConfirm.value.trim();
      if (newPwd.length < 6) {
        if (settingsPwdMsg) settingsPwdMsg.textContent = "비밀번호는 6자 이상 입력해주세요.";
        return;
      }
      if (newPwd !== confirm) {
        if (settingsPwdMsg) settingsPwdMsg.textContent = "비밀번호가 일치하지 않습니다.";
        return;
      }
      settingsPwdBtn.disabled = true;
      if (settingsPwdMsg) settingsPwdMsg.textContent = "";
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      settingsPwdBtn.disabled = false;
      if (error) {
        if (settingsPwdMsg) settingsPwdMsg.textContent = error.message;
      } else {
        settingsPwdNew.value = "";
        settingsPwdConfirm.value = "";
        if (settingsPwdMsg) settingsPwdMsg.textContent = "비밀번호가 변경되었습니다.";
        showToast("비밀번호 변경 완료");
      }
    }

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        if (settingsModal?.classList.contains("open")) closeSettings();
        else openSettings();
      });
    }

    if (settingsClose) {
      settingsClose.addEventListener("click", () => closeSettings());
    }

    settingsTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.settingsTab;
        if (tab) switchSettingsTab(tab);
      });
    });

    if (settingsPwdBtn) {
      settingsPwdBtn.addEventListener("click", () => handlePasswordChange());
    }

    const handleFeedbackSubmit = async () => {
      if (!feedbackTextarea || previewMode) return;
      const text = feedbackTextarea.value.trim();
      if (!text) {
        showToast("내용을 입력해주세요.");
        return;
      }
      const uid = currentUserIdRef.current;
      const { error } = await supabase.from("feedback").insert({
        text,
        user_id: uid,
      });
      if (error) {
        showToast("전송에 실패했습니다.");
      } else {
        feedbackTextarea.value = "";
        showToast("문의/제보가 전송되었습니다.");
      }
    };

    if (feedbackSubmit) {
      feedbackSubmit.addEventListener("click", () => handleFeedbackSubmit());
    }

    if (settingsModal) {
      settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) closeSettings();
      });
    }

    if (collapseExpandedBtn) {
      collapseExpandedBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        collapseExpandedCell();
      });
    }
    if (expandedOverlay) {
      expandedOverlay.addEventListener("click", (e) => {
        if (e.target === expandedOverlay) {
          collapseExpandedCell();
        }
      });
    }

    if (monthPickerToggle) {
      monthPickerToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMonthDropdown();
      });
    }

    document.addEventListener("click", (e) => {
      if (marqueeActive) return;
      const target = e.target as HTMLElement;
      if (target.closest(".card")) return;
      if (target.closest(".month-picker")) return;
      if (emojiPalette && emojiPalette.contains(target)) return;
      clearSelection();
      if (!target.closest(".card-content")) {
        lastFocusedContent = null;
        lastRange = null;
        lastActiveCardContent = null;
      }

      if (!monthDropdown || !monthPickerToggle) return;
      if (!monthDropdown.classList.contains("open")) return;
      const picker = monthPickerToggle.closest(".month-picker");
      if (picker && picker.contains(target)) return;
      closeMonthDropdown();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (isEditableTarget(e.target as HTMLElement)) {
          e.preventDefault();
          return;
        }
        clearSelection();
        if (expandedCell) {
          collapseExpandedCell();
        }
        if (helpModal?.classList.contains("open")) {
          helpModal.classList.remove("open");
        }
      }
      // Enter: 카드 편집 또는 활성 데이셀에 새 카드 추가
      if (e.key === "Enter") {
        if (isEditableTarget(e.target as HTMLElement)) return;
        const firstSelected = document.querySelector<HTMLDivElement>(".card.selected");
        if (firstSelected) {
          e.preventDefault();
          makeEditable(firstSelected);
          return;
        }
        const activeCell =
          lastActiveDayCell || calendarGrid?.querySelector<HTMLElement>(".day-cell.active-day");
        if (activeCell) {
          const body = getActiveSectionBody(activeCell);
          if (body) {
            e.preventDefault();
            const newCard = createCard(
              body,
              { text: "", done: false, color: "default" },
              { autoEdit: true, fromState: false },
            );
            const key = activeCell.dataset.date;
            if (key) updateDayBadge(key);
            setActiveDay(activeCell);
            pushHistory();
            updateSectionHints(activeCell);
            clearSelection();
            newCard.classList.add("selected");
            lastSelectedCardId = newCard.dataset.cardId || null;
            selectionAnchorCardId = lastSelectedCardId;
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (isEditableTarget(e.target as HTMLElement)) return;
        e.preventDefault();
        undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (isEditableTarget(e.target as HTMLElement)) return;
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        if (selectedCards.length) {
          e.preventDefault();
          deleteCards(selectedCards);
          return;
        }
        const selectedStickers = Array.from(document.querySelectorAll<HTMLElement>(".sticker-item.selected"));
        if (!selectedStickers.length) return;
        e.preventDefault();
        deleteSelectedStickers();
      }
      if (!isEditableTarget(e.target as HTMLElement)) {
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveActiveDay(-1, 0);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveActiveDay(1, 0);
        } else if (e.key === "ArrowUp") {
          if (selectedCards.length) {
            const currentCard =
              (lastSelectedCardId
                ? (document.querySelector(`.card[data-card-id="${lastSelectedCardId}"]`) as HTMLDivElement | null)
                : null) || selectedCards[selectedCards.length - 1];
            const cell = currentCard.closest(".day-cell") as HTMLElement | null;
            if (cell) {
              const cards = Array.from(cell.querySelectorAll<HTMLDivElement>(".card"));
              const idx = cards.indexOf(currentCard);
              const nextIdx = idx > 0 ? idx - 1 : 0;
              const next = cards[nextIdx];
              if (next) {
                e.preventDefault();
                if (e.shiftKey) {
                  const anchorId = selectionAnchorCardId || currentCard.dataset.cardId;
                  if (!anchorId) return;
                  const anchorEl = document.querySelector(
                    `.card[data-card-id="${anchorId}"]`,
                  ) as HTMLDivElement | null;
                  if (!anchorEl) return;
                  const anchorIdx = cards.indexOf(anchorEl);
                  const targetIdx = cards.indexOf(next);
                  if (anchorIdx >= 0 && targetIdx >= 0) {
                    clearSelection();
                    const [from, to] =
                      anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
                    for (let i = from; i <= to; i++) {
                      cards[i].classList.add("selected");
                    }
                    lastSelectedCardId = next.dataset.cardId || null;
                    selectionAnchorCardId = anchorId;
                    setActiveDay(cell);
                    setActiveSection(cell, next.dataset.sectionId || "default");
                    next.scrollIntoView({ block: "nearest" });
                    return;
                  }
                } else {
                  clearSelection();
                  next.classList.add("selected");
                  lastSelectedCardId = next.dataset.cardId || null;
                  selectionAnchorCardId = lastSelectedCardId;
                  setActiveDay(cell);
                  setActiveSection(cell, next.dataset.sectionId || "default");
                  next.scrollIntoView({ block: "nearest" });
                  return;
                }
              }
            }
            e.preventDefault();
            return;
          }
          e.preventDefault();
          moveActiveDay(0, -1);
        } else if (e.key === "ArrowDown") {
          if (selectedCards.length) {
            const currentCard =
              (lastSelectedCardId
                ? (document.querySelector(`.card[data-card-id="${lastSelectedCardId}"]`) as HTMLDivElement | null)
                : null) || selectedCards[selectedCards.length - 1];
            const cell = currentCard.closest(".day-cell") as HTMLElement | null;
            if (cell) {
              const cards = Array.from(cell.querySelectorAll<HTMLDivElement>(".card"));
              const idx = cards.indexOf(currentCard);
              const nextIdx = idx >= 0 && idx < cards.length - 1 ? idx + 1 : idx;
              const next = cards[nextIdx];
              if (next) {
                e.preventDefault();
                if (e.shiftKey) {
                  const anchorId = selectionAnchorCardId || currentCard.dataset.cardId;
                  if (!anchorId) return;
                  const anchorEl = document.querySelector(
                    `.card[data-card-id="${anchorId}"]`,
                  ) as HTMLDivElement | null;
                  if (!anchorEl) return;
                  const anchorIdx = cards.indexOf(anchorEl);
                  const targetIdx = cards.indexOf(next);
                  if (anchorIdx >= 0 && targetIdx >= 0) {
                    clearSelection();
                    const [from, to] =
                      anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
                    for (let i = from; i <= to; i++) {
                      cards[i].classList.add("selected");
                    }
                    lastSelectedCardId = next.dataset.cardId || null;
                    selectionAnchorCardId = anchorId;
                    setActiveDay(cell);
                    setActiveSection(cell, next.dataset.sectionId || "default");
                    next.scrollIntoView({ block: "nearest" });
                    return;
                  }
                } else {
                  clearSelection();
                  next.classList.add("selected");
                  lastSelectedCardId = next.dataset.cardId || null;
                  selectionAnchorCardId = lastSelectedCardId;
                  setActiveDay(cell);
                  setActiveSection(cell, next.dataset.sectionId || "default");
                  next.scrollIntoView({ block: "nearest" });
                  return;
                }
              }
            }
            e.preventDefault();
            return;
          }
          e.preventDefault();
          moveActiveDay(0, 1);
        }
      }
    });

    if (ymPrevYear && ymNextYear) {
      ymPrevYear.addEventListener("click", () => {
        pickerYear--;
        if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
        updateMonthTitle(new Date(pickerYear, current.getMonth(), 1));
      });
      ymNextYear.addEventListener("click", () => {
        pickerYear++;
        if (ymYearLabel) ymYearLabel.textContent = `${pickerYear}년`;
        updateMonthTitle(new Date(pickerYear, current.getMonth(), 1));
      });
    }

    if (ymMonthButtons && ymMonthButtons.length) {
      ymMonthButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const monthIndex = Number(btn.dataset.month);
          if (!Number.isFinite(monthIndex)) return;
          current.setFullYear(pickerYear);
          current.setMonth(monthIndex);
          current.setDate(1);
          startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
          endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);
          renderCalendar();
          requestAnimationFrame(() => {
            skipAutoExtend = true;
            if (calendarWrapper) calendarWrapper.scrollTop = 0;
            setTimeout(() => {
              skipAutoExtend = false;
              updateMonthTitle(current);
              syncMonthHeaderWithScroll();
            }, 80);
          });
          closeMonthDropdown();
        });
      });
    }

    if (airtableSaveBtn) airtableSaveBtn.addEventListener("click", saveToAirtableSnapshot);
    if (airtableLoadBtn) airtableLoadBtn.addEventListener("click", loadFromAirtableSnapshot);

    (window as typeof window & { _dumpState?: () => State })._dumpState = () =>
      JSON.parse(JSON.stringify(state));

    // 헤더 토글
    function setHeaderVisibility(collapsed: boolean) {
      headerCollapsed = collapsed;
      document.body.classList.toggle("header-collapsed", collapsed);
      const label = collapsed ? "헤더 보이기" : "헤더 숨기기";
      if (headerToggle) headerToggle.textContent = label;
      if (headerToggleFloating) headerToggleFloating.textContent = label;
    }
    if (headerToggle) {
      headerToggle.addEventListener("click", () => setHeaderVisibility(!headerCollapsed));
      setHeaderVisibility(false);
    }
    if (headerToggleFloating) {
      headerToggleFloating.addEventListener("click", () => setHeaderVisibility(!headerCollapsed));
    }

    // ===== 스크롤 동기화: 화면 상단에 보이는 일(또는 카드)의 월로 헤더 업데이트 =====
    let syncRaf = 0;
    function syncMonthHeaderWithScroll() {
      const days = Array.from(document.querySelectorAll<HTMLDivElement>(".day-cell")).filter(
        (cell) => !!cell.dataset.date,
      );
      if (!days.length) return;
      const container = calendarWrapper || document.documentElement;
      const baseline = container.scrollTop + container.clientHeight * 0.4; // 화면 40% 지점 기준
      let targetDate: Date | null = null;
      let bestGap = Number.POSITIVE_INFINITY;
      days.forEach((cell) => {
        const top = cell.offsetTop;
        const bottom = top + cell.offsetHeight;
        if (bottom < baseline) return; // 기준보다 완전히 위인 셀은 제외
        const gap = Math.abs(top - baseline);
        if (gap < bestGap) {
          bestGap = gap;
          const dateKey = cell.dataset.date;
          if (dateKey) {
            const [y, m, d] = dateKey.split("-").map(Number);
            targetDate = new Date(y, m - 1, d);
          }
        }
      });
      if (targetDate) updateMonthTitle(targetDate);
    }

    function onScrollThrottled() {
      if (syncRaf) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0;
        syncMonthHeaderWithScroll();
      });
    }
    // 마퀴 선택 (빈 영역 드래그로 카드 다중 선택)
    function onMarqueeStart(e: MouseEvent) {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(".card")) return; // 카드 위에서는 기존 드래그/클릭 우선
      // 드래그로 박스(카드)만 선택하고, 브라우저 기본 텍스트 선택은 같이 잡히지 않게 한다.
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      document.body.classList.add("marquee-selecting");
      marqueeActive = true;
      marqueeStart = { x: e.clientX, y: e.clientY };
      const box = ensureMarqueeBox();
      box.style.display = "block";
      box.style.left = `${e.clientX}px`;
      box.style.top = `${e.clientY}px`;
      box.style.width = "0px";
      box.style.height = "0px";
      clearSelection();
      document.addEventListener("mousemove", onMarqueeMove);
      document.addEventListener("mouseup", onMarqueeEnd, { once: true });
    }

    function onMarqueeMove(e: MouseEvent) {
      if (!marqueeStart || !marqueeBox) return;
      const x1 = Math.min(marqueeStart.x, e.clientX);
      const y1 = Math.min(marqueeStart.y, e.clientY);
      const x2 = Math.max(marqueeStart.x, e.clientX);
      const y2 = Math.max(marqueeStart.y, e.clientY);
      marqueeBox.style.left = `${x1}px`;
      marqueeBox.style.top = `${y1}px`;
      marqueeBox.style.width = `${x2 - x1}px`;
      marqueeBox.style.height = `${y2 - y1}px`;
      updateMarqueeSelection({ left: x1, top: y1, right: x2, bottom: y2 });
    }

    function onMarqueeEnd() {
      marqueeStart = null;
      if (marqueeBox) {
        marqueeBox.style.display = "none";
        marqueeBox.style.width = "0px";
        marqueeBox.style.height = "0px";
      }
      document.body.classList.remove("marquee-selecting");
      window.getSelection()?.removeAllRanges();
      document.removeEventListener("mousemove", onMarqueeMove);
      setTimeout(() => {
        marqueeActive = false;
      }, 0);
    }

    function copySelectedCards(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
      }
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        return;
      }
      const selected = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
      if (!selected.length) {
        if (sel && !sel.isCollapsed && sel.toString().trim()) {
          return;
        }
        return;
      }
      const data: CardData[] = selected.map((card) => {
        const content = card.querySelector(".card-content");
        return {
          id: card.dataset.cardId || newId(),
          text: content ? content.innerHTML ?? "" : "",
          done: card.classList.contains("done"),
          color: card.dataset.color || "default",
        };
      });
      cardClipboard = data;
      if (e.clipboardData) {
        e.clipboardData.setData("application/json", JSON.stringify(data));
        e.clipboardData.setData(
          "text/plain",
          data.map((c) => c.text).join("\n\n"),
        );
        e.preventDefault();
      }
    }

    function pasteCards(e: ClipboardEvent) {
      if (isEditableTarget(e.target as HTMLElement)) return;
      if (document.querySelector(".card.selected")) {
        return;
      }

      let data: CardData[] = [];
      const jsonStr = e.clipboardData?.getData("application/json");
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            data = parsed
              .map((c) => ({
                id: newId(),
                text: typeof c.text === "string" ? c.text : "",
                done: !!c.done,
                color: c.color ?? "default",
              }))
              .filter((c) => typeof c.text === "string");
          }
        } catch {
          /* ignore */
        }
      }
      if (!data.length && cardClipboard.length) {
        data = cardClipboard.map((c) => ({
          id: newId(),
          text: c.text,
          done: c.done,
          color: c.color,
        }));
      }
      if (!data.length) {
        return;
      }

      const targetCell =
        lastActiveDayCell ||
        (lastActiveDateKey && calendarGrid
          ? calendarGrid.querySelector<HTMLElement>(`.day-cell[data-date="${lastActiveDateKey}"]`)
          : null);
      if (!targetCell) {
        showToast("붙여넣기할 날짜 칸을 먼저 클릭하세요.");
        return;
      }
      const bodyEl = getActiveSectionBody(targetCell);
      if (!bodyEl) return;

      e.preventDefault();

      data.forEach((c) => {
        createCard(
          bodyEl,
          { text: c.text, done: c.done, color: c.color },
          { autoEdit: false, fromState: false },
        );
      });
      const key = targetCell.dataset.date;
      if (key) updateDayBadge(key);
      syncCurrentMonthFromDom();
      pushHistory();
    }

    // 인피니트 스크롤: 상/하단 근접 시 범위 확장
    let loadingPrev = false;
    let loadingNext = false;
    let skipAutoExtend = false;

    function extendRange(direction: "prev" | "next") {
      const container = calendarWrapper || document.documentElement;
      const prevHeight = container.scrollHeight;
      if (direction === "prev") {
        startCursor = new Date(startCursor.getFullYear(), startCursor.getMonth() - 1, 1);
        loadingPrev = true;
        renderCalendar();
        const newHeight = container.scrollHeight;
        const diff = newHeight - prevHeight;
        container.scrollTop += diff > 0 ? diff : 0; // 스크롤 위치 보정
        loadingPrev = false;
      } else {
        endCursor = new Date(endCursor.getFullYear(), endCursor.getMonth() + 1, 1);
        loadingNext = true;
        renderCalendar();
        loadingNext = false;
      }
    }

    function onCalendarScroll() {
      const container = calendarWrapper || document.documentElement;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;

      updateSelectionOutlineBox();

      if (skipAutoExtend) {
        return;
      }

      if (scrollTop < 120 && !loadingPrev) {
        extendRange("prev");
      } else if (scrollTop + clientHeight > scrollHeight - 200 && !loadingNext) {
        extendRange("next");
      }
      onScrollThrottled();
    }

    if (calendarWrapper) {
      calendarWrapper.addEventListener("scroll", onCalendarScroll);
      calendarWrapper.addEventListener("mousedown", onMarqueeStart);
    } else {
      window.addEventListener("scroll", onCalendarScroll);
      window.addEventListener("mousedown", onMarqueeStart);
    }

    if (weekendToggleBtn) {
      weekendToggleBtn.addEventListener("click", () => {
        showWeekend = !showWeekend;
        toggleWeekendUI();
        renderCalendar();
      });
    }

    const wheelTarget: HTMLElement | (Window & typeof globalThis) = calendarWrapper || window;
    wheelTarget.addEventListener(
      "wheel",
      (e) => onWheelScale(e as WheelEvent),
      { passive: false },
    );
    document.addEventListener("copy", copySelectedCards);
    document.addEventListener("paste", pasteCards);

    if (scaleResetBtn) {
      scaleResetBtn.addEventListener("click", () => {
        setScale(1);
      });
    }
    if (zoomRange) {
      zoomRange.addEventListener("input", () => {
        const v = Number(zoomRange.value);
        if (!Number.isFinite(v)) return;
        setScale(v / 100);
      });
    }
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => adjustScale(0.05));
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => adjustScale(-0.05));
    }

    // selectionchange로 마지막 커서 위치 추적
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const anchor = range.startContainer as HTMLElement | null;
      const el = anchor ? (anchor.nodeType === 3 ? anchor.parentElement : anchor) : null;
      if (el && el.closest(".card-content")) {
        lastRange = range.cloneRange();
        const cont = el.closest(".card-content") as HTMLDivElement | null;
        lastFocusedContent = cont;
        lastActiveCardContent = cont;
      }
    });

    const textToolbar = document.createElement("div");
    textToolbar.className = "text-toolbar hidden";
    textToolbar.innerHTML = `
      <div class="text-toolbar-size">
        <button type="button" class="text-toolbar-size-btn" data-size="11">소</button>
        <button type="button" class="text-toolbar-size-btn" data-size="16">중</button>
        <button type="button" class="text-toolbar-size-btn" data-size="20">대</button>
      </div>
      <button type="button" class="text-toolbar-color-btn" id="textToolbarColorBtn" aria-label="텍스트 색상"></button>
      <button type="button" data-cmd="bold"><strong>B</strong></button>
      <button type="button" data-cmd="italic"><em>I</em></button>
      <button type="button" data-cmd="underline"><span style="text-decoration:underline">U</span></button>
      <button type="button" data-cmd="strike"><span style="text-decoration:line-through">S</span></button>
      <button type="button" data-cmd="link">🔗</button>
    `;
    document.body.appendChild(textToolbar);

    function rgbToHex(color: string) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return "";
      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);
      const toHex = (v: number) => v.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function restoreSelection() {
      const sel = window.getSelection();
      if (!sel || !lastRange) return false;
      sel.removeAllRanges();
      sel.addRange(lastRange);
      return true;
    }

    function getSelectionComputed() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
      if (!el) return null;
      const computed = getComputedStyle(el);
      return {
        color: rgbToHex(computed.color) || "#111827",
        fontSize: parseInt(computed.fontSize || "16", 10) || 16,
      };
    }

    function wrapSelectionWithSpan(style: { color?: string; fontSize?: number }) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const current = getSelectionComputed();
      const color = style.color || current?.color;
      const fontSize = style.fontSize || current?.fontSize;
      const styleParts: string[] = [];
      if (color) styleParts.push(`color:${color}`);
      if (fontSize) styleParts.push(`font-size:${fontSize}px`);
      const styleText = styleParts.join(";");

      const span = document.createElement("span");
      span.setAttribute("style", styleText);
      const fragment = range.extractContents();
      if (style.fontSize || style.color) {
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
        let node = walker.nextNode() as HTMLElement | null;
        while (node) {
          if (style.fontSize) node.style.fontSize = "";
          if (style.color) node.style.color = "";
          if (node.getAttribute("style") === "") node.removeAttribute("style");
          node = walker.nextNode() as HTMLElement | null;
        }
      }
      span.appendChild(fragment);
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      lastRange = newRange.cloneRange();
    }

    function wrapTextNodesInSpans(root: HTMLElement) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode as Text);
      }
      nodes.forEach((textNode) => {
        const parent = textNode.parentElement;
        if (!parent || parent.tagName === "SPAN") return;
        const span = document.createElement("span");
        span.textContent = textNode.nodeValue || "";
        parent.replaceChild(span, textNode);
      });
    }

    function getSelectionCard() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
      return el ? (el.closest(".card") as HTMLDivElement | null) : null;
    }

    function syncSelectionCard() {
      const card = getSelectionCard();
      if (card) syncOneCardFromDom(card);
    }

    function clearCardFontSizes(card: HTMLDivElement | null) {
      if (!card) return;
      card.querySelectorAll<HTMLElement>(".card-content span[style]").forEach((el) => {
        const style = el.getAttribute("style") || "";
        const next = style.replace(/font-size\s*:\s*[^;]+;?/gi, "").trim();
        if (next) {
          el.setAttribute("style", next);
        } else {
          el.removeAttribute("style");
        }
      });
    }

    function hideTextToolbar() {
      textToolbar.classList.add("hidden");
    }

    function showTextToolbar(rect: DOMRect) {
      textToolbar.classList.remove("hidden");
      const toolbarRect = textToolbar.getBoundingClientRect();
      const top = window.scrollY + rect.top - toolbarRect.height - 8;
      const left = window.scrollX + rect.left + rect.width / 2 - toolbarRect.width / 2;
      textToolbar.style.top = `${Math.max(8, top)}px`;
      textToolbar.style.left = `${Math.max(8, left)}px`;
    }

    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        hideTextToolbar();
        return;
      }
      const range = sel.getRangeAt(0);
      if (sel.isCollapsed) {
        hideTextToolbar();
        return;
      }
      const el =
        range.commonAncestorContainer.nodeType === 3
          ? (range.commonAncestorContainer.parentElement as HTMLElement | null)
          : (range.commonAncestorContainer as HTMLElement | null);
      if (!el || !el.closest(".card-content")) {
        hideTextToolbar();
        return;
      }
      const rect = range.getBoundingClientRect();
      if (colorBtn) {
        const computed = getComputedStyle(el);
        const hex = rgbToHex(computed.color);
        if (hex) {
          activePaletteColor = hex;
          colorBtn.style.backgroundColor = hex;
          renderPalette();
        }
      }
      showTextToolbar(rect);
    });

    document.addEventListener("scroll", () => {
      hideTextToolbar();
      palette.classList.add("hidden");
    }, true);

    document.addEventListener("mousedown", (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest(".text-toolbar") || target.closest(".card-content"))) return;
      palette.classList.add("hidden");
      hideTextToolbar();
    });

    textToolbar.addEventListener("mousedown", (e) => {
      e.preventDefault();
      keepFocusFromToolbar = true;
    });
    textToolbar.addEventListener("mouseup", () => {
      keepFocusFromToolbar = false;
    });

    const colorBtn = textToolbar.querySelector<HTMLButtonElement>("#textToolbarColorBtn");
    const toolbarButtons = Array.from(textToolbar.querySelectorAll<HTMLButtonElement>("button[data-cmd]"));
    const sizeButtons = Array.from(textToolbar.querySelectorAll<HTMLButtonElement>("button[data-size]"));

    const palette = document.createElement("div");
    palette.className = "text-toolbar-palette hidden";
    textToolbar.appendChild(palette);

    const PALETTE_COLORS = [
      "#111827",
      "#3f3f3f",
      "#6b7280",
      "#9ca3af",
      "#bdbdbd",
      "#d1d5db",
      "#e5e7eb",
      "#f3f4f6",
      "#f9fafb",
      "#ffffff",
      "#7f1d1d",
      "#b91c1c",
      "#dc2626",
      "#ea580c",
      "#f59e0b",
      "#facc15",
      "#84cc16",
      "#22c55e",
      "#14b8a6",
      "#0ea5e9",
      "#2563eb",
      "#4f46e5",
      "#7c3aed",
      "#a21caf",
      "#db2777",
      "#f43f5e",
      "#fee2e2",
      "#fecaca",
      "#fed7aa",
      "#fef3c7",
      "#dcfce7",
      "#d1fae5",
      "#cffafe",
      "#dbeafe",
      "#ede9fe",
      "#f5d0fe",
      "#fce7f3",
      "#fef9c3",
    ];

    let activePaletteColor = "#111827";

    function renderPalette() {
      palette.innerHTML = "";
      PALETTE_COLORS.forEach((color) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "text-toolbar-swatch";
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        if (color.toLowerCase() === activePaletteColor.toLowerCase()) {
          btn.classList.add("selected");
          btn.innerHTML = `<span class="text-toolbar-check">✓</span>`;
        }
        btn.addEventListener("click", () => {
          activePaletteColor = color;
          if (colorBtn) colorBtn.style.backgroundColor = color;
          restoreSelection();
          wrapSelectionWithSpan({ color });
          syncSelectionCard();
          renderPalette();
        });
      palette.appendChild(btn);
      });
    }

    renderPalette();

    if (colorBtn) {
      colorBtn.style.backgroundColor = activePaletteColor;
      colorBtn.addEventListener("click", () => {
        palette.classList.toggle("hidden");
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        palette.classList.add("hidden");
      }
    });

    sizeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const size = Number(btn.dataset.size || "16");
        restoreSelection();
        clearCardFontSizes(getSelectionCard());
        wrapSelectionWithSpan({ fontSize: size });
        syncSelectionCard();
      });
    });
    toolbarButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmd = btn.dataset.cmd;
        if (!cmd) return;
        restoreSelection();
        if (cmd === "link") {
          const url = prompt("링크 URL을 입력하세요");
          if (!url) return;
          document.execCommand("createLink", false, url);
        } else if (cmd === "strike") {
          document.execCommand("strikeThrough");
        } else {
          document.execCommand(cmd);
        }
        syncSelectionCard();
      });
    });

    palette.addEventListener("mousedown", (e) => {
      e.preventDefault();
      keepFocusFromToolbar = true;
    });

    // ========== 이모지 업로드 & 팔레트 ==========
    const emojiTrigger = document.getElementById("emojiTrigger") as HTMLButtonElement | null;
    const emojiTriggerExpanded = document.getElementById("emojiTriggerExpanded") as HTMLButtonElement | null;
    const emojiUploadTrigger = document.getElementById(
      "emojiUploadTrigger",
    ) as HTMLButtonElement | null;
    const emojiUpload = document.getElementById("emojiUpload") as HTMLInputElement | null;
    const emojiPalette = document.getElementById("emojiPalette") as HTMLElement | null;
    const emojiPaletteOriginalParent = emojiPalette?.parentElement || null;
    const emojiPaletteOriginalNext = emojiPalette?.nextElementSibling || null;

    const stickerUploadTrigger = document.getElementById(
      "stickerUploadTrigger",
    ) as HTMLButtonElement | null;
    const stickerUpload = document.getElementById("stickerUpload") as HTMLInputElement | null;
    const stickerPalette = document.getElementById("stickerPalette") as HTMLElement | null;
    const stickerPaletteOriginalParent = stickerPalette?.parentElement || null;
    const stickerPaletteOriginalNext = stickerPalette?.nextElementSibling || null;

    function renderEmojiPalette() {
      if (!emojiPalette) return;
      const oldList = emojiPalette.querySelector<HTMLElement>("#emojiPaletteList");
      const listEl = document.createElement("div");
      listEl.id = "emojiPaletteList";
      listEl.className = "emoji-list";
      if (oldList) {
        emojiPalette.replaceChild(listEl, oldList);
      } else {
        emojiPalette.appendChild(listEl);
      }

      const seen = new Set<string>();

      // 전체 이모지 풀: 기본 + 업로드
      const allEmojis: Array<
        | { type: "default"; id: string; ch: string }
        | { type: "upload"; id: string; src: string; name: string }
      > = [
        ...DEFAULT_EMOJIS.map((d) => ({ type: "default" as const, id: d.id, ch: d.ch })),
        ...emojiList.map((u) => ({ type: "upload" as const, id: u.id, src: u.src, name: u.name })),
      ];

      // 순서 적용
      const mapAll = new Map(allEmojis.map((e) => [e.id, e]));
      const ordered: typeof allEmojis = [];
      emojiOrder.forEach((id) => {
        const item = mapAll.get(id);
        if (item) {
          ordered.push(item);
          mapAll.delete(id);
        }
      });
      mapAll.forEach((item) => ordered.push(item));
      // 저장된 순서가 비어있다면 기본 순서로 초기화
      if (!emojiOrder.length) {
        emojiOrder = ordered.map((e) => e.id);
        saveEmojiOrder();
      }

      let placeholder: HTMLDivElement | null = null;

      function ensurePlaceholder() {
        if (placeholder) return placeholder;
        const ph = document.createElement("div");
        ph.className = "emoji-placeholder";
        placeholder = ph;
        return ph;
      }

      const buildBtn = (emoji: (typeof ordered)[number]) => {
        const wrapper = document.createElement("div");
        wrapper.className = "emoji-btn-wrap";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "emoji-btn";
        btn.draggable = true;

        btn.addEventListener("dragstart", (e) => {
          btn.classList.add("dragging");
          draggingEmojiId = emoji.id;
          if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", emoji.id);
            e.dataTransfer.effectAllowed = "move";
          }
        });

        btn.addEventListener("dragend", () => {
          btn.classList.remove("dragging");
          draggingEmojiId = null;
          if (placeholder && placeholder.parentElement) placeholder.parentElement.removeChild(placeholder);
          placeholder = null;
        });

        const runInsert = (html: string) => {
          const targetContent = lastFocusedContent || lastActiveCardContent;
          if (!targetContent || !targetContent.closest(".card")) {
            showToast("카드를 먼저 클릭해 주세요.");
            return;
          }
          const sel = window.getSelection();
          sel?.removeAllRanges();
          targetContent.focus();
          if (lastRange) {
            sel?.addRange(lastRange);
          } else if (targetContent) {
            const r = document.createRange();
            r.selectNodeContents(targetContent);
            r.collapse(false);
            sel?.addRange(r);
            lastRange = r.cloneRange();
          }
          const ok = insertAtSelection(html, { strictCard: true });
          if (!ok) {
            showToast("카드를 먼저 클릭해 주세요.");
            return;
          }
          const focusedCard = targetContent.closest(".card");
          if (focusedCard) syncOneCardFromDom(focusedCard as HTMLDivElement);
        };

        if (emoji.type === "default") {
          btn.textContent = emoji.ch;
          btn.addEventListener("click", () => runInsert(emoji.ch));
        } else {
          const img = document.createElement("img");
          img.src = emoji.src;
          img.alt = emoji.name || "emoji";
          btn.appendChild(img);
          btn.addEventListener("click", () =>
            runInsert(`<img class="emoji-img" src="${emoji.src}">`),
          );

          const del = document.createElement("button");
          del.type = "button";
          del.className = "emoji-remove";
          del.textContent = "×";
          del.addEventListener("click", (e) => {
            e.stopPropagation();
            emojiList = emojiList.filter((item) => item.id !== emoji.id);
            emojiOrder = emojiOrder.filter((id) => id !== emoji.id);
            saveEmojis();
            saveEmojiOrder();
            renderEmojiPalette();
          });
          wrapper.appendChild(del);
        }

        wrapper.appendChild(btn);
        return wrapper;
      };

      ordered.forEach((emoji) => {
        if (emoji.type === "upload" && seen.has(emoji.src)) return;
        if (emoji.type === "default" && seen.has(emoji.ch)) return;
        seen.add(emoji.type === "upload" ? emoji.src : emoji.ch);
        listEl.appendChild(buildBtn(emoji));
      });

      listEl.addEventListener("dragover", (e) => {
        if (!draggingEmojiId) return;
        e.preventDefault();
        const ph = ensurePlaceholder();
        const target = (e.target as HTMLElement).closest(".emoji-btn-wrap");
        const children = Array.from(listEl.children);
        if (target && target.parentElement === listEl) {
          const rect = target.getBoundingClientRect();
          const before = e.clientX < rect.left + rect.width / 2;
          if (before) {
            listEl.insertBefore(ph, target);
          } else {
            listEl.insertBefore(ph, target.nextSibling);
          }
        } else if (!ph.parentElement) {
          listEl.appendChild(ph);
        }
      });

      listEl.addEventListener("drop", (e) => {
        if (!draggingEmojiId) return;
        e.preventDefault();
        const ph = placeholder;
        const children = Array.from(listEl.children);
        let targetIndex = ph ? children.indexOf(ph) : children.length;
        if (targetIndex < 0) targetIndex = children.length;
        if (ph && ph.parentElement) ph.parentElement.removeChild(ph);
        placeholder = null;

        const order = emojiOrder.filter((id) => id !== draggingEmojiId);
        const clamped = Math.max(0, Math.min(targetIndex, order.length));
        order.splice(clamped, 0, draggingEmojiId);
        emojiOrder = order;
        saveEmojiOrder();
        renderEmojiPalette();
      });

      listEl.addEventListener("dragleave", (e) => {
        if (!draggingEmojiId) return;
        const related = e.relatedTarget as HTMLElement | null;
        if (related && listEl.contains(related)) return;
        if (placeholder && placeholder.parentElement) placeholder.parentElement.removeChild(placeholder);
        placeholder = null;
      });
    }

    function addStickerToDate(dateKey: string, src: string) {
      const list = ensureStickerList(dateKey);
      if (list.length >= 5) {
        showToast("스티커는 하루 최대 5개까지 가능합니다.");
        return;
      }
      const nextZ = Math.max(0, ...list.map((s) => s.z || 0)) + 1;
      const offset = 10 * list.length;
      const sticker: StickerData = {
        id: newId(),
        src,
        x: 8 + offset,
        y: 8 + offset,
        width: 96,
        height: 96,
        rotation: 0,
        z: nextZ,
      };
      list.push(sticker);
      void upsertStickerToSupabase(dateKey, sticker);
      saveLocalState();
      renderCalendar();
    }

    const resolveStickerDateKey = () => {
      const target = activeStickerTarget || lastActiveDayCell;
      return target?.dataset.date || "";
    };

    function renderStickerPalette() {
      if (!stickerPalette) return;
      const oldList = stickerPalette.querySelector<HTMLElement>("#stickerPaletteList");
      const listEl = document.createElement("div");
      listEl.id = "stickerPaletteList";
      listEl.className = "sticker-list";
      if (oldList) {
        stickerPalette.replaceChild(listEl, oldList);
      } else {
        stickerPalette.appendChild(listEl);
      }

      const mapAll = new Map(stickerList.map((s) => [s.id, s]));
      const ordered: typeof stickerList = [];
      stickerOrder.forEach((id) => {
        const item = mapAll.get(id);
        if (item) {
          ordered.push(item);
          mapAll.delete(id);
        }
      });
      mapAll.forEach((item) => ordered.push(item));
      if (!stickerOrder.length) {
        stickerOrder = ordered.map((s) => s.id);
        saveStickerOrder();
      }

      ordered.forEach((sticker) => {
        const wrapper = document.createElement("div");
        wrapper.className = "sticker-btn-wrap";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sticker-btn";
        const img = document.createElement("img");
        img.src = sticker.src;
        img.alt = sticker.name || "sticker";
        btn.appendChild(img);
        btn.addEventListener("click", () => {
          const dateKey = stickerPalette.dataset.dateKey || resolveStickerDateKey();
          if (!dateKey) {
            showToast("스티커를 추가할 날짜를 먼저 선택하세요.");
            return;
          }
          addStickerToDate(dateKey, sticker.src);
          closeStickerPalette();
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "sticker-remove";
        del.textContent = "×";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          stickerList = stickerList.filter((s) => s.id !== sticker.id);
          stickerOrder = stickerOrder.filter((id) => id !== sticker.id);
          Object.keys(state.stickers).forEach((dateKey) => {
            const nextList = (state.stickers[dateKey] || []).filter((s) => s.src !== sticker.src);
            if (nextList.length) {
              state.stickers[dateKey] = nextList;
            } else {
              delete state.stickers[dateKey];
            }
          });
          saveStickers();
          saveStickerOrder();
          saveLocalState();
          renderCalendar();
          renderStickerPalette();
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(del);
        listEl.appendChild(wrapper);
      });
    }

    function handleStickerFile(file: File) {
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (!src.startsWith("data:image/")) {
          alert("이미지 파일만 업로드 가능합니다.");
          return;
        }
        if (stickerList.some((e) => e.src === src)) {
          renderStickerPalette();
          return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        stickerList.unshift({ id, src, name: file.name });
        stickerList = stickerList.slice(0, 40);
        stickerOrder.unshift(id);
        stickerOrder = stickerOrder.slice(0, 40);
        saveStickers();
        saveStickerOrder();
        renderStickerPalette();
      };
      reader.readAsDataURL(file);
    }

    function handleEmojiFile(file: File) {
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (!src.startsWith("data:image/")) {
          alert("이미지 파일만 업로드 가능합니다.");
          return;
        }
        // 중복 방지
        if (emojiList.some((e) => e.src === src)) {
          renderEmojiPalette();
          return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        emojiList.unshift({ id, src, name: file.name });
        emojiList = emojiList.slice(0, 40); // 제한
        emojiOrder.unshift(id);
        emojiOrder = emojiOrder.slice(0, DEFAULT_EMOJIS.length + 40);
        saveEmojis();
        saveEmojiOrder();
        renderEmojiPalette();
      };
      reader.readAsDataURL(file);
    }

    if (emojiUpload) {
      emojiUpload.addEventListener("change", () => {
        const file = emojiUpload.files?.[0];
        if (file) handleEmojiFile(file);
        emojiUpload.value = "";
      });
    }

    if (emojiUploadTrigger && emojiUpload) {
      emojiUploadTrigger.addEventListener("click", () => emojiUpload.click());
    }

    if (stickerUpload) {
      stickerUpload.addEventListener("change", () => {
        const file = stickerUpload.files?.[0];
        if (file) handleStickerFile(file);
        stickerUpload.value = "";
      });
    }

    if (stickerUploadTrigger && stickerUpload) {
      stickerUploadTrigger.addEventListener("click", () => stickerUpload.click());
    }

    const emojiTriggers = [emojiTrigger, emojiTriggerExpanded].filter(Boolean) as HTMLButtonElement[];
    const closeEmojiPalette = () => {
      if (!emojiPalette) return;
      emojiPalette.classList.remove("open");
      emojiPalette.removeAttribute("style");
      if (emojiPaletteOriginalParent && emojiPalette.parentElement !== emojiPaletteOriginalParent) {
        if (emojiPaletteOriginalNext && emojiPaletteOriginalNext.parentElement === emojiPaletteOriginalParent) {
          emojiPaletteOriginalParent.insertBefore(emojiPalette, emojiPaletteOriginalNext);
        } else {
          emojiPaletteOriginalParent.appendChild(emojiPalette);
        }
      }
    };

    const closeStickerPalette = () => {
      if (!stickerPalette) return;
      stickerPalette.classList.remove("open");
      stickerPalette.removeAttribute("style");
      if (stickerPaletteOriginalParent && stickerPalette.parentElement !== stickerPaletteOriginalParent) {
        if (
          stickerPaletteOriginalNext &&
          stickerPaletteOriginalNext.parentElement === stickerPaletteOriginalParent
        ) {
          stickerPaletteOriginalParent.insertBefore(stickerPalette, stickerPaletteOriginalNext);
        } else {
          stickerPaletteOriginalParent.appendChild(stickerPalette);
        }
      }
    };

    const handleEmojiTriggerMouseDown = (trg: HTMLElement, e: MouseEvent) => {
      keepFocusFromPalette = true;
      e.preventDefault();
      e.stopPropagation();
      if (lastActiveCardContent) {
        lastActiveCardContent.focus();
        const sel = window.getSelection();
        sel?.removeAllRanges();
        if (lastRange) sel?.addRange(lastRange);
      }
    };

    const toggleEmojiPaletteForTrigger = (trg: HTMLElement, isExpandedTrigger = false) => {
      if (!emojiPalette) return;
      const willOpen = !emojiPalette.classList.contains("open");

      if (!willOpen) {
        closeEmojiPalette();
        keepFocusFromPalette = false;
        return;
      }

      const rect = trg.getBoundingClientRect();
      document.body.appendChild(emojiPalette);
      emojiPalette.style.position = "fixed";
      emojiPalette.style.top = `${rect.bottom + 8}px`;
      emojiPalette.style.left = `${rect.left}px`;
      emojiPalette.style.right = "auto";
      emojiPalette.style.zIndex = isExpandedTrigger ? "5000" : "4000";
      emojiPalette.style.display = "block";
      emojiPalette.classList.add("open");

      if (lastActiveCardContent) {
        lastActiveCardContent.focus();
        const sel = window.getSelection();
        sel?.removeAllRanges();
        if (lastRange) sel?.addRange(lastRange);
      }
      keepFocusFromPalette = false;
    };

    function openStickerPalette(anchor: HTMLElement) {
      if (!stickerPalette) return;
      if (!activeStickerTarget && lastActiveDayCell) {
        activeStickerTarget = lastActiveDayCell;
      }
      const dateKey = resolveStickerDateKey();
      if (dateKey) {
        stickerPalette.dataset.dateKey = dateKey;
      } else {
        delete stickerPalette.dataset.dateKey;
      }
      const willOpen = !stickerPalette.classList.contains("open");
      if (!willOpen) {
        closeStickerPalette();
        return;
      }
      const rect = anchor.getBoundingClientRect();
      document.body.appendChild(stickerPalette);
      stickerPalette.style.position = "fixed";
      stickerPalette.style.top = `${rect.bottom + 8}px`;
      stickerPalette.style.left = `${rect.left}px`;
      stickerPalette.style.right = "auto";
      stickerPalette.style.zIndex = "4000";
      stickerPalette.style.display = "block";
      stickerPalette.classList.add("open");
    }

    if (emojiTriggers.length && emojiPalette) {
      emojiTriggers.forEach((trg) => {
        trg.addEventListener("mousedown", (e) => handleEmojiTriggerMouseDown(trg, e));

        trg.addEventListener("click", (e) => {
          e.stopPropagation();
          const isExpandedTrigger = trg === emojiTriggerExpanded;
          toggleEmojiPaletteForTrigger(trg, isExpandedTrigger);
        });
      });

      emojiPalette.addEventListener("pointerdown", (e) => {
        const dragBtn = (e.target as HTMLElement).closest(".emoji-btn");
        if (dragBtn && dragBtn instanceof HTMLButtonElement && dragBtn.draggable) {
          keepFocusFromPalette = true;
          return;
        }
        keepFocusFromPalette = true;
        e.preventDefault();
        if (lastFocusedContent) {
          lastFocusedContent.focus();
          const sel = window.getSelection();
          sel?.removeAllRanges();
          if (lastRange) sel?.addRange(lastRange);
        }
      });
      emojiPalette.addEventListener("pointerup", () => {
        setTimeout(() => {
          keepFocusFromPalette = false;
        }, 0);
      });
    }

    if (emojiPalette) {
      const isEmojiTriggerTarget = (t: HTMLElement) =>
        emojiTriggers.some((btn) => btn.contains(t)) || !!t.closest(".card-btn-emoji");

      document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (emojiPalette.contains(t) || isEmojiTriggerTarget(t)) return;
        closeEmojiPalette();
      });
      document.addEventListener(
        "mousedown",
        (e) => {
          const t = e.target as HTMLElement;
          if (emojiPalette.contains(t) || isEmojiTriggerTarget(t)) return;
          closeEmojiPalette();
        },
        true,
      );

    }

    if (stickerPalette) {
      const isStickerTriggerTarget = (t: HTMLElement) =>
        !!t.closest(".day-sticker-btn") || !!t.closest(".sticker-btn");
      const isStickerInteractive = (t: HTMLElement) =>
        !!t.closest(".sticker-item") || isStickerTriggerTarget(t) || stickerPalette.contains(t);

      document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (stickerPalette.contains(t) || isStickerTriggerTarget(t)) return;
        closeStickerPalette();
      });
      document.addEventListener(
        "mousedown",
        (e) => {
          const t = e.target as HTMLElement;
          if (stickerPalette.contains(t) || isStickerTriggerTarget(t)) return;
          closeStickerPalette();
        },
        true,
      );
      document.addEventListener(
        "mousedown",
        (e) => {
          const t = e.target as HTMLElement;
          if (!t || isStickerInteractive(t)) return;
          clearStickerSelection();
        },
        true,
      );
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeStickerPalette();
      });
    }

    loadEmojis();
    loadEmojiOrder();
    loadStickers();
    loadStickerOrder();
    renderEmojiPalette();
    renderStickerPalette();

    toggleWeekendUI();
  }, [authReady, previewMode]);

  if (!authReady) return null;

  return (
    <div className="app">
      <div className="main-glass-panel">
        <header>
          <div className="title-with-logout">
            <div className="month-picker">
              <button className="month-display" id="monthPickerToggle" type="button">
                <span className="month-title" id="monthTitle" />
                <span className="month-caret">▾</span>
              </button>
              <div className="month-dropdown" id="monthDropdown">
                <div className="ym-header">
                  <button type="button" className="ym-year-btn" id="ymPrevYear">
                    ‹
                  </button>
                  <span className="ym-year-label" id="ymYearLabel" />
                  <button type="button" className="ym-year-btn" id="ymNextYear">
                    ›
                  </button>
                </div>
                <div className="ym-month-grid">
                  <button type="button" className="ym-month-btn" data-month="0">
                    1월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="1">
                    2월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="2">
                    3월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="3">
                    4월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="4">
                    5월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="5">
                    6월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="6">
                    7월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="7">
                    8월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="8">
                    9월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="9">
                    10월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="10">
                    11월
                  </button>
                  <button type="button" className="ym-month-btn" data-month="11">
                    12월
                  </button>
                </div>
              </div>
            </div>
            <button className="top-link" id="logoutBtn" type="button">
              log out
            </button>
          </div>
          <div className="top-actions">
            <button className="btn header-toggle" id="headerToggle" type="button">
              헤더 숨기기
            </button>
          </div>
        </header>

        <div className="floating-toggle-wrap">
          <span className="floating-title">MUCHI NOTE</span>
          <button className="btn header-toggle" id="headerToggleFloating" type="button">
            헤더 보이기
          </button>
        </div>

        <div className="top-bar">
          <div className="top-left-actions">
            <button className="link-btn" id="todayBtn">
              TODAY
            </button>
            <button className="link-btn" id="weekendToggle">
              WEEKEND
            </button>
            <button className="link-btn" id="settingsBtn" type="button">
              SETTING
            </button>
          </div>

          <div className="zoom-slider" aria-label="Zoom">
            <button className="zoom-btn" id="zoomOut" type="button" aria-label="Zoom out">
              −
            </button>
            <div className="zoom-range-wrap">
              <span className="zoom-center-mark" aria-hidden="true" />
              <input
                className="zoom-range"
                id="zoomRange"
                type="range"
                min="80"
                max="130"
                step="5"
                defaultValue="100"
                aria-label="Zoom level"
              />
            </div>
            <button className="zoom-btn" id="zoomIn" type="button" aria-label="Zoom in">
              +
            </button>
          </div>

          <div className="search-wrap">
            <div className="search-scope-toggles">
              <button className="scope-btn active" id="scopeMonth">
                이번 달
              </button>
              <button className="scope-btn" id="scopeAll">
                전체
              </button>
            </div>
            <input className="search-input" id="searchInput" type="text" placeholder="검색어 입력" />
            <button className="btn" id="searchBtn">
              검색
            </button>
          </div>
        </div>

        <div className="calendar-wrapper">
          <div className="emoji-panel emoji-panel-hidden" aria-hidden="true">
            <input id="emojiUpload" type="file" accept="image/*" />
            <div className="emoji-palette" id="emojiPalette">
              <div className="emoji-upload-row">
                <button className="btn" id="emojiUploadTrigger" type="button">
                  업로드
                </button>
              </div>
            </div>
          </div>
          <div className="sticker-panel sticker-panel-hidden" aria-hidden="true">
            <input id="stickerUpload" type="file" accept="image/*" />
            <div className="sticker-palette" id="stickerPalette">
              <div className="sticker-palette-header">
                <div className="sticker-panel-title">스티커</div>
                <button className="btn" id="stickerUploadTrigger" type="button">
                  업로드
                </button>
              </div>
              </div>
          </div>
          <div className="tab-strip">
            <div className="tab-bar" id="tabBar" />
          </div>
          <div className="calendar-grid" id="calendarGrid" />
        </div>
      </div>

      <div className="expanded-overlay" id="expandedOverlay">
        <div className="expanded-overlay-inner">
          <div className="expanded-overlay-bar">
            <button className="btn icon-btn" id="collapseExpandedBtn" type="button" title="Close">
              ✕
            </button>
          </div>
          <div className="expanded-container" id="expandedContainer" />
        </div>
      </div>

      
      <div className="settings-modal" id="settingsModal">
        <div className="settings-content">
          <div className="settings-header">
            <h3>Settings</h3>
            <button className="btn" id="settingsClose" type="button">
              닫기
            </button>
          </div>
          <div className="settings-tabs">
            <button className="settings-tab active" data-settings-tab="profile" type="button">
              프로필
            </button>
            <button className="settings-tab" data-settings-tab="password" type="button">
              비밀번호 변경
            </button>
            <button className="settings-tab" data-settings-tab="tips" type="button">
              팁
            </button>
            <button className="settings-tab" data-settings-tab="feedback" type="button">
              문의/제보
            </button>
          </div>
          <div className="settings-body">
            <div className="settings-panel active" data-settings-panel="profile">
              <div className="settings-item">
                <div className="settings-label">프로필</div>
                <div className="settings-value" id="settingsEmail">-</div>
              </div>
              <div className="settings-item column">
                <div className="settings-label">테마</div>
                <div className="theme-options">
                  <button className="theme-option" data-theme="default" type="button">
                    기본
                  </button>
                  <button className="theme-option" data-theme="mint" type="button">
                    민트
                  </button>
                  <button className="theme-option" data-theme="sky" type="button">
                    하늘색
                  </button>
                  <button className="theme-option" data-theme="lavender" type="button">
                    라벤더
                  </button>
                  <button className="theme-option" data-theme="olive" type="button">
                    올리브
                  </button>
                  <button className="theme-option" data-theme="charcoal" type="button">
                    차콜
                  </button>
                  <button className="theme-option" data-theme="navy" type="button">
                    네이비
                  </button>
                  <button className="theme-option" data-theme="burgundy" type="button">
                    버건디
                  </button>
                  <button className="theme-option" data-theme="purple" type="button">
                    퍼플
                  </button>
                </div>
              </div>
            </div>
            <div className="settings-panel" data-settings-panel="password">
              <div className="settings-item column">
                <div className="settings-label">비밀번호 변경</div>
                <div className="settings-fields">
                  <input type="password" id="settingsPwdNew" placeholder="새 비밀번호" />
                  <input type="password" id="settingsPwdConfirm" placeholder="비밀번호 확인" />
                  <div className="settings-actions">
                    <button className="btn" id="settingsPwdBtn" type="button">변경</button>
                    <span className="settings-msg" id="settingsPwdMsg"></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="settings-panel" data-settings-panel="tips">
              <div className="settings-item column">
                <div className="settings-label">날짜 선택/이동</div>
                <ul className="settings-tips">
                  <li>방향키로 날짜 이동(좌우/상하)</li>
                  <li>WEEKEND 토글로 주말 숨김/보임</li>
                </ul>
              </div>
              <div className="settings-item column">
                <div className="settings-label">카드 추가/편집</div>
                <ul className="settings-tips">
                  <li>날짜 선택 후 Enter : 새 카드 생성 후 바로 편집</li>
                  <li>카드 선택 후 Enter : 편집 / Esc : 편집 취소</li>
                  <li>카드 선택 후 EMOJI 버튼으로 이모지 삽입</li>
                </ul>
              </div>
              <div className="settings-item column">
                <div className="settings-label">카드 복사/붙여넣기/이동</div>
                <ul className="settings-tips">
                  <li>복사/붙여넣기: Shift+클릭 or 드래그로 다중 선택 → Ctrl/Cmd+C → 날짜 클릭 → Ctrl/Cmd+V</li>
                  <li>이동: 선택 카드 드래그로 위치 이동</li>
                </ul>
              </div>
              <div className="settings-item column">
                <div className="settings-label">삭제</div>
                <ul className="settings-tips">
                  <li>선택된 카드(다중 포함)에서 Delete/Backspace → 확인 후 삭제</li>
                </ul>
              </div>
              <div className="settings-item column">
                <div className="settings-label">보기/확대</div>
                <ul className="settings-tips">
                  <li>Alt/Cmd + 휠로 줌, ZOOM 버튼으로 100% 리셋</li>
                  <li>날짜 확대 버튼으로 1장 메모장처럼 사용</li>
                </ul>
              </div>
            </div>
            <div className="settings-panel" data-settings-panel="feedback">
              <div className="settings-item column">
                <div className="settings-label">문의/제보</div>
                <textarea
                  id="feedbackTextarea"
                  placeholder="불편 사항이나 건의 내용을 입력해주세요."
                  style={{ width: "100%", minHeight: "90px", resize: "vertical" }}
                />
                <div className="settings-actions" style={{ marginTop: "8px" }}>
                  <button className="btn" id="feedbackSubmit" type="button">
                    보내기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="toastContainer" className="toast-container" />

      <div className="help-modal" id="helpModal">
        <div className="help-modal-inner">
          <div className="help-modal-header">
            <div className="help-modal-title">사용법</div>
            <button className="btn" id="helpClose" type="button">
              닫기
            </button>
          </div>
          <div className="help-modal-body">
            <ul>
              <li>날짜 더블클릭 → 새 카드 추가</li>
              <li>카드 클릭 → 수정, 카드 더블클릭 → 완료 토글</li>
              <li>카드 왼쪽 막대 드래그 → 다른 날짜로 이동</li>
              <li>카드 색상/삭제 버튼은 카드 하단 툴바에서</li>
              <li>↗ 버튼 → 날짜를 크게 보기 (ESC/배경 클릭으로 닫기)</li>
              <li>이모지 패널 → 이모지 추가/업로드, 드래그로 순서 변경</li>
              <li>검색: 이번 달/전체 전환 후 검색</li>
              <li>주말 숨기기/보이기, 스크롤로 이전/다음 달 자동 로드</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
