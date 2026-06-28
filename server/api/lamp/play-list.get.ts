export default defineEventHandler(async (event) => {
    const queryParams = getQuery(event)
    const id = queryParams.id

    if (!id) {
        return { success: false, error: 'Параметр id обов’язковий' }
    }

    const targetUrl = 'https://anitube.in.ua'
    const playlistUrl = `${targetUrl}/engine/ajax/playlists.php`

    try {
        // Крок 1: Робимо запит на головну сторінку для отримання сесії та токену
        const mainPageResponse = await $fetch.raw(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        // Безпечно отримуємо масив заголовків Set-Cookie
        const setCookieHeaders = mainPageResponse.headers.getSetCookie
            ? mainPageResponse.headers.getSetCookie()
            : (mainPageResponse.headers.get('set-cookie')?.split(',') || []);

        if (setCookieHeaders.length === 0) {
            throw new Error('Не вдалося отримати сесійні cookie.')
        }

        // Очищаємо куки: видаляємо path, expires, httponly та збираємо у формат "key1=val1; key2=val2"
        const cleanCookies = setCookieHeaders
            .map(cookie => cookie.split(';')[0].trim())
            .filter(cookie => {
                const name = cookie.split('=')[0].toLowerCase()
                return !['path', 'expires', 'domain', 'secure', 'httponly', 'samesite', 'max-age'].includes(name)
            })
            .join('; ')

        // Отримуємо HTML-код сторінки
        const html = mainPageResponse._data
        if (typeof html !== 'string') {
            throw new Error('Отримано некоректний вміст сторінки.')
        }

        // Шукаємо dle_login_hash в HTML
        const tokenMatch = html.match(/var\s+dle_login_hash\s*=\s*['"]([a-f0-9]+)['"]/i)
        const userHash = tokenMatch ? tokenMatch[1] : null

        if (!userHash) {
            throw new Error('Не вдалося знайти dle_login_hash на сторінці.')
        }

        // Крок 2: Відправляємо GET-запит на playlists.php з очищеними cookie та AJAX-заголовками
        const playlistResponse = await $fetch(playlistUrl, {
            method: 'GET',
            query: {
                news_id: id,
                xfield: 'playlist',
                user_hash: userHash
            },
            headers: {
                'Cookie': cleanCookies, // Відправляємо тільки валідні пари cookie
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': targetUrl,
                'X-Requested-With': 'XMLHttpRequest', // Вказуємо серверу, що це AJAX-запит
                'Accept': '*/*'
            }
        })

        // Крок 3: Парсинг отриманого HTML-плейлиста
        const types: Record<string, any> = {}

// Регулярний вираз для пошуку будь-яких тегів (li, div тощо) з атрибутом data-id
        const elementRegex = /<([a-z0-9]+)\s+[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi
        let match

        const allItems = []

        while ((match = elementRegex.exec(playlistResponse.response)) !== null) {
            const fullTag = match[0]
            const dataId = match[2]
            const innerHtml = match[3]

            // Шукаємо посилання на відеопотік/iframe в атрибуті data-file
            const fileMatch = fullTag.match(/data-file="([^"]+)"/i)
            const dataFile = fileMatch ? fileMatch[1] : null

            // Очищаємо текст від внутрішніх HTML-тегів (наприклад, якщо всередині є <div class="...">)
            const text = innerHtml.replace(/<[^>]*>/g, '').trim()

            allItems.push({ dataId, text, dataFile })
        }

// Функція для пошуку плеєра за його ID або за батьківським ID серії
        const findTargetPlayer = (typesObj: any, idStr: string) => {
            // Шукаємо збіг безпосередньо за ID плеєра
            for (const tId in typesObj) {
                for (const sId in typesObj[tId].studios) {
                    if (typesObj[tId].studios[sId].players[idStr]) {
                        return typesObj[tId].studios[sId].players[idStr]
                    }
                }
            }
            // Якщо ID серії має додатковий рівень (наприклад, 0_0_0_0_1), шукаємо за його батьківським ID (0_0_0_0)
            const parentId = idStr.substring(0, idStr.lastIndexOf('_'))
            for (const tId in typesObj) {
                for (const sId in typesObj[tId].studios) {
                    if (typesObj[tId].studios[sId].players[parentId]) {
                        return typesObj[tId].studios[sId].players[parentId]
                    }
                }
            }
            return null
        }

// Розподіляємо елементи по дереву залежно від рівня вкладеності
        for (const item of allItems) {
            const parts = item.dataId.split('_')

            if (item.dataFile) {
                // Це серія (оскільки є атрибут data-file)
                const player = findTargetPlayer(types, item.dataId)
                if (player) {
                    player.episodes.push({
                        title: item.text,
                        file: item.dataFile
                    })
                }
            } else if (parts.length === 2) {
                // Рівень 1: Тип перекладу (Озвучування / Субтитри)
                types[item.dataId] = {
                    id: item.dataId,
                    name: item.text,
                    studios: {}
                }
            } else if (parts.length === 3) {
                // Рівень 2: Студія озвучування
                const parentId = `${parts[0]}_${parts[1]}`
                if (types[parentId]) {
                    types[parentId].studios[item.dataId] = {
                        id: item.dataId,
                        name: item.text,
                        players: {}
                    }
                }
            } else if (parts.length === 4) {
                // Рівень 3: Плеєр
                const parentId = `${parts[0]}_${parts[1]}_${parts[2]}`
                let targetStudio = null
                for (const tId in types) {
                    if (types[tId].studios[parentId]) {
                        targetStudio = types[tId].studios[parentId]
                        break
                    }
                }
                if (targetStudio) {
                    targetStudio.players[item.dataId] = {
                        id: item.dataId,
                        name: item.text,
                        episodes: []
                    }
                }
            }
        }

// Форматуємо об'єкти в масиви для зручної роботи на клієнті в Lampa
        const formattedResult = Object.values(types).map((type: any) => ({
            name: type.name,
            studios: Object.values(type.studios).map((studio: any) => ({
                name: studio.name,
                players: Object.values(studio.players).map((player: any) => ({
                    name: player.name,
                    episodes: player.episodes
                }))
            }))
        }))

        return {
            success: true,
            playlistResponse,
            translations: formattedResult
        }

    } catch (error: any) {
        return {
            success: false,
            error: error.message || error
        }
    }
})