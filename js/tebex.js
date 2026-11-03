const TEBEX_PUBLIC_TOKEN = "10tom-6fcf115b1b20d46f3df6b24ff5b0c03e232591ff";

const TEBEX_API = `https://headless.tebex.io/api/accounts/${TEBEX_PUBLIC_TOKEN}`;
const TEBEX_BASKETS_API = "https://headless.tebex.io/api/baskets";

async function tebexRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const text = await response.text();

    let result = {};

    try {
        result = text ? JSON.parse(text) : {};
    } catch {
        throw new Error("Tebex devolvió una respuesta no válida.");
    }

    if (!response.ok) {
        throw new Error(
            result?.detail ||
            result?.error ||
            result?.message ||
            `Error HTTP ${response.status}`
        );
    }

    return result;
}

function getData(result) {
    return result?.data ?? result;
}

export async function getStore() {
    const result = await tebexRequest(TEBEX_API);
    return getData(result);
}

export async function getCategories() {
    const result = await tebexRequest(
        `${TEBEX_API}/categories?includePackages=1`
    );

    const data = getData(result);
    return Array.isArray(data) ? data : [];
}

export async function getPackages() {
    const result = await tebexRequest(`${TEBEX_API}/packages`);

    const data = getData(result);
    return Array.isArray(data) ? data : [];
}

/**
 * Crea una cesta nueva de Tebex.
 */
export async function createBasket() {
    const siteUrl = window.location.origin + window.location.pathname;

    const result = await tebexRequest(`${TEBEX_API}/baskets`, {
        method: "POST",
        body: JSON.stringify({
            complete_url: `${siteUrl}?checkout=complete`,
            cancel_url: `${siteUrl}?checkout=cancelled`,
            complete_auto_redirect: false
        })
    });

    const basket = getData(result);

    if (!basket?.ident) {
        throw new Error("Tebex no devolvió el identificador de la cesta.");
    }

    return basket;
}

/**
 * Obtiene los enlaces de autenticación de la cesta.
 */
export async function getBasketAuthUrl(basketIdent) {
    if (!basketIdent) {
        throw new Error("No se recibió el identificador de la cesta.");
    }

    const returnUrl = new URL(
        window.location.origin + window.location.pathname
    );

    returnUrl.searchParams.set("checkout", "authenticated");
    returnUrl.searchParams.set("basket", basketIdent);

    const endpoint =
        `${TEBEX_API}/baskets/${encodeURIComponent(basketIdent)}/auth` +
        `?returnUrl=${encodeURIComponent(returnUrl.href)}`;

    const result = await tebexRequest(endpoint);

    const data = getData(result);
    const authOptions = Array.isArray(data) ? data : [];

    if (!authOptions.length) {
        throw new Error(
            "Tebex no proporcionó ningún método para autenticar al jugador."
        );
    }

    // Si hay varias opciones, priorizamos la que identifique Minecraft.
    const selectedOption =
        authOptions.find(option =>
            /minecraft/i.test(option.name || "")
        ) || authOptions[0];

    if (!selectedOption?.url) {
        throw new Error("Tebex devolvió un enlace de autenticación inválido.");
    }

    const authUrl = new URL(selectedOption.url);

    if (authUrl.protocol !== "https:") {
        throw new Error("El enlace de autenticación no es seguro.");
    }

    return authUrl.href;
}

/**
 * Añade un paquete a una cesta ya autenticada.
 */
export async function addPackageToBasket(
    basketIdent,
    packageId,
    quantity = 1
) {
    if (!basketIdent || !packageId) {
        throw new Error("Falta el identificador de la cesta o del producto.");
    }

    const result = await tebexRequest(
        `${TEBEX_BASKETS_API}/${encodeURIComponent(basketIdent)}/packages`,
        {
            method: "POST",
            body: JSON.stringify({
                package_id: String(packageId),
                quantity: Math.max(1, Math.floor(Number(quantity) || 1))
            })
        }
    );

    return getData(result);
}

/**
 * Crea la cesta y obtiene el enlace de autenticación.
 * Todavía no añade paquetes.
 */
export async function createCheckout() {
    const basket = await createBasket();
    const authUrl = await getBasketAuthUrl(basket.ident);

    return {
        basketIdent: basket.ident,
        authUrl
    };
}

/**
 * Continúa el checkout después de que Tebex
 * haya autenticado al jugador.
 */
export async function completeCheckout(basketIdent, cartItems) {
    if (!basketIdent) {
        throw new Error("No se encontró la cesta de Tebex.");
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error("Tu carrito está vacío.");
    }

    for (const item of cartItems) {
        await addPackageToBasket(
            basketIdent,
            item.id,
            item.quantity
        );
    }

    const result = await tebexRequest(
        `${TEBEX_API}/baskets/${encodeURIComponent(basketIdent)}`
    );

    const basket = getData(result);
    const checkoutUrl = basket?.links?.checkout;

    if (!checkoutUrl) {
        throw new Error(
            "La cesta se actualizó, pero Tebex no devolvió el enlace de pago."
        );
    }

    const parsedUrl = new URL(checkoutUrl);

    if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== "checkout.tebex.io"
    ) {
        throw new Error("Tebex devolvió un enlace de checkout no válido.");
    }

    return parsedUrl.href;
}


