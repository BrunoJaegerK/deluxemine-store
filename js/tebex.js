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
        const message =
            result?.error ||
            result?.message ||
            result?.detail ||
            `Error HTTP ${response.status}`;

        throw new Error(message);
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
 * Añade un paquete a una cesta existente.
 */
export async function addPackageToBasket(basketIdent, packageId, quantity = 1) {
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
 * Crea la cesta, añade todos los productos
 * y devuelve el enlace seguro de checkout.
 */
export async function createCheckout(cartItems) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error("Tu carrito está vacío.");
    }

    const basket = await createBasket();

    for (const item of cartItems) {
        await addPackageToBasket(
            basket.ident,
            item.id,
            item.quantity
        );
    }

    // Obtener el enlace de checkout de la última respuesta
    // disponible mediante la consulta de la cesta.
    const result = await tebexRequest(
        `${TEBEX_API}/baskets/${encodeURIComponent(basket.ident)}`
    );

    const updatedBasket = getData(result);
    const checkoutUrl = updatedBasket?.links?.checkout;

    if (!checkoutUrl) {
        throw new Error(
            "La cesta se creó, pero Tebex no devolvió el enlace de checkout."
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
