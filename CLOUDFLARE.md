# Cloudflare Pages — Wicked Detroit RP

Настройки для подключения существующего репозитория:

- Репозиторий: `dmitryvlk45-dot/new-detroit`
- Project name: `wickeddetroit-rp` (если доступно)
- Production branch: `main`
- Framework preset: `None`
- Build command: `node scripts/version-assets.cjs`
- Build output directory: `dist`
- Root directory: оставить пустым
- Платные Workers / дополнительные услуги не нужны.

В панели Cloudflare: Workers & Pages → Create application → Pages → Connect to Git. Разрешить доступ только к указанному репозиторию, затем задать настройки выше и Save and Deploy.

База Supabase остаётся прежней. На новом домене необходимо войти заново. Несинхронизированные локальные черновики автоматически между доменами не переносятся: завершить их или экспортировать до перехода. Старый сайт пока остаётся доступным.

Источник: https://developers.cloudflare.com/pages/get-started/git-integration/
