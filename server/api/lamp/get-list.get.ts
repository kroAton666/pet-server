export default defineEventHandler(async (event) => {
    const targetUrl = 'https://anitube.in.ua'
    const searchUrl = `${targetUrl}/engine/ajax/controller.php?mod=search`

    try {
        // Крок 1: Робимо запит на головну сторінку для отримання сесії та токену
        const mainPageResponse = await $fetch.raw(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        // Отримуємо cookie з заголовків відповіді
        const setCookieHeaders = mainPageResponse.headers.get('set-cookie')
        if (!setCookieHeaders) {
            throw new Error('Не вдалося отримати сесійні cookie.')
        }

        // Отримуємо HTML-код сторінки
        const html = mainPageResponse._data
        if (typeof html !== 'string') {
            throw new Error('Отримано некоректний вміст сторінки.')
        }

        // Шукаємо dle_login_hash в HTML за допомогою регулярного виразу
        const tokenMatch = html.match(/var\s+dle_login_hash\s*=\s*['"]([a-f0-9]+)['"]/i)
        const userHash = tokenMatch ? tokenMatch[1] : null

        if (!userHash) {
            throw new Error('Не вдалося знайти dle_login_hash на сторінці.')
        }

        // Крок 2: Відправляємо запит на пошук з отриманими cookie та токеном
        // Використовуємо URLSearchParams для кодування тіла як application/x-www-form-urlencoded
        const searchBody = new URLSearchParams()
        searchBody.append('query', 'магічна битва')
        searchBody.append('user_hash', userHash)

        const searchResponse = await $fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Cookie': setCookieHeaders, // Передаємо отримані cookie
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': targetUrl
            },
            body: searchBody.toString()
        })
        const results = []

// Регулярний вираз для пошуку карток аніме у верстці DLE
        const regex = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<b class="searchheading_title">([^<]+)<\/b>[\s\S]*?<img src="([^"]+)"[\s\S]*?<\/a>/gi
        const matches = [...searchResponse.matchAll(regex)]

        for (const match of matches) {
            const url = match[1]

            // Регулярний вираз для отримання цифр після останнього слішу перед дефісом
            // Наприклад, з "https://anitube.in.ua/4088-magchna-bitva-0.html" дістане "4088"
            const idMatch = url.match(/\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            results.push({
                id: id,                 // Отриманий ID (рядок із цифрами або null, якщо не знайдено)
                url: url,               // Посилання на сторінку аніме
                title: match[2].trim(), // Назва
                poster: match[3],       // Посилання на постер
            })
        }

        return {
            success: true,
            results
        }

    } catch (error) {
        return {
            success: false,
            error: error.message || error
        }
    }
})