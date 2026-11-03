import {
    getCategories,
    getPackages,
    createCheckout
} from "./tebex.js";

const status = document.getElementById("store-status");
const categoryContainer = document.getElementById("store-categories");
const productContainer = document.getElementById("store-products");

let categories = [];
let packages = [];
let selectedCategory = "all";
let isCheckingOut = false;

const CART_STORAGE_KEY = "deluxemine_cart_v1";

let cart = loadCart();

/* =========================================
   UTILIDADES
========================================= */

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
    if (amount === null || amount === undefined || amount === "") {
        return "Consultar precio";
    }

    try {
        return new Intl.NumberFormat("es-EC", {
            style: "currency",
            currency: currency || "USD"
        }).format(Number(amount));
    } catch {
        return `${amount} ${currency || "USD"}`;
    }
}

function getPackagePrice(pkg) {
    return Number(pkg.total_price ?? pkg.base_price ?? 0);
}

function loadCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(CART_STORAGE_KEY) || "[]"
        );

        return Array.isArray(saved)
            ? saved.filter(item =>
                item &&
                item.id !== undefined &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            )
            : [];
    } catch {
        return [];
    }
}

function saveCart() {
    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
    );
}

function getCartQuantity() {
    return cart.reduce(
        (total, item) => total + item.quantity,
        0
    );
}

function getCartTotal() {
    return cart.reduce((total, item) => {
        return total + (Number(item.price) * item.quantity);
    }, 0);
}

/* =========================================
   ESTILOS DEL CARRITO
========================================= */

function injectCartStyles() {
    if (document.getElementById("deluxemine-cart-styles")) return;

    const style = document.createElement("style");
    style.id = "deluxemine-cart-styles";

    style.textContent = `
        .dm-cart-button {
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 14px 19px;
            border: 1px solid rgba(210,180,255,.35);
            border-radius: 13px;
            background: linear-gradient(135deg,#9b5df0,#7135c5);
            color: white;
            font-size: 13px;
            font-weight: 850;
            cursor: pointer;
            box-shadow: 0 10px 35px rgba(0,0,0,.4),
                        0 0 25px rgba(124,58,237,.25);
            transition: transform .2s, filter .2s;
        }

        .dm-cart-button:hover {
            transform: translateY(-3px);
            filter: brightness(1.12);
        }

        .dm-cart-count {
            display: grid;
            place-items: center;
            min-width: 23px;
            height: 23px;
            padding: 0 6px;
            border-radius: 20px;
            background: white;
            color: #7135c5;
            font-size: 11px;
            font-weight: 900;
        }

        .dm-cart-overlay {
            position: fixed;
            inset: 0;
            z-index: 1100;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(0,0,0,.75);
            backdrop-filter: blur(8px);
        }

        .dm-cart-overlay.open {
            display: flex;
        }

        .dm-cart-panel {
            width: min(540px, 100%);
            max-height: 85vh;
            overflow-y: auto;
            border: 1px solid rgba(190,151,255,.25);
            border-radius: 19px;
            background: #12101d;
            box-shadow: 0 25px 90px rgba(0,0,0,.6);
        }

        .dm-cart-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 21px;
            border-bottom: 1px solid rgba(190,151,255,.17);
        }

        .dm-cart-header h2 {
            font-size: 20px;
            color: #f8f5ff;
        }

        .dm-cart-close {
            width: 35px;
            height: 35px;
            border: 1px solid rgba(190,151,255,.2);
            border-radius: 9px;
            background: #201a2e;
            color: white;
            font-size: 20px;
            cursor: pointer;
        }

        .dm-cart-items {
            display: grid;
            gap: 12px;
            padding: 18px;
        }

        .dm-cart-item {
            display: flex;
            align-items: center;
            gap: 13px;
            padding: 13px;
            border: 1px solid rgba(190,151,255,.15);
            border-radius: 12px;
            background: #191426;
        }

        .dm-cart-item-info {
            flex: 1;
            min-width: 0;
        }

        .dm-cart-item-info strong {
            display: block;
            color: white;
            font-size: 13px;
            overflow-wrap: anywhere;
        }

        .dm-cart-item-info small {
            display: block;
            margin-top: 5px;
            color: #aaa2bb;
            font-size: 11px;
        }

        .dm-cart-item-actions {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        .dm-cart-quantity {
            min-width: 24px;
            color: white;
            text-align: center;
            font-size: 12px;
            font-weight: 800;
        }

        .dm-cart-qty-button,
        .dm-cart-remove {
            border: 1px solid rgba(190,151,255,.22);
            border-radius: 7px;
            background: #251c36;
            color: white;
            cursor: pointer;
            padding: 6px 9px;
        }

        .dm-cart-remove {
            color: #ff9eae;
        }

        .dm-cart-empty {
            padding: 35px 15px;
            color: #aaa2bb;
            text-align: center;
            font-size: 13px;
        }

        .dm-cart-footer {
            padding: 20px;
            border-top: 1px solid rgba(190,151,255,.17);
        }

        .dm-cart-total {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 17px;
            color: #aaa2bb;
            font-size: 13px;
        }

        .dm-cart-total strong {
            color: #e7d8ff;
            font-size: 20px;
        }

        .dm-checkout-button {
            width: 100%;
            padding: 14px 18px;
            border: 1px solid rgba(210,180,255,.3);
            border-radius: 10px;
            background: linear-gradient(135deg,#9b5df0,#7135c5);
            color: white;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
        }

        .dm-checkout-button:disabled {
            opacity: .55;
            cursor: wait;
        }

        .dm-cart-note {
            margin-top: 12px;
            color: #827991;
            text-align: center;
            font-size: 10px;
            line-height: 1.6;
        }

        .dm-cart-message {
            margin: 0 18px 15px;
            color: #ff9eae;
            font-size: 12px;
            line-height: 1.5;
        }

        .package-add-cart {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 13px;
            border: 1px solid rgba(210,180,255,.28);
            border-radius: 9px;
            background: linear-gradient(135deg,#9b5df0,#7135c5);
            color: white;
            font-size: 10px;
            font-weight: 850;
            white-space: nowrap;
            cursor: pointer;
        }

        .package-add-cart:hover {
            filter: brightness(1.12);
        }

        .package-bottom {
            flex-wrap: wrap;
        }

        @media (max-width: 560px) {
            .dm-cart-button {
                right: 14px;
                bottom: 14px;
            }

            .dm-cart-item {
                align-items: flex-start;
                flex-wrap: wrap;
            }

            .dm-cart-item-actions {
                width: 100%;
                justify-content: flex-end;
            }
        }
    `;

    document.head.append(style);
}

