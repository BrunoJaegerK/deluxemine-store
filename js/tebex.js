const TEBEX_PUBLIC_TOKEN = "10tom-6fcf115b1b20d46f3df6b24ff5b0c03e232591ff";
const TEBEX_API = `https://headless.tebex.io/api/accounts/${TEBEX_PUBLIC_TOKEN}`;

async function tebexRequest(endpoint = "") {
    const response = await fetch(`${TEBEX_API}${endpoint}`);

    if (!response.ok) {
        throw new Error(`Tebex respondió con el estado ${response.status}`);
    }

    return response.json();
}

export async function getStore() {
    return tebexRequest();
}

export async function getCategories() {
    const result = await tebexRequest("/categories?includePackages=1");
    return Array.isArray(result.data) ? result.data : [];
}

export async function getPackages() {
    const result = await tebexRequest("/packages");
    return Array.isArray(result.data) ? result.data : [];
}
