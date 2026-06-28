export default defineEventHandler((event) => {
    // Додаємо CORS-заголовки для абсолютно всіх запитів до вашого сервера
    setResponseHeaders(event, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
    })

    // Обробляємо попередні перевірочні запити (CORS preflight OPTIONS) від браузерів
    if (getMethod(event) === 'OPTIONS') {
        setResponseStatus(event, 204)
        return {}
    }
})