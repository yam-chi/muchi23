"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type CardData = {
  id: string; // uuid string
  text: string; // HTML-safe string (text + optional <img class="emoji-img" src="data:image/...">)
  done: boolean;
  color: string;
  sectionId?: string;
  sectionTitle?: string;
  originSectionId?: string;
  originSectionTitle?: string;
  originDateKey?: string;
};

type SectionData = {
  id: string;
  title: string;
  order: number;
};

type State = {
  cards: Record<string, CardData[]>;
  sections: Record<string, SectionData[]>;
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

    let current = new Date();
    current.setDate(1);
    let pickerYear = current.getFullYear();
    // 인피니트 스크롤 범위: 시작 달(포함) / 끝 달 시작(제외)
    let startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
    let endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);

    let state: State = { cards: {}, weekVisibility: {}, sections: {} };
    let headerCollapsed = false;
    let showWeekend = true;
    let marqueeBox: HTMLDivElement | null = null;
    let marqueeStart: { x: number; y: number } | null = null;
    let marqueeActive = false;
    const SCALE_KEY = "muchi-ui-scale";
    let lastActiveDayCell: HTMLElement | null = null;
    let lastActiveDateKey: string | null = null;
    let cardClipboard: CardData[] = [];
    let emojiList: Array<{ id: string; src: string; name: string }> = [];
    let emojiOrder: string[] = [];
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
    let tabs: Array<{ id: string; name: string }> = [];
    let activeTabId = "work";
    const tabBar = document.getElementById("tabBar") as HTMLElement | null;
    // moved to component scope

    function toggleSelection(card: HTMLDivElement) {
      card.classList.toggle("selected");
    }

    function clearSelection() {
      document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
    }

    function sanitizeToTextAndEmojis(html: string) {
      const container = document.createElement("div");
      container.innerHTML = html;
      const parts: string[] = [];
      const allowedImg = (el: Element) =>
        el.tagName.toLowerCase() === "img" &&
        el.getAttribute("src")?.startsWith("data:image/") &&
        (el as HTMLImageElement).src.length < 500000; // cap size

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          parts.push(node.textContent ?? "");
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === "br") {
          parts.push("<br>");
          return;
        }
        if (allowedImg(el)) {
          const src = el.getAttribute("src") || "";
          parts.push(`<img class="emoji-img" src="${src}">`);
          return;
        }
        const isBlock = ["div", "p", "section", "article", "header", "footer", "li"].includes(tag);
        el.childNodes.forEach(walk);
        if (isBlock) parts.push("<br>");
      };

      container.childNodes.forEach(walk);
      return parts.join("");
    }

    function normalizeCardHtmlForSave(html: string) {
      const sanitized = sanitizeToTextAndEmojis(html);
      return sanitized.replace(/<br\s*\/?>/gi, "\n");
    }

    function renderCardHtml(text: string) {
      const sanitized = sanitizeToTextAndEmojis(text || "");
      return sanitized.replace(/\n/g, "<br>");
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

    function setActiveDay(cell: HTMLElement | null) {
      if (!cell || !cell.classList.contains("day-cell")) return;
      const key = cell.dataset.date || null;
      if (lastActiveDayCell && lastActiveDayCell !== cell) {
        lastActiveDayCell.classList.remove("active-day");
      }
      lastActiveDayCell = cell;
      lastActiveDateKey = key;
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
        const dateKey = c.dataset.date;
        const idStr = c.dataset.cardId;
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
      historyIndex--;
      const prev = history[historyIndex];
      state = JSON.parse(JSON.stringify(prev));
      saveState();
      renderCalendar();
      if (!previewMode) {
        requestAnimationFrame(() => {
          void periodicSync();
        });
      }
    }

    function loadScale() {
      try {
        const raw = localStorage.getItem(SCALE_KEY);
        if (!raw) return;
        const v = Number(raw);
        if (Number.isFinite(v) && v >= 0.8 && v <= 1.3) {
          document.documentElement.style.setProperty("--ui-scale", String(v));
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

    function adjustScale(delta: number) {
      const current = Number(
        getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"),
      );
      const next = Math.max(0.8, Math.min(1.3, current + delta));
      document.documentElement.style.setProperty("--ui-scale", String(next));
      saveScale(next);
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
      state.cards = {};
      history = [];
      historyIndex = -1;
      clearSelection();
      renderTabs();
      await loadState();
      pushHistory();
      renderCalendar();
    }

    async function fetchCardsFromSupabase() {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, date_key, text, done, color, board_id, section_id, section_title, origin_section_id, origin_section_title, origin_date_key",
        )
        .eq("user_id", uid)
        .eq("board_id", activeTabId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("supabase load error", error);
        return;
      }
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
      state.cards = grouped;
      state.sections = sectionMap;
      saveLocalState();
    }

    async function loadState() {
      // Supabase 데이터 우선
      if (!previewMode) {
        await fetchCardsFromSupabase();
      }
      // Supabase에 아무 것도 없을 때만 로컬 캐시 복구
      const local = loadLocalState();
      if (!Object.keys(state.cards).length && local?.cards) {
        state.cards = local.cards;
      }
      if (local?.sections) {
        state.sections = local.sections;
      }
    }

    function saveState() {
      // Supabase를 단일 저장소로 사용 중이므로 로컬 스토리지 저장은 생략
    }

    function saveLocalState() {
      try {
        const payload = { cards: state.cards, sections: state.sections };
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

    async function upsertCardToSupabase(dateKey: string, cardObj: CardData) {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      console.log("[supabase] upsert single", { dateKey, id: cardObj.id });
      const { error } = await supabase
        .from("cards")
        .upsert({
          id: cardObj.id,
          user_id: uid,
          board_id: activeTabId,
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

    // 주기적 전체 동기화: DOM -> state -> Supabase
    function buildInList(arr: string[]) {
      // PostgREST not.in expects (id1,id2,...) with quotes for text
      return `(${arr.map((id) => `"${id}"`).join(",")})`;
    }

    async function periodicSync() {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;

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
          ids.push(c.id);
          rows.push({
            id: c.id,
            user_id: uid,
            board_id: activeTabId,
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
      const { error: upErr } = await supabase.from("cards").upsert(rows);
      if (upErr) {
        console.error("supabase periodic upsert error", upErr);
      }
      // Supabase에는 있는데 state에는 없는 카드 제거
      if (ids.length) {
        const inList = buildInList(ids);
        const { error: delErr, data: delData } = await supabase
          .from("cards")
          .delete()
          .eq("user_id", uid)
          .eq("board_id", activeTabId)
          .not("id", "in", inList)
          .select("*");
        if (delErr) {
          console.error("supabase periodic delete error", delErr);
        } else if (Array.isArray(delData) && delData.length) {
          console.log("supabase periodic pruned", delData.length);
        }
      }
    }

    async function deleteCardInSupabase(id: string) {
      if (previewMode) return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      const { error, data } = await supabase
        .from("cards")
        .delete()
        .eq("id", id)
        .eq("user_id", uid)
        .eq("board_id", activeTabId);
      if (error) console.error("supabase delete error", error);
      else console.log("supabase delete ok", id, data);
    }

    const getCardsForDate = (dateKey: string) => {
      const list = state.cards[dateKey];
      return Array.isArray(list) ? list : [];
    };

    const getSectionsForDate = (dateKey: string) => {
      const list = state.sections[dateKey];
      return Array.isArray(list) ? list : [];
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

      function onBlur() {
        safeContent.removeEventListener("blur", onBlur);
        safeContent.removeEventListener("keydown", onKey);
        safeContent.contentEditable = "false";
        syncOneCardFromDom(card);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          e.preventDefault();
          safeContent.blur();
        }
      }
      safeContent.addEventListener("blur", onBlur);
      safeContent.addEventListener("keydown", onKey);
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
      const btnDone = document.createElement("button");
      btnDone.className = "card-btn card-btn-done";
      btnDone.textContent = "✓";
      const btnColor = document.createElement("button");
      btnColor.className = "card-btn card-btn-color";
      btnColor.textContent = "색";
      const btnDelete = document.createElement("button");
      btnDelete.className = "card-btn card-btn-delete";
      btnDelete.textContent = "×";
      toolbar.appendChild(btnColor);
      toolbar.appendChild(btnDone);
      toolbar.appendChild(btnDelete);

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
          if (keepFocusFromPalette) return;
          const active = document.activeElement as HTMLElement | null;
          if (active && (active.closest(".emoji-palette") || active.closest(".card-content"))) {
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

      if (done) card.classList.add("done");

      card.appendChild(handle);
      card.appendChild(doneBadge);
      card.appendChild(content);
      card.appendChild(toolbar);
      container.appendChild(card);

      card.addEventListener("click", (e) => {
        if (e.shiftKey) {
          e.stopPropagation();
          toggleSelection(card);
          return;
        }
        clearSelection();
        card.classList.add("selected");
        const day = card.closest(".day-cell") as HTMLElement | null;
        setActiveDay(day);
        setActiveSection(day, card.dataset.sectionId || "default");
        const contentEl = card.querySelector(".card-content") as HTMLDivElement | null;
        if (!contentEl || contentEl.isContentEditable) return;
        makeEditable(card);
      });

      btnDone.addEventListener("click", (e) => {
        e.stopPropagation();
        const cell = card.closest(".day-cell") as HTMLElement | null;
        const currentlyDone = card.classList.contains("done");
        if (!cell) return;
        if (currentlyDone) {
          card.classList.remove("done");
          const originDate = card.dataset.originDateKey || card.dataset.date;
          const originSectionId = card.dataset.originSectionId || "default";
          const originTitle =
            card.dataset.originSectionTitle ||
            (originDate ? getSectionTitle(originDate, originSectionId) : "");
          const targetCell =
            (originDate
              ? document.querySelector<HTMLElement>(`.day-cell[data-date="${originDate}"]`)
              : null) || cell;
          if (targetCell) {
            let nextSectionId = originSectionId || "default";
            let nextTitle =
              originTitle || getSectionTitle(targetCell.dataset.date || originDate || "", nextSectionId);
            let targetBody = getSectionBodyById(targetCell, nextSectionId);
            if (!targetBody) {
              nextSectionId = "default";
              nextTitle = getSectionTitle(targetCell.dataset.date || originDate || "", nextSectionId);
              targetBody =
                getSectionBodyById(targetCell, "default") ||
                (targetCell.querySelector(".day-section-body") as HTMLElement | null);
            }
            if (targetBody) {
              const destDate = targetCell.dataset.date || originDate || "";
              if (destDate) card.dataset.date = destDate;
              card.dataset.sectionId = nextSectionId;
              card.dataset.sectionTitle = nextTitle;
              targetBody.appendChild(card);
              setActiveSection(targetCell, nextSectionId);
              updateSectionHints(targetCell);
              cleanupDoneSection(targetCell);
            }
          }
          card.dataset.originSectionId = "";
          card.dataset.originSectionTitle = "";
          card.dataset.originDateKey = "";
          updateSectionHints(cell);
          cleanupDoneSection(cell);
        } else {
          const originSectionId = card.dataset.sectionId || "default";
          const originTitle = card.dataset.sectionTitle || getSectionTitle(card.dataset.date || "", originSectionId);
          const originDateKey = card.dataset.date || "";
          if (!card.dataset.originSectionId) {
            card.dataset.originSectionId = originSectionId;
            card.dataset.originSectionTitle = originTitle;
            card.dataset.originDateKey = originDateKey;
          }
          const doneBody = ensureDoneSectionBody(cell);
          if (!doneBody) return;
          card.classList.add("done");
          card.dataset.sectionId = DONE_SECTION_ID;
          card.dataset.sectionTitle = "완료";
          doneBody.appendChild(card);
          setActiveSection(cell, DONE_SECTION_ID);
        }
        syncOneCardFromDom(card);
        syncCurrentMonthFromDom();
        saveLocalState();
        const dKey = card.dataset.date;
        if (dKey) updateDayBadge(dKey);
        updateSectionHints(cell);
        cleanupDoneSection(cell);
      });

      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        const targets = selectedCards.length ? selectedCards : [card];
        deleteCards(targets);
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

      // 앞쪽 빈 셀로 요일 정렬
      for (let i = 0; i < leadingEmpty; i++) {
        const placeholder = document.createElement("div");
        placeholder.className = "day-cell placeholder";
        calendarGrid.appendChild(placeholder);
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
        const doneCards: CardData[] = [];
        const cardsBySection = new Map<string, CardData[]>();
        cards.forEach((card) => {
          const sectionId = card.sectionId === DONE_SECTION_ID ? DONE_SECTION_ID : "default";
          if (card.done || sectionId === DONE_SECTION_ID) {
            doneCards.push({ ...card, sectionId: DONE_SECTION_ID, sectionTitle: "완료" });
            return;
          }
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

        if (doneCards.length > 0) {
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
          doneCards.forEach((data) => {
            createCard(doneBody, data, { autoEdit: false, fromState: true });
          });
          doneEl.appendChild(doneHeader);
          doneEl.appendChild(doneBody);
          sectionsWrap.appendChild(doneEl);
        }

        updateDayBadge(key);

        metaWrap.appendChild(numEl);
        metaWrap.appendChild(metaEl);
        header.appendChild(metaWrap);
        header.appendChild(expandBtn);
        cell.appendChild(header);
        cell.appendChild(sectionsWrap);
        calendarGrid.appendChild(cell);

        if (!cell.dataset.activeSectionId) {
          cell.dataset.activeSectionId = "default";
        }
        setActiveSection(cell, cell.dataset.activeSectionId);

        cell.addEventListener("mouseenter", () => {
          cell.classList.add("hovered-day");
        });

        cell.addEventListener("mouseleave", () => {
          cell.classList.remove("hovered-day");
        });

        cell.addEventListener("click", () => {
          setActiveDay(cell);
        });

        expandBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (expandedCell === cell) {
            collapseExpandedCell();
          } else {
            expandDayCell(cell);
          }
        });

        cell.addEventListener("dblclick", () => {
          if (!cell.dataset.date) return;
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
        calendarGrid.appendChild(placeholder);
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
          const match = list.find((c) => (c.text || "").toLowerCase().includes(q));
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
        };
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

    loadState()
      .then(() => {
        pushHistory();
        loadScale();
        renderCalendar();
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

    // 이전/다음 달 버튼: 인피니트 스크롤과 함께 범위 재설정
    // prev/next 버튼은 숨김 상태 (동작 비활성)

    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        syncCurrentMonthFromDom();
        const now = new Date();
        current = new Date(now.getFullYear(), now.getMonth(), 1);
        startCursor = new Date(current.getFullYear(), current.getMonth(), 1);
        endCursor = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        renderCalendar();
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLDivElement>(".day-cell.today");
          if (target) {
            const container = calendarWrapper || document.documentElement;
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const headerHeight = headerCollapsed ? 0 : 140;
            const desiredOffset = container.clientHeight * 0.5;
            const offset =
              targetRect.top - containerRect.top + container.scrollTop - headerHeight - desiredOffset;
            skipAutoExtend = true;
            container.scrollTo({ top: Math.max(offset, 0), behavior: "smooth" });
            setTimeout(() => {
              skipAutoExtend = false;
              syncMonthHeaderWithScroll();
            }, 450);
          } else if (calendarWrapper) {
            skipAutoExtend = true;
            calendarWrapper.scrollTop = 0;
            setTimeout(() => {
              skipAutoExtend = false;
              syncMonthHeaderWithScroll();
            }, 120);
          }
        });
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
      collapseExpandedBtn.addEventListener("click", () => collapseExpandedCell());
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
            createCard(body, { text: "", done: false, color: "default" }, { autoEdit: true, fromState: false });
            const key = activeCell.dataset.date;
            if (key) updateDayBadge(key);
            setActiveDay(activeCell);
            pushHistory();
            updateSectionHints(activeCell);
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (isEditableTarget(e.target as HTMLElement)) return;
        const selectedCards = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
        if (!selectedCards.length) return;
        e.preventDefault();
        deleteCards(selectedCards);
      }
      if (!isEditableTarget(e.target as HTMLElement)) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveActiveDay(-1, 0);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveActiveDay(1, 0);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moveActiveDay(0, -1);
        } else if (e.key === "ArrowDown") {
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
      document.removeEventListener("mousemove", onMarqueeMove);
      setTimeout(() => {
        marqueeActive = false;
      }, 0);
    }

    function copySelectedCards(e: ClipboardEvent) {
      if (isEditableTarget(e.target as HTMLElement)) return;
      const selected = Array.from(document.querySelectorAll<HTMLDivElement>(".card.selected"));
      if (!selected.length) return;
      const data: CardData[] = selected.map((card) => {
        const content = card.querySelector(".card-content");
        return {
          id: card.dataset.cardId || newId(),
          text: content ? content.textContent ?? "" : "",
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

      let data: CardData[] = [];
      const jsonStr = e.clipboardData?.getData("application/json");
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              if (Array.isArray(parsed)) {
                data = parsed
                  .map((c) => ({
                    id: newId(),
                    text: c.text ?? "",
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
      if (!data.length) return;
      e.preventDefault();

      data.forEach((c) => {
        const created = createCard(
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
        document.documentElement.style.setProperty("--ui-scale", "1");
        saveScale(1);
      });
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
        }
        return btn;
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
        const target = (e.target as HTMLElement).closest(".emoji-btn");
        const children = Array.from(listEl.children);
        if (target && target.parentElement === listEl) {
          const rect = target.getBoundingClientRect();
          const before = e.clientY < rect.top + rect.height / 2;
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

    if (emojiTriggers.length && emojiPalette) {
      emojiTriggers.forEach((trg) => {
        trg.addEventListener("mousedown", (e) => {
          keepFocusFromPalette = true;
          e.preventDefault();
          e.stopPropagation();
          if (lastActiveCardContent) {
            lastActiveCardContent.focus();
            const sel = window.getSelection();
            sel?.removeAllRanges();
            if (lastRange) sel?.addRange(lastRange);
          }
        });

        trg.addEventListener("click", (e) => {
          e.stopPropagation();
          const isExpandedTrigger = trg === emojiTriggerExpanded;
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
      document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (emojiPalette.contains(t) || emojiTriggers.some((btn) => btn.contains(t))) return;
        closeEmojiPalette();
      });
    }

    loadEmojis();
    loadEmojiOrder();
    renderEmojiPalette();

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
            <div className="emoji-panel">
              <button className="link-btn" id="emojiTrigger" type="button">
                EMOJI
              </button>
              <input id="emojiUpload" type="file" accept="image/*" style={{ display: "none" }} />
              <div className="emoji-palette" id="emojiPalette">
                <div className="emoji-upload-row">
                  <button className="btn" id="emojiUploadTrigger" type="button">
                    업로드
                  </button>
                </div>
              </div>
            </div>
            <div className="scale-control">
              <button className="link-btn" id="scaleReset" type="button">
                ZOOM
              </button>
            </div>
            <button className="link-btn" id="settingsBtn" type="button">
              SETTING
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
          <div className="tab-strip">
            <div className="tab-bar" id="tabBar" />
          </div>
          <div className="calendar-grid" id="calendarGrid" />
        </div>
      </div>

      <div className="expanded-overlay" id="expandedOverlay">
        <div className="expanded-overlay-inner">
          <div className="expanded-overlay-bar">
            <button className="btn icon-btn" id="emojiTriggerExpanded" type="button" title="Emoji">
              😊
            </button>
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
