# Архітектура «Кадру»

## Мета

Розділити код за відповідальністю, щоб пошук джерел, завантаження відео та інтерфейс можна було змінювати незалежно. Це рефакторинг без зміни поведінки, публічних HTTP/WebSocket-контрактів, структури SQLite та формату вже завантажених файлів.

## Принципи

1. Групувати код за функціями: каталог, завантаження, системні дії.
2. Маршрути лише приймають/перевіряють запит, викликають сервіс і повертають відповідь; робота з диском та FFmpeg лишається поза маршрутами.
3. Зовнішні сайти ізольовані в адаптерах із спільним контрактом; логіка черги не знає HTML конкретного сайту.
4. SQLite залишається єдиним сховищем. Не вводити ORM, брокер, Redux чи інший фреймворк без потреби.
5. Зберегти сумісність `state.sqlite3`, API, WebSocket-подій, часткових `.part.*.ts`, MP4, `Сезон.m3u8` і запускаторів.
6. Перевіряти зміни автотестами бекенду, фронтенду та збіркою релізу.

## Структура

```text
video-downloader/
├─ backend/
│  ├─ launch.py                       # локальний запуск, відкриття браузера
│  └─ app/
│     ├─ main.py                      # create_app, життєвий цикл, підключення маршрутів
│     ├─ api/
│     │  ├─ dependencies.py            # доступ до сервісів, перевірка локального токена
│     │  ├─ events.py                  # розсилка подій клієнтам
│     │  └─ routes/
│     │     ├─ scans.py
│     │     ├─ jobs.py
│     │     ├─ folders.py
│     │     └─ events.py               # WebSocket
│     ├─ catalog/
│     │  ├─ models.py                  # Variant, Episode, Catalog, ScanState
│     │  ├─ service.py                 # сканування й стан пошуку
│     │  ├─ url_security.py            # перевірка адрес джерел і потоків
│     │  └─ sources/
│     │     ├─ registry.py             # вибір адаптера
│     │     ├─ http.py                 # HTTP/браузерний доступ
│     │     ├─ hls.py                  # плейлисти та варіанти потоків
│     │     ├─ uakino.py
│     │     └─ uaflix.py
│     ├─ downloads/
│     │  ├─ models.py                  # DownloadJob, EpisodeProgress
│     │  ├─ quality.py                 # вибір варіанта за шириною/міткою
│     │  ├─ service.py                 # створення, повтор, скасування, видалення
│     │  ├─ runner.py                  # черга, паралельність, життєвий цикл епізодів
│     │  ├─ media.py                   # запуск FFmpeg/ffprobe, прогрес, перевірка MP4
│     │  └─ files.py                   # безпечні назви та плейлист
│     ├─ storage/
│     │  └─ sqlite.py                  # наявні таблиці scans/jobs/settings
│     └─ system/
│        ├─ ffmpeg.py                  # пошук виконуваних файлів
│        ├─ folders.py                 # Windows-діалог і папка Downloads
│        └─ open_path.py               # безпечне відкриття файлу й папки
├─ frontend/
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx                       # композиція сторінки
│     ├─ api/
│     │  ├─ client.ts                  # токен, fetch та обробка помилок
│     │  ├─ scans.ts
│     │  ├─ jobs.ts
│     │  ├─ folders.ts
│     │  ├─ events.ts                  # WebSocket
│     │  └─ index.ts
│     ├─ domain/
│     │  ├─ catalog.ts                 # типи каталогу й серій
│     │  └─ jobs.ts                    # типи завдань і прогресу
│     ├─ features/
│     │  ├─ search/
│     │  │  ├─ useScan.ts
│     │  │  ├─ SearchForm.tsx
│     │  │  └─ ScanStatus.tsx
│     │  ├─ catalog/
│     │  │  ├─ useSelection.ts
│     │  │  ├─ quality.ts              # групування 1920/1280/854 тощо
│     │  │  ├─ useFolder.ts
│     │  │  ├─ CatalogHeading.tsx
│     │  │  ├─ CatalogView.tsx
│     │  │  ├─ EpisodeList.tsx
│     │  │  └─ DownloadSettings.tsx
│     │  └─ downloads/
│     │     ├─ useJobs.ts
│     │     ├─ history.ts              # фільтри та захист від дублювання
│     │     ├─ JobList.tsx
│     │     ├─ JobCard.tsx
│     │     └─ JobEpisodeRow.tsx
│     ├─ shared/
│     │  ├─ format.ts                  # розмір, час, роздільність
│     │  └─ statuses.ts
│     └─ styles/
│        ├─ tokens.css
│        ├─ base.css
│        ├─ catalog.css
│        ├─ downloads.css
│        └─ responsive.css
├─ tests/
│  └─ backend/                       # сервіси, маршрути, джерела, безпека
├─ frontend/tests/                  # компоненти, API та сценарії користувача
├─ tools/                             # збірка релізу та інсталятора
└─ docs/
   ├─ architecture.md
   └─ superpowers/plans/
```

## Межі та потоки даних

`HTTP/WebSocket → api/routes → catalog/downloads service → storage або sources/media/files`.

`React App → feature hook → api client → backend`; компоненти отримують дані й дії через props. Чиста логіка якості та фільтрів не залежить від React.

`backend/app/jobs`, `backend/app/sources`, `backend/app/models.py`, `backend/app/security.py`, `frontend/src/api.ts` і `frontend/src/types.ts` залишені як оболонки для сумісності старих імпортів. Новий код імпортує безпосередньо з функціональних модулів.

## Критерії збереження поведінки

- UAKINO та UAFLIX, фільми й серіали, озвучення, вибір серій та груп якості працюють як зараз.
- Паралельне/послідовне завантаження, відновлення `.part.*.ts`, збирання MP4, перевірка, швидкість і час не змінюються.
- Історія, повтор, скасування, видалення з підтвердженням і відкриття файлу/папки працюють після перезапуску.
- Уже створена база SQLite читається без міграції; старі значення якості (`960p`, `max`) залишаються підтриманими.
- `Запустити Кадр.bat`, `DownloadUA.bat`, `tools/build_release.py` і зібраний архів продовжують запускати застосунок.
