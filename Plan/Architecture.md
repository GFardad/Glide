# Glide — Architecture Plan (v1)

## ملکیت: این سند نسخه جدیدتر ایده اصلی در `RawIdea.md` است و در صورت تعارض، این سند غلبه دارد.

---

## ۰. فلسفه کلی

سیستم کاملاً در لوکال اجرا می‌شود.
هدف: استفاده از حجم بالا توکن مدل‌های میانه‌قدرت به جای تعداد کم توکن مدل قوی.
الگو: Prime-Agent + فرآیند چندلایه Glide.
مبنای ارائه: MCP stdio از سمت Hermes.
مرتبط: OmniForge به عنوان الگو اولیه، ولی Glide ادغام و بازنویسی نهایی است.

### ۰.1 ساختار فنی و کیفیت

- TypeScript monorepo با pnpm workspaces
- Production-grade: strict mode، type-safe، test coverage
- Modularity: هر package مسئول یک domain است و بین packageها فقط از public API استفاده می‌شود
- Avoid vibe-coded slop: type-level validation، schema-first design، deterministic execution
- Open-source first: از کتابخانه‌های موجود استفاده کن، چرخ را از نو اختراع نکن
- Global-ready: architecture باید بتواند مقیاس‌پذیر باشد بدون refactor major

---

## 1. لایه‌ها

### 1.1 لایه صفر — سشن هرمس به عنوان CTO/Interpreter

این لایه **یک اسکیل هرمس** است، نه سرویس systemd و نه ایجنت Glide.
**وظایف:**

- گرفتن ایده خام از کاربر به زبان انسان
- پرسش هدفمند برای شفاف‌سازی
- نوشتن فایل‌های campaign در حین گفتگو:
  - `GOAL.md` — هدف اصلی
  - `NON_GOALS.md` — صریحاً ممنوعه
  - `ASSUMPTIONS.md` — فرضیات که باید بعداً اثربخورد
- جلوگیری از گم شدن دستورات مهم کاربر
- وقتی منظور کاربر شفاف شد → ارسال مستقیم به MCP Glide via `glide_headroom`

**نکته:** این لایه فقط یک skill Hermes است و از `delegate_task` استفاده نمی‌کند.

### 1.2 لایه یک — Headroom (اتاق فکر)

**مالک:** CTO (که خودش در سشن هرمس قرار دارد)
**تشکیل:** ۱۰–۱۵ ایجنت Glide با شخصیت‌های متفاوت
**نقش CTO در جلسه:**

- مراقب هدف کاربر باشد و در صورت Drift شدید، جلسه را به ریل برگرداند
- وقتی بحث به نقطه reached رسید، اعلام کند: «از بحث خارج شو، شروع به نوشتن Plan کن»
  **خروجی:** Risk Log + معماری سطح بالا + Todo Registry
  **محدودیت:** فقط ایده را نقد می‌کنند و پلن می‌نویسند؛ کد نمی‌نویسند.

### 1.3 لایه دو — مدیریت برنامه (CTO-owned)

CTO خروجی Headroom را دریافت می‌کند:

- Epicها
- تیم‌ها + مدیر تیم
- درخت وظایف
  هر والد فقط خلاصه فرزند را می‌بیند.

### 1.4 لایه سه — تیم‌های اجرایی

تیم‌های تخصصی: کدنویسی، تست، طراحی، تحقیق، امنیت، بهینه‌سازی
هر ایجنت فایل‌های MD شخصی دارد:

- `PERSONALITY.md`
- `GOAL.md`
- `NOTES.md`
- `TODO.md`
- `REJECTED.md`

---

## 2. ابزارهای MCP (Command Surface)

### 2.1 فلسفه ابزارها

- MCP Glide مانند CLI عمل می‌کند؛ اما کنترل سطح دسترسی دارد.
- دو دسترسی:
  1. **CTO Session** (سشن هرمس CTO) — دسترسی کامل
  2. **Agent Native** (ایجنت‌های درون Glide) — دسترسی محدود بر اساس نقش والد

### 2.2 ابزارهای پیشنهادی

#### tools/

- `glide_status` — وضعیت کلی
- `glide_goal_set` / `glide_goal_get` — تعیین/خواندن هدف اصلی
- `glide_headroom` — برگزار جلسه Headroom
- `glide_plan` — خروجی Headroom را به Plan عملی تبدیل کن
- `glide_build` — شروع ساخت
- `glide_test` — تست‌های پذیرش
- `glide_review` — بازبینی کد
- `glide_ship` — انتشار

#### agent/

- `glide_indepth` — گرفتن ID ایجنت، نوشتن تمام context آن در فایل، بازگشت مسیر
  - خروجی: JSON در `runtime/workspace/indepth/<agent_id>.json`
  - شامل: agent_id، parent_id، role، objective، تمام NOTES/TODO/REJECTED aggregated، session_path
- `glide_trace` — trace کامل از خط کد به ایجنت والد تا Headroom
  - ورودی: خط کد یا file_path
  - خروجی: chain از code line → agent_id → parent_ids → Headroom session
  - Git integration: استفاده از `git blame` برای پیدا کردن agent_id مربوط به خط کد