/* =========================================
   CREAR INTERFAZ DEL CARRITO
========================================= */

function createCartInterface() {
    if (document.getElementById("dm-cart-button")) return;

    const button = document.createElement("button");
    button.id = "dm-cart-button";
    button.className = "dm-cart-button";
    button.type = "button";
    button.innerHTML = `
        <span>🛒 Mi carrito</span>
        <span class="dm-cart-count" id="dm-cart-count">0</span>
    `;

    button.addEventListener("click", openCart);

    const overlay = document.createElement("div");
    overlay.id = "dm-cart-overlay";
    overlay.className = "dm-cart-overlay";

    overlay.innerHTML = `
        <section class="dm-cart-panel"
                 role="dialog"
                 aria-modal="true"
                 aria-labelledby="dm-cart-title">

            <header class="dm-cart-header">
                <h2 id="dm-cart-title">Tu carrito</h2>
                <button class="dm-cart-close"
                        id="dm-cart-close"
                        type="button"
                        aria-label="Cerrar carrito">×</button>
            </header>

            <div class="dm-cart-items" id="dm-cart-items"></div>

            <div class="dm-cart-message"
                 id="dm-cart-message"
                 role="alert"></div>

            <footer class="dm-cart-footer">
                <div class="dm-cart-total">
                    <span>Total estimado</span>
                    <strong id="dm-cart-total">$0.00</strong>
                </div>

                <button class="dm-checkout-button"
                        id="dm-checkout-button"
                        type="button">
                    FINALIZAR COMPRA →
                </button>

                <p class="dm-cart-note">
                    El pago se realizará de forma segura mediante Tebex.
                    El total definitivo se confirmará en el checkout.
                </p>
            </footer>
        </section>
    `;

    document.body.append(button, overlay);

    document.getElementById("dm-cart-close")
        .addEventListener("click", closeCart);

    document.getElementById("dm-checkout-button")
        .addEventListener("click", checkout);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeCart();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeCart();
    });

    renderCart();
}

