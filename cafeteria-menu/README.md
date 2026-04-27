# 🍽 Yemekhane Menü Planlayıcı
**School Cafeteria Monthly Menu Planning Application**

A modern, full-featured web application for planning daily 4-course monthly menus compliant with traditional Turkish cuisine and official school dormitory cafeteria regulations.

---

## 🗂 Folder Structure

```
cafeteria-menu/
├── src/
│   ├── app/
│   │   ├── globals.css         # Tailwind base + custom scrollbar styles
│   │   ├── layout.tsx          # Root layout with metadata & fonts
│   │   └── page.tsx            # Main app shell (tab routing)
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Sidebar.tsx     # Navigation sidebar (tab switcher)
│   │   │   └── ToastContainer.tsx  # Animated toast notification system
│   │   │
│   │   ├── planner/
│   │   │   ├── MenuPlanner.tsx # Wrapper with Calendar/List view toggle
│   │   │   ├── CalendarView.tsx # Month grid calendar with completion dots
│   │   │   ├── ListView.tsx    # Tabular daily list view
│   │   │   └── DayEditor.tsx   # Modal for editing a single day's menu
│   │   │
│   │   ├── pool/
│   │   │   └── PoolManager.tsx # CRUD panels for all 4 food categories
│   │   │
│   │   └── export/
│   │       └── ExportPanel.tsx # Excel (.xlsx) export + browser print/PDF
│   │
│   ├── context/
│   │   └── store.ts            # Zustand store with localStorage persistence
│   │
│   ├── hooks/
│   │   └── useLocalStorage.ts  # Generic typed localStorage custom hook
│   │
│   ├── lib/
│   │   ├── seedData.ts         # Turkish cafeteria seed data + category meta
│   │   └── utils.ts            # Date helpers, cn(), Turkish month/day names
│   │
│   └── types/
│       └── index.ts            # All TypeScript interfaces and types
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
└── next.config.mjs
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone or copy project files
cd cafeteria-menu

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Production Build

```bash
npm run build
npm start
```

---

## ✨ Features

### 1. Pool Management (CRUD)
- **4 category panels**: Çorbalar, Ana Yemekler, Yan Yemekler, Tamamlayıcılar
- Add new items with Enter key or button click
- Delete items with hover-reveal trash icon
- In-panel search/filter
- Duplicate detection with error toast
- Removing an item automatically clears it from all menus

### 2. Monthly Menu Builder
- **Calendar view**: Visual month grid with colored completion dots per category
- **List view**: Spreadsheet-style table for all days
- Click any day to open the **Day Editor modal**
- Dropdowns for each of the 4 categories populated from the pool
- "Clear day" reset button in modal

### 3. Conflict / Repetition Alert System
- Automatically detects when a Main Course is scheduled **in the same week** or **same month**
- **In-modal inline warning** with conflicting dates listed
- **Toast notification** with type (weekly vs. monthly) and conflict dates
- Warning badge appears on calendar day cell (⚠️ icon)

### 4. Export & Share
- **Excel (.xlsx)**: Formatted spreadsheet with merged title row, column widths
- **Print / PDF**: Opens a clean, print-ready HTML page that auto-triggers the browser print dialog
- Completeness stats: Total days, planned days, fully complete days
- Visual progress bar

### 5. Persistence
- All data (food pools + menus) persisted in `localStorage` via Zustand's `persist` middleware
- Custom `useLocalStorage` hook available for component-level use
- Cross-tab sync via `storage` event listener

---

## 🏗 Architecture Decisions

| Concern | Solution | Rationale |
|---|---|---|
| State Management | **Zustand** with `persist` | Minimal boilerplate, tree-shakeable, perfect for this scale |
| Persistence | `localStorage` via Zustand persist | No backend required, survives refresh |
| Styling | **Tailwind CSS** | Utility-first, dark theme, responsive |
| Icons | **Lucide React** | Clean, consistent icon set |
| Excel Export | **xlsx** (SheetJS community) | Mature, no server needed |
| TypeScript | Strict mode | Full type safety across all layers |

---

## 🔧 Extending the App

### Add a new food category
1. Add the `CategoryKey` union in `src/types/index.ts`
2. Add `CATEGORY_META` entry in `src/lib/seedData.ts`
3. Add seed items with the new category key
4. Update `FIELD_MAP` and `CAT_ICONS` in `DayEditor.tsx` and `ListView.tsx`
5. Update `DailyMenu` interface in `src/types/index.ts`

### Add backend sync
1. Replace `createJSONStorage(() => localStorage)` in `store.ts` with an API-backed storage adapter
2. Or add a `useEffect` to sync with your API on state changes

---

## 📝 License
MIT
