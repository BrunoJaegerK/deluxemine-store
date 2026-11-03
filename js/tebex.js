
const TEBEX_PUBLIC_TOKEN = "10tom-6fcf115b1b20d46f3df6b24ff5b0c03e232591ff";

const TEBEX_API = `https://headless.tebex.io/api/accounts/${TEBEX_PUBLIC_TOKEN}`;

export async function getStore() {
    const response = await fetch(TEBEX_API);

    if (!response.ok) {
        throw new Error(`Error al obtener la tienda: ${response.status}`);
    }

    return response.json();
}

export async function getCategories() {
    const response = await fetch(
        `${TEBEX_API}/categories?includePackages=1`
    );

    if (!response.ok) {
        throw new Error(`Error al obtener categorías: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
}

export async function getPackages() {
    const response = await fetch(`${TEBEX_API}/packages`);

    if (!response.ok) {
        throw new Error(`Error al obtener paquetes: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
}