function openCart() {
    document.getElementById("dm-cart-overlay")
        .classList.add("open");

    renderCart();
}

function closeCart() {
    document.getElementById("dm-cart-overlay")
        ?.classList.remove("open");
}

/* =========================================
   CARRITO
========================================= */

function addToCart(pkg) {
    if (pkg.id === undefined || pkg.id === null) {
        alert("Este producto no tiene un identificador válido de Tebex.");
        return;
    }

    const id = String(pkg.id);
    const existing = cart.find(item => String(item.id) === id);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id,
            name: pkg.name || "Producto DeluxeMine",
            price: getPackagePrice(pkg),
            currency: pkg.currency || "USD",
            quantity: 1
        });
    }

    saveCart();
    renderCart();

    const button = document.getElementById("dm-cart-button");

    if (button) {
        button.animate(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.08)" },
                { transform: "scale(1)" }
            ],
            { duration: 250 }
        );
    }
}

function changeQuantity(id, amount) {
    const item = cart.find(item => String(item.id) === String(id));

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        cart = cart.filter(entry => String(entry.id) !== String(id));
    }

    saveCart();
    renderCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => String(item.id) !== String(id));

    saveCart();
    renderCart();
}

function renderCart() {
    const countElement = document.getElementById("dm-cart-count");
    const itemsContainer = document.getElementById("dm-cart-items");
    const totalElement = document.getElementById("dm-cart-total");
    const checkoutButton = document.getElementById("dm-checkout-button");

    if (!countElement || !itemsContainer || !totalElement) return;

    countElement.textContent = getCartQuantity();

    itemsContainer.replaceChildren();

    if (cart.length === 0) {
        const empty = document.createElement("div");
        empty.className = "dm-cart-empty";
        empty.textContent = "Tu carrito está vacío. Explora nuestros productos.";
        itemsContainer.append(empty);
    } else {
        cart.forEach(item => {
            const row = document.createElement("div");
            row.className = "dm-cart-item";

            const info = document.createElement("div");
            info.className = "dm-cart-item-info";

            const name = document.createElement("strong");
            name.textContent = item.name;

            const price = document.createElement("small");
            price.textContent =
                `${formatPrice(item.price, item.currency)} × ${item.quantity}`;

            info.append(name, price);

            const actions = document.createElement("div");
            actions.className = "dm-cart-item-actions";

            const minus = document.createElement("button");
            minus.className = "dm-cart-qty-button";
            minus.type = "button";
            minus.textContent = "−";
            minus.setAttribute("aria-label", "Reducir cantidad");
            minus.addEventListener("click", () => {
                changeQuantity(item.id, -1);
            });

            const quantity = document.createElement("span");
            quantity.className = "dm-cart-quantity";
            quantity.textContent = item.quantity;

            const plus = document.createElement("button");
            plus.className = "dm-cart-qty-button";
            plus.type = "button";
            plus.textContent = "+";
            plus.setAttribute("aria-label", "Aumentar cantidad");
            plus.addEventListener("click", () => {
                changeQuantity(item.id, 1);
            });

            const remove = document.createElement("button");
            remove.className = "dm-cart-remove";
            remove.type = "button";
            remove.textContent = "Eliminar";
            remove.addEventListener("click", () => {
                removeFromCart(item.id);
            });

            actions.append(minus, quantity, plus, remove);
            row.append(info, actions);
            itemsContainer.append(row);
        });
    }

    const currency = cart[0]?.currency || "USD";
    totalElement.textContent = formatPrice(getCartTotal(), currency);

    if (checkoutButton) {
        checkoutButton.disabled = cart.length === 0 || isCheckingOut;
        checkoutButton.textContent = isCheckingOut
            ? "CONECTANDO CON TEBEX..."
            : "FINALIZAR COMPRA →";
    }
}

