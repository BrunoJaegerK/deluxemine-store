import { getCategories, getPackages } from "./tebex.js";

const status = document.getElementById("store-status");
const categoryContainer = document.getElementById("store-categories");
const productContainer = document.getElementById("store-products");

let categories = [];
let packages = [];
let selectedCategory = "all";

function showStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
}

function cleanDescription(value) {
    if (!value) return "";

    const parsed = new DOMParser().parseFromString(
        String(value),
        "text/html"
    );

    return (parsed.body.textContent || "").trim();
}

function formatPrice(amount, currency = "USD") {
    if (amount === null || amount === undefined) {
        return "Consultar precio";
    }

    try {
        return new Intl.NumberFormat("es-EC", {
            style: "currency",
            currency
        }).format(Number(amount));
    } catch {
        return `${amount} ${currency}`;
    }
}

function renderCategories() {
    categoryContainer.replaceChildren();

    const filters = [
        { id: "all", name: "Todos los productos" },
        ...categories.map(category => ({
            id: String(category.id),
            name: category.name
        }))
    ];

    filters.forEach(category => {
        const button = document.createElement("button");

        button.className = "store-category-btn";
        button.textContent = category.name;
        button.type = "button";

        button.classList.toggle(
            "active",
            category.id === selectedCategory
        );

        button.addEventListener("click", () => {
            selectedCategory = category.id;
            renderCategories();
            renderPackages();
        });

        categoryContainer.append(button);
    });
}

function renderPackages() {
    productContainer.replaceChildren();

    const visiblePackages = selectedCategory === "all"
        ? packages
        : packages.filter(pkg =>
            String(pkg.category?.id ?? "") === selectedCategory
        );

    if (!visiblePackages.length) {
        const empty = document.createElement("div");

        empty.className = "catalog-empty";
        empty.textContent =
            "No hay productos disponibles en esta categoría.";

        productContainer.append(empty);
        return;
    }

    visiblePackages.forEach(pkg => {
        const card = document.createElement("article");
        card.className = "package-card";

        const imageUrl = pkg.image ||
            pkg.media?.find(media =>
                media.type === "image" && media.url
            )?.url;

        if (imageUrl) {
            const image = document.createElement("img");

            image.className = "package-image";
            image.src = imageUrl;
            image.alt = pkg.name || "Producto DeluxeMine";
            image.loading = "lazy";

            card.append(image);
        } else {
            const placeholder = document.createElement("div");

            placeholder.className = "package-image placeholder";
            placeholder.textContent = "✦";

            card.append(placeholder);
        }

        const content = document.createElement("div");
        content.className = "package-content";

        const category = document.createElement("div");
        category.className = "package-category";
        category.textContent =
            pkg.category?.name || "DeluxeMine";

        const title = document.createElement("h3");
        title.textContent = pkg.name || "Producto";

        const description = document.createElement("p");
        description.className = "package-description";
        description.textContent =
            cleanDescription(pkg.description) ||
            "Producto disponible en la tienda oficial.";

        const bottom = document.createElement("div");
        bottom.className = "package-bottom";

        const price = document.createElement("div");
        price.className = "package-price";

        price.textContent = formatPrice(
            pkg.total_price ?? pkg.base_price,
            pkg.currency
        );

        const link = document.createElement("a");

        link.className = "package-external";
        link.href = "https://deluxemine-new.tebex.io/";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Abrir Tebex ↗";

        bottom.append(price, link);

        content.append(
            category,
            title,
            description,
            bottom
        );

        card.append(content);
        productContainer.append(card);
    });
}

async function loadStore() {
    try {
        showStatus("Conectando con Tebex...");

        categories = await getCategories();

        const embeddedPackages = categories.flatMap(category =>
            (category.packages || []).map(pkg => ({
                ...pkg,
                category: pkg.category || {
                    id: category.id,
                    name: category.name
                }
            }))
        );

        packages = embeddedPackages.length
            ? embeddedPackages
            : await getPackages();

        renderCategories();
        renderPackages();

        showStatus(
            `Tienda conectada: ${categories.length} categorías y ${packages.length} productos.`
        );

    } catch (error) {
        console.error("Error cargando Tebex:", error);

        showStatus(
            "No se pudo conectar con la tienda. Inténtalo más tarde.",
            true
        );
    }
}

loadStore();
