# Cross-version compatibility testing

Цель: проверить работу `markdown-extra` (1.0.0) на Bitbucket DC **8.19**, **9.6**, **10.2**, чтобы понять — возможен ли единый JAR или нужны Maven-профили.

## Раскладка инстансов

| Версия | Compose | Контейнер | URL | SSH | Debug | Volume |
|--------|---------|-----------|-----|-----|-------|--------|
| 8.19.28 | `docker-compose.yml` | `bitbucket-8.19` | http://localhost:7990 | 7999 | 5006 | `/mnt/ramdisk/bitbucket-data` |
| 9.6.3 | `docker-compose.9x.yml` | `bitbucket-9.6` | http://localhost:7992 | 7997 | 5008 | `/mnt/ramdisk/bitbucket-data-9` |
| 10.2.1 | `docker-compose.10x.yml` | `bitbucket-10.2` | http://localhost:7991 | 7998 | 5007 | `/mnt/ramdisk/bitbucket-data-10` |

Postgres: 15.8 (8.19), 16.6 (9.6 и 10.2). У каждого свой контейнер и volume.

## Память

Bitbucket Xmx=4g + Postgres ~500MB. Три инстанса разом = ~14GB RAM. На машине 125GB, но 113GB уже занято. **Запускай по одному, не все три сразу.**

## Запуск отдельной версии

```bash
cd /mnt/ramdisk/markdown-extra/docker

# 8.19
docker-compose up -d
# 9.6
docker-compose -f docker-compose.9x.yml up -d
# 10.2
docker-compose -f docker-compose.10x.yml up -d
```

Остановка: `docker-compose [-f file] down` (без `-v` чтобы сохранить данные).

## Timebomb-лицензия (для UPM upload + установки плагина)

Bitbucket DC из коробки запросит лицензию. На dev-инстансах используется **timebomb** — официальная 3-часовая evaluation-лицензия от Atlassian.

Где брать:
1. https://my.atlassian.com → **New evaluation license**
2. Product: `Bitbucket Data Center`
3. Organization: что угодно (например `Plainward Dev`)
4. Тип: `Developer` или `Evaluation` → выдаст ключ
5. Лицензия валидна 3 часа после генерации, но ключ можно перегенерировать бесконечно

Альтернатива (быстрее) — **Atlassian Plugin SDK** содержит timebomb через `atlas-run`, но для проверки готового JAR проще через UPM.

После первой установки в setup wizard вводишь:
- Application Title: любое
- Base URL: `http://localhost:7990` (или 7991/7992)
- License Key: вставляешь timebomb
- Admin: `admin / admin`

## План тестирования

Для каждой версии:

1. **Запуск контейнера** → дождаться `200 OK` на `/status`
2. **Setup wizard** → ввести timebomb, создать admin/admin
3. **Upload JAR** → `./deploy-plugin.sh` (8.19) / `deploy-plugin-9x.sh` / `deploy-plugin-10x.sh`
4. **Install validation:**
   - В UPM плагин **Enabled**, нет красных модулей
   - Лог `/var/atlassian/application-data/bitbucket/log/atlassian-bitbucket.log` — ищем `ERROR`, `Cannot resolve`, `BeanCreationException`
5. **Smoke-тесты функциональности** (создать репо, README.md):
   - Mermaid: ` ```mermaid ` блок рендерится (SVG)
   - PlantUML: ` ```plantuml ` рендерится (REST `/rest/markdownx/1.0/plantuml/render`)
   - KaTeX: `$$ E=mc^2 $$` → математика
   - Admin page `/plugins/servlet/markdownx/admin` открывается
   - Settings save/load (toggle переключателей)
6. **Зафиксировать результаты** в таблице ниже

## Результаты

| Версия | Install | Mermaid | PlantUML | KaTeX | Admin | Settings | Заметки |
|--------|---------|---------|----------|-------|-------|----------|---------|
| 8.19   | ?       | ?       | ?        | ?     | ?     | ?        |         |
| 9.6    | ?       | ?       | ?        | ?     | ?     | ?        |         |
| 10.2   | ?       | ?       | ?        | ?     | ?     | ?        |         |

## Ожидаемые проблемы

- **Bitbucket 10**: `javax.* → jakarta.*` миграция. Текущий код использует `javax.inject.Named`, `javax.ws.rs.*` — на 10.x контроллеры могут не зарегистрироваться. Если так — Maven-профиль `bb10` с jakarta-импортами.
- **Bitbucket 9**: должен работать почти как 8.x (Spring 5, javax). Низкий риск.
- **Spring Scanner**: `atlassian-spring-scanner` 2.x работает на 8/9, для 10 может потребоваться 3.x.

## Решение по single-jar vs multi-jar

После прогона трёх версий:

- Все три **Install + Smoke OK** → один JAR, ставим `min-build=8.9.0`, `max-build` = build number 10.x latest
- 8 + 9 OK, 10 fail → один JAR для 8/9, отдельный профиль `bb10`
- Только 8 OK → пересобрать с расширенным диапазоном через `<param name="atlassian-build-number-min/max">` или проф 9x/10x