/* =========================================
   CHECKOUT TEBEX
========================================= */

async function checkout() {
    if (isCheckingOut || cart.length === 0) return;

    isCheckingOut = true;

    const message = document.getElementById("dm-cart-message");

    message.textContent = "";
    renderCart();

    try {
        const checkoutUrl = await createCheckout(
            cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }))
        );

        // El carrito se conserva hasta que Tebex confirme
        // el resultado del proceso de compra.
        window.location.assign(checkoutUrl);

    } catch (error) {
        console.error("Error iniciando checkout de Tebex:", error);

        message.textContent =
            error.message ||
            "No se pudo iniciar el pago. Inténtalo nuevamente.";

        isCheckingOut = false;
        renderCart();
    }
}

/* =========================================
   CATÁLOGO
========================================= */

function renderCategories() {
    categoryContainer.replaceChildren();

    const filters = [
        { id: "all", name: "Todos los productos" },
        ...categories.map(category => ({
            id: String(category.id),
            name: category.name || "Categoría"
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

function getPackageImage(pkg) {
    if (pkg.image) return pkg.image;

    const imageMedia = Array.isArray(pkg.media)
        ? pkg.media.find(media =>
            media?.type === "image" && media?.url
        )
        : null;

    return imageMedia?.url || "";
}

function renderPackages() {
    productContainer.replaceChildren();

    const visiblePackages = selectedCategory === "all"
        ? packages
        : packages.filter(pkg =>
            String(pkg.category?.id ?? pkg.category_id ?? "") === selectedCategory
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

        const imageUrl = getPackageImage(pkg);

        if (imageUrl) {
            const image = document.createElement("img");

            image.className = "package-image";
            image.src = imageUrl;
            image.alt = pkg.name || "Producto DeluxeMine";
            image.loading = "lazy";
            image.onerror = () => image.remove();

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
        category.textContent = pkg.category?.name || "DeluxeMine";

        const title = document.createElement("h3");
        title.textContent = pkg.name || "Producto";

        const description = document.createElement("p");
        description.className = "package-description";
        description.textContent = cleanDescription(pkg.description)
            || "Producto disponible en la tienda oficial.";

        const bottom = document.createElement("div");
        bottom.className = "package-bottom";

        const price = document.createElement("div");
        price.className = "package-price";
        price.textContent = formatPrice(
            pkg.total_price ?? pkg.base_price,
            pkg.currency || "USD"
        );

        const addButton = document.createElement("button");
        addButton.className = "package-add-cart";
        addButton.type = "button";
        addButton.textContent = "Añadir al carrito";

        addButton.addEventListener("click", () => {
            addToCart(pkg);
        });

        bottom.append(price, addButton);

        content.append(category, title, description, bottom);
        card.append(content);

        productContainer.append(card);
    });
}

/* =========================================
   CARGAR TIENDA
========================================= */

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

        packages = packages.map(pkg => {
            if (pkg.category) return pkg;

            const matchingCategory = categories.find(category =>
                (category.packages || []).some(item =>
                    String(item.id) === String(pkg.id)
                )
            );

            return matchingCategory
                ? {
                    ...pkg,
                    category: {
                        id: matchingCategory.id,
                        name: matchingCategory.name
                    }
                }
                : pkg;
        });

        renderCategories();
        renderPackages();

        showStatus(
            `Tienda conectada: ${categories.length} categorías y ${packages.length} productos.`
        );

    } catch (error) {
        console.error("Error cargando el catálogo de Tebex:", error);

        showStatus(
            "No se pudo conectar con la tienda. Recarga la página o inténtalo más tarde.",
            true
        );
    }
}

/* =========================================
   INICIALIZACIÓN
========================================= */

injectCartStyles();
createCartInterface();

const checkoutStatus = new URLSearchParams(window.location.search)
    .get("checkout");

if (checkoutStatus === "complete") {
    showStatus(
        "Has regresado del checkout de Tebex. Comprueba el estado de tu compra."
    );
} else if (checkoutStatus === "cancelled") {
    showStatus("El proceso de compra fue cancelado. Tu carrito sigue disponible.");
}

loadStore();