- `glide_context` — context فرزندان یک ایجنت (فقط برای والد)

#### governance/

- `glide_permission_request` — درخواست دسترسی جدید
- `glide_permission_approve` — تایید والد
- `glide_rejected_log` — مشاهده موارد رد شده با دلیل

---

## 3. مدل اجرا

### 3.1 چرا delegate_task هرمس استفاده نمی‌شود

- قید کاربر: «از delegate_task استفاده نکنید»
- Glide باید lab-level کنترل داشته باشد: بودجه توکن، دسترسی MCP، محدودیت عمق
- استفاده از MCP stdio به عنوان دستورات، مانند CLI عمل می‌کند و سطح دسترسی را در خود سرویس مدیریت می‌کند.

### 3.2 Prime-Agent wiring

- الگو: Prime-Agent
- استفاده: context/session durability + process spawning + session budget
- هر ایجنت Glide یک session durable دارد؛ خروجی در workspace ایجنت ذخیره می‌شود.

### 3.3 OpenCode / Hermes Agent به عنوان پلاگین

- Glide باید قابلیت نصب skill و MCP خارجی را داشته باشد.
- هر MCP خارجی (OpenCode و غیره) می‌تواند به صورت پلاگین متصل شود.
- سطوح دسترسی توسط CTO تعیین می‌شود.

### 3.4 Token Budget Strategy

- هدف اصلی: حجم بالا توکن مدل‌های میانه‌قدرت
- بودجه هر ایجنت در PERSONALITY.md تعریف می‌شود
- والدین only می‌بینند summary، نه full history
- هر جلسه/Epic سقف تعداد دور گفت‌وگو دارد (مثلاً ۳–۵ دور)
- اولویت با مدل‌های میانه‌قدرت ارزان‌قیمت

---

## 4. استقرار

### 4.1 فاز ۰: ساخت اسکلت + rename

- ساخت ساختار پوشه‌ها در `~/Projects/Glide/`
- نگارش اسکلت CTO/Interpreter skill
- تعریف MCP stub
- مستندسازی ساختار TypeScript monorepo در `Plan/Architecture.md`

### 4.2 فاز ۱: لایه صفر

- ساخت skill Hermes برای ترجمه ایده → فایل
- تست با ایده ساده

### 4.3 فاز ۲: لایه یک

- CTO + Headroom MCP
- جلسات متعدد با ۴–۵ نقش اولیه

### 4.4 فاز ۳: لایه دو

- تقسیم Epic → تیم → ایجنت
- درخت وظایف + فایل‌های MD

### 4.5 فاز ۴: لایه سه

- تیم‌های اجرایی
- یکپارچه‌سازی با ابزارهای موجود (بازنویسی از ابتدا نکن)

### 4.6 فاز ۵: Trace + Permission

- `glide_trace` با git integration
- `glide_indepth`
- سیستم درخواست/تایید دسترسی

### 4.7 فاز ۶: وب‌سرویس یا داشبورد

- رابط کاربری برای مشاهده اتاق مجازی
- یا استفاده از skill هرمس به عنوان داشبورد

---

## 5. اصول طراحی

1. هیچ Daisy chain منطقی از صفر اختراع نکن؛ از موجودات باز استفاده کن.
2. MCP Glide فقط یک سطح دستورات است؛ مدیریت واقعی در خود Glide است.
3. Hermes فقط لایه صفر و نمایش است؛ Glide موتور اجراست.
4. کل Everything در context می‌ماند؛ والد فقط خلاصه می‌بیند.
5. هدف کاربر خط قرمز است و CTO Mercy آن را حفظ می‌کند.
6. OmniForge الگو اولیه است؛ Glide ادغام نهایی و بازنویسی شده.
7. TypeScript monorepo است؛ production-grade، modular، قابل توسعه جهانی.

---

## 6. ساختار فنی — TypeScript Monorepo

### 6.1 Packages

- `packages/core` — خطاها، type guards، utilities مشترک
- `packages/mcp-server` — سرور MCP stdio
- `packages/headroom` — runtime جلسات Headroom
- `packages/executor` — اجرای تیم‌ها و ایجنت‌ها
- `packages/tracer` — `glide_trace` و `glide_indepth`
- `packages/permissions` — دسترسی‌ها و تاییدیه‌ها
- `packages/plugin-api` — API برای پلاگین‌های خارجی

### 6.2 تست و کیفیت

- Vitest برای unit/integration tests
- ESLint + Prettier
- TypeScript strict mode
- Coverage reporting
- CI-ready scripts

### 6.3 وابستگی‌های اصلی

- `@modelcontextprotocol/sdk` — MCP stdio server
- `zod` — اعتبارسنجی schema
- `simple-git` — trace via git blame
- `ulid` / `nanoid` — تولید ID session/agent

### 6.4 محدودیت‌های فنی

- هیچ کد production-grade بدون test accepted نمی‌شود
- هر package باید public API مشخص داشته باشد
- بین packageها فقط از public API استفاده می‌شود
- هیچ circular dependency بین packageها مجاز نیست
