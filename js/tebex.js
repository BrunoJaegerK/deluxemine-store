const TEBEX_PUBLIC_TOKEN = "10tom-6fcf115b1b20d46f3df6b24ff5b0c03e232591ff";

const TEBEX_API =
    `https://headless.tebex.io/api/accounts/${TEBEX_PUBLIC_TOKEN}`;

const TEBEX_BASKETS_API =
    "https://headless.tebex.io/api/baskets";


/* =========================================
   PETICIONES A TEBEX
========================================= */

async function tebexRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...options.headers
            }
        });
    } catch (error) {
        console.error("Error de conexión con Tebex:", error);

        throw new Error(
            "No se pudo conectar con Tebex. Comprueba tu conexión."
        );
    }

    const responseText = await response.text();

    let result = {};

    try {
        result = responseText
            ? JSON.parse(responseText)
            : {};
    } catch {
        console.error("Respuesta no válida de Tebex:", responseText);

        throw new Error(
            "Tebex devolvió una respuesta que no es JSON."
        );
    }

    if (!response.ok) {
        console.error("Error HTTP de Tebex:", result);

        throw new Error(
            result?.detail ||
            result?.error ||
            result?.message ||
            `Error HTTP ${response.status}`
        );
    }

    return result;
}


/* =========================================
   RESPUESTAS
========================================= */

function getData(result) {
    return result?.data ?? result;
}


/* =========================================
   INFORMACIÓN DE LA TIENDA
========================================= */

export async function getStore() {
    const result = await tebexRequest(TEBEX_API);

    return getData(result);
}


/* =========================================
   CATEGORÍAS
========================================= */

export async function getCategories() {
    const result = await tebexRequest(
        `${TEBEX_API}/categories?includePackages=1`
    );

    const data = getData(result);

    return Array.isArray(data) ? data : [];
}


/* =========================================
   PAQUETES
========================================= */

export async function getPackages() {
    const result = await tebexRequest(
        `${TEBEX_API}/packages`
    );

    const data = getData(result);

    return Array.isArray(data) ? data : [];
}


/* =========================================
   CREAR CESTA
========================================= */

export async function createBasket() {
    const siteUrl =
        window.location.origin + window.location.pathname;

    const result = await tebexRequest(
        `${TEBEX_API}/baskets`,
        {
            method: "POST",

            body: JSON.stringify({
                complete_url: `${siteUrl}?checkout=complete`,
                cancel_url: `${siteUrl}?checkout=cancelled`,
                complete_auto_redirect: false
            })
        }
    );

    const basket = getData(result);

    if (!basket?.ident) {
        console.error("Respuesta al crear cesta:", result);

        throw new Error(
            "Tebex no devolvió el identificador de la cesta."
        );
    }

    return basket;
}


/* =========================================
   AUTENTICACIÓN DE LA CESTA
========================================= */

export async function getBasketAuthUrl(basketIdent) {
    if (!basketIdent) {
        throw new Error(
            "No se recibió el identificador de la cesta."
        );
    }

    const returnUrl = new URL(
        window.location.origin + window.location.pathname
    );

    returnUrl.searchParams.set(
        "checkout",
        "authenticated"
    );

    returnUrl.searchParams.set(
        "basket",
        basketIdent
    );

    const endpoint =
        `${TEBEX_API}/baskets/${encodeURIComponent(basketIdent)}/auth` +
        `?${new URLSearchParams({
            returnUrl: returnUrl.href
        }).toString()}`;

    const result = await tebexRequest(endpoint);

    // Mostrar la respuesta original para poder diagnosticar errores.
    console.log(
        "RESPUESTA COMPLETA DE AUTENTICACIÓN TEBEX:",
        result
    );

    const data = getData(result);

    // La API oficial devuelve una lista de opciones:
    // [{ name: "FiveM", url: "https://ident.tebex.io/..." }]
    let authOptions = [];

    if (Array.isArray(data)) {
        authOptions = data;
    } else if (Array.isArray(data?.data)) {
        authOptions = data.data;
    }

    if (authOptions.length === 0) {
        console.error(
            "Tebex no devolvió una lista de autenticación válida:",
            result
        );

        throw new Error(
            "Tebex no devolvió opciones de autenticación. " +
            "Respuesta: " + JSON.stringify(result)
        );
    }

    // Buscar primero una opción relacionada con Minecraft.
    const selectedOption =
        authOptions.find(option =>
            /minecraft/i.test(option?.name || "")
        ) || authOptions[0];

    if (!selectedOption?.url) {
        console.error(
            "Opción de autenticación sin URL:",
            selectedOption
        );

        throw new Error(
            "La opción de autenticación no contiene una URL. " +
            "Respuesta: " + JSON.stringify(result)
        );
    }

    let authUrl;

    try {
        authUrl = new URL(selectedOption.url);
    } catch {
        console.error(
            "URL de autenticación no válida:",
            selectedOption
        );

        throw new Error(
            "Tebex devolvió una dirección de autenticación inválida: " +
            String(selectedOption.url)
        );
    }

    if (authUrl.protocol !== "https:") {
        throw new Error(
            "El enlace de autenticación de Tebex no utiliza HTTPS."
        );
    }

    return authUrl.href;
}


/* =========================================
   AÑADIR PAQUETE A LA CESTA
========================================= */

export async function addPackageToBasket(
    basketIdent,
    packageId,
    quantity = 1
) {
    if (!basketIdent || !packageId) {
        throw new Error(
            "Falta el identificador de la cesta o del producto."
        );
    }

    const safeQuantity = Math.max(
        1,
        Math.floor(Number(quantity) || 1)
    );

    const result = await tebexRequest(
        `${TEBEX_BASKETS_API}/${encodeURIComponent(basketIdent)}/packages`,
        {
            method: "POST",

            body: JSON.stringify({
                package_id: String(packageId),
                quantity: safeQuantity
            })
        }
    );

    return getData(result);
}


/* =========================================
   INICIAR CHECKOUT
========================================= */

export async function createCheckout() {
    // Crear una cesta nueva.
    const basket = await createBasket();

    // Obtener el enlace para autenticar al jugador.
    const authUrl = await getBasketAuthUrl(
        basket.ident
    );

    return {
        basketIdent: basket.ident,
        authUrl
    };
}


/* =========================================
   COMPLETAR CHECKOUT
========================================= */

export async function completeCheckout(
    basketIdent,
    cartItems
) {
    if (!basketIdent) {
        throw new Error(
            "No se encontró la cesta de Tebex."
        );
    }

    if (
        !Array.isArray(cartItems) ||
        cartItems.length === 0
    ) {
        throw new Error(
            "Tu carrito está vacío."
        );
    }

    // Añadir todos los productos a la cesta autenticada.
    for (const item of cartItems) {
        await addPackageToBasket(
            basketIdent,
            item.id,
            item.quantity
        );
    }

    // Recuperar la cesta actualizada.
    const result = await tebexRequest(
        `${TEBEX_API}/baskets/${encodeURIComponent(basketIdent)}`
    );

    const basket = getData(result);

    const checkoutUrl = basket?.links?.checkout;

    if (!checkoutUrl) {
        console.error(
            "Cesta sin enlace de checkout:",
            result
        );

        throw new Error(
            "Los productos se añadieron, pero Tebex no devolvió " +
            "el enlace de pago."
        );
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(checkoutUrl);
    } catch {
        throw new Error(
            "Tebex devolvió un enlace de pago inválido."
        );
    }

    if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== "checkout.tebex.io"
    ) {
        throw new Error(
            "El enlace de pago no pertenece al checkout seguro de Tebex."
        );
    }

    return parsedUrl.href;
}
