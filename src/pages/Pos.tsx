import api, { API_BASE_URL } from "@/apis/api";
import { useAuth } from "@/contexts/AuthContext";
import { useShift } from "@/contexts/ShiftContext";
import { cn } from "@/lib/utils";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import {
  PackageXIcon,
  ShoppingBasketIcon,
  PlusIcon,
  MinusIcon,
  Trash2Icon,
  Undo2Icon,
  BoxesIcon,
  LockIcon,
  Loader2,
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { useEffect, useRef, useState } from "react";
import placeholder from "/placeholder.png";
import TikcetClient from "@/components/TicketClient";
import PaymentModal, { type Payment } from "@/components/PaymentModal";
import AmountModal from "@/components/AmountModal";

// Remembers (per browser) whether "Packs" is shown above "Vos Services"
const PACKS_FIRST_KEY = "pos.packsFirst";

const readPacksFirst = () => {
  try {
    return localStorage.getItem(PACKS_FIRST_KEY) === "1";
  } catch {
    return false;
  }
};

// Open-price product: the only product BELDI locals can sell
const TOTAL_ARTICLES = "TotalArticles";

export interface PackContent {
  id: number;
  name: string;
  /** quantity in one pack */
  quantity: number;
  /** units taken out of the pack in the cart: not given, not destocked */
  removed?: number;
}

/** Units of a pack product actually given for `packQty` packs */
export const keptQuantity = (p: PackContent, packQty: number) =>
  Math.max(0, p.quantity * packQty - (p.removed || 0));

export interface Item {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  type: "product" | "service" | "pack";
  frais: number;
  quantity?: number;
  stock: {
    quantity: number;
  }[];
  /** packs only */
  serviceNames?: string[];
  packProducts?: PackContent[];
}

interface PackResponse {
  id: number;
  name: string;
  price: number;
  services: { service: { name: string; frais: number } }[];
  products: {
    product_id: number;
    quantity: number;
    product: { name: string };
  }[];
}

interface Category {
  id: number;
  image_url?: string;
  name: string;
}

export default function Pos() {
  const { user } = useAuth();
  const shift = useShift();
  const isSubmitting = useRef(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(false);
  const [showPayment, setShowPayment] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isServiceSelected, setIsServiceSelected] = useState<boolean>(true);
  const [isPackSelected, setIsPackSelected] = useState<boolean>(false);
  const [packs, setPacks] = useState<Item[]>([]);
  const [packsFirst, setPacksFirst] = useState<boolean>(readPacksFirst);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [cart, setCart] = useState<Item[]>([]);
  const [totalArticles, setTotalArticles] = useState<Item | null>(null);
  const [showAmount, setShowAmount] = useState<boolean>(false);
  // phone only: the cart is a bottom sheet
  const [showCart, setShowCart] = useState<boolean>(false);
  const [loading, setLoading] = useState({
    categories: false,
    services: false,
    products: false,
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  // Calculate total price
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0,
  );

  const isBeldi = user?.local.type === "BELDI";

  const selectServices = () => {
    setSelectedCategory(null);
    setIsPackSelected(false);
    setIsServiceSelected(true);
  };

  const selectPacks = () => {
    setSelectedCategory(null);
    setIsServiceSelected(false);
    setIsPackSelected(true);
  };

  // Opens the group shown at the top of the list
  const selectFirstGroup = (packsCount = packs.length) =>
    packsFirst && packsCount > 0 ? selectPacks() : selectServices();

  const togglePacksFirst = () => {
    const next = !packsFirst;
    setPacksFirst(next);
    try {
      localStorage.setItem(PACKS_FIRST_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: the order just isn't remembered
    }
  };

  useEffect(() => {
    fetchServices();
    fetchPacks();
    if (isBeldi) fetchTotalArticles();
    else fetchCategories();
  }, []);

  useEffect(() => {
    if (!isServiceSelected && selectedCategory !== null) {
      fetchCategoryProducts();
    }
  }, [selectedCategory, isServiceSelected]);

  const handleStock = user?.local.type === "TURKI";

  // Called by the payment modal once a payment method is confirmed.
  // Errors are re-thrown so the modal can show them.
  const handleSubmitOrder = async (payment: Payment) => {
    if (cart.length === 0 || isSubmitting.current || !shift.shift) return;
    isSubmitting.current = true;
    setIsLoadingOrder(true);

    try {
      const orderItems = cart.map((item) => ({
        id: item.id,
        quantity: item.quantity || 1,
        type: item.type,
        price: item.price,
        frais: item.frais || 0,
      }));

      // packs: the server sets the price; only kept products are destocked
      const orderPacks = cart
        .filter((item) => item.type === "pack")
        .map((item) => ({
          id: item.id,
          quantity: item.quantity || 1,
          products: (item.packProducts || [])
            .map((p) => ({
              id: p.id,
              quantity: keptQuantity(p, item.quantity || 1),
            }))
            .filter((p) => p.quantity > 0),
        }));

      await api.post("/sales/add", {
        products: orderItems.filter((item) => item.type === "product"),
        services: orderItems.filter((item) => item.type === "service"),
        packs: orderPacks,
        user_id: user?.id,
        total: totalPrice,
        // not stored by the server yet
        payment,
      });

      reactToPrintFn();
      // updates the shift balance in the navbar
      shift.refresh();

      setCart([]);
      selectFirstGroup();
    } catch (error) {
      console.error("Error submitting order:", error);
      throw error;
    } finally {
      setIsLoadingOrder(false);
      isSubmitting.current = false;
    }
  };
  const fetchCategoryProducts = async () => {
    try {
      setLoading((prev) => ({ ...prev, products: true }));
      const response = await api.get(
        `/products/list?category_id=${selectedCategory}`,
        {
          params: {
            local_id: user?.local.id,
          },
        },
      );
      setProducts(
        response.data.data
          .filter((product: Item) => product.name !== TOTAL_ARTICLES)
          .map((product: Item) => ({
            ...product,
            type: "product",
          })),
      );
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading((prev) => ({ ...prev, products: false }));
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading((prev) => ({ ...prev, categories: true }));
      const response = await api.get(`/categories/list`);
      setCategories(
        response.data.data.filter(
          (category: Category) => category.name !== TOTAL_ARTICLES,
        ),
      );
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading((prev) => ({ ...prev, categories: false }));
    }
  };

  const fetchPacks = async () => {
    try {
      const response = await api.get(`/packs/list`, {
        params: { local_id: user?.local.id },
      });
      const loaded: Item[] = (response.data.data as PackResponse[]).map(
        (pack) => ({
          id: pack.id,
          name: pack.name,
          price: pack.price,
          type: "pack",
          frais: pack.services.reduce((sum, s) => sum + s.service.frais, 0),
          stock: [],
          serviceNames: pack.services.map((s) => s.service.name),
          packProducts: pack.products.map((p) => ({
            id: p.product_id,
            name: p.product.name,
            quantity: p.quantity,
          })),
        }),
      );
      setPacks(loaded);
      // packs on top: open them first
      if (packsFirst && loaded.length > 0) selectPacks();
    } catch (error) {
      console.error("Error fetching packs:", error);
    }
  };

  // Takes one unit of a product out of a pack in the cart (delta 1)
  // or puts one back (delta -1). The pack price doesn't change.
  const changePackProduct = (
    packId: number,
    productId: number,
    delta: 1 | -1,
  ) => {
    setCart((prevCart) =>
      prevCart.map((cartItem) => {
        if (cartItem.type !== "pack" || cartItem.id !== packId) return cartItem;
        const packQty = cartItem.quantity || 1;
        return {
          ...cartItem,
          packProducts: cartItem.packProducts?.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  removed: Math.min(
                    p.quantity * packQty,
                    Math.max(0, (p.removed || 0) + delta),
                  ),
                }
              : p,
          ),
        };
      }),
    );
  };

  const fetchTotalArticles = async () => {
    try {
      setLoading((prev) => ({ ...prev, products: true }));
      const response = await api.get(`/products/total-articles`);
      setTotalArticles({
        ...response.data.data,
        type: "product",
        frais: 0,
        stock: [],
      });
    } catch (error) {
      console.error("Error fetching TotalArticles:", error);
    } finally {
      setLoading((prev) => ({ ...prev, products: false }));
    }
  };

  const isTotalArticles = (item: Item) =>
    item.type === "product" && item.id === totalArticles?.id;

  // Each new amount is added to the single TotalArticles cart line
  const addTotalArticles = (amount: number) => {
    if (!totalArticles) return;
    setCart((prevCart) =>
      prevCart.some(isTotalArticles)
        ? prevCart.map((cartItem) =>
            isTotalArticles(cartItem)
              ? { ...cartItem, price: cartItem.price + amount }
              : cartItem,
          )
        : [...prevCart, { ...totalArticles, price: amount, quantity: 1 }],
    );
    setShowAmount(false);
  };

  const fetchServices = async () => {
    try {
      setLoading((prev) => ({ ...prev, services: true }));
      const response = await api.get(
        `/services/list?local_id=${user?.local.id}`,
      );
      setServices(
        response.data.data.map((service: Item) => ({
          ...service,
          type: "service",
        })),
      );
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading((prev) => ({ ...prev, services: false }));
    }
  };

  const totalQ = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const addToCart = (item: Item) => {
    const existingItem = cart.find(
      (cartItem) => cartItem.id === item.id && cartItem.type === item.type,
    );

    if (item.type === "product") {
      const stock = existingItem
        ? (item.stock[0]?.quantity || 0) - ((existingItem.quantity || 1) + 1)
        : (item.stock[0]?.quantity || 0) - 1;

      if (handleStock && stock < 0) return;
    }

    if (item)
      setCart((prevCart) => {
        if (existingItem) {
          return prevCart.map((cartItem) =>
            cartItem.id === item.id && cartItem.type === item.type
              ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 }
              : cartItem,
          );
        } else {
          return [...prevCart, { ...item, quantity: 1 }];
        }
      });
  };

  const removeFromCart = (id: number, itemType: Item["type"]) => {
    setCart((prevCart) =>
      prevCart.filter((item) => !(item.id === id && item.type === itemType)),
    );
  };

  const decreaseQuantity = (id: number, itemType: Item["type"]) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.id === id && item.type === itemType,
      );

      if (existingItem && existingItem.quantity && existingItem.quantity > 1) {
        return prevCart.map((item) =>
          item.id === id && item.type === itemType
            ? { ...item, quantity: item.quantity! - 1 }
            : item,
        );
      } else {
        return prevCart.filter(
          (item) => !(item.id === id && item.type === itemType),
        );
      }
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const currentItems = isServiceSelected
    ? services
    : isPackSelected
      ? packs
      : isBeldi
        ? totalArticles
          ? [totalArticles]
          : []
        : products;

  // Phone: same groups as the categories side, as a row of chips
  const servicesGroup = {
    key: "services",
    name: "Services",
    isActive: isServiceSelected,
    onClick: selectServices,
  };
  const packsGroups =
    packs.length > 0
      ? [
          {
            key: "packs",
            name: "Packs",
            isActive: isPackSelected,
            onClick: selectPacks,
          },
        ]
      : [];
  const mobileGroups = [
    ...(packsFirst
      ? [...packsGroups, servicesGroup]
      : [servicesGroup, ...packsGroups]),
    ...(isBeldi
      ? [
          {
            key: "articles",
            name: "Articles",
            isActive: !isServiceSelected && !isPackSelected,
            onClick: () => {
              setSelectedCategory(null);
              setIsPackSelected(false);
              setIsServiceSelected(false);
            },
          },
        ]
      : categories.map((category) => ({
          key: `category-${category.id}`,
          name: category.name,
          isActive:
            !isServiceSelected &&
            !isPackSelected &&
            selectedCategory === category.id,
          onClick: () => {
            setSelectedCategory(category.id);
            setIsPackSelected(false);
            setIsServiceSelected(false);
          },
        }))),
  ];

  return (
    <main className="flex flex-col md:flex-row rounded-lg fixed top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-auto pt-3 md:pt-24 md:h-[95%] left-0 px-3 md:px-5 w-screen gap-3 md:gap-4">
      {/* Categories: chips on phone */}
      <nav className="md:hidden flex shrink-0 items-center gap-2 overflow-x-auto -mx-3 px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mobileGroups.map((group) => (
          <button
            key={group.key}
            onClick={group.onClick}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              group.isActive
                ? "border-main bg-main text-white shadow-sm"
                : "bg-white text-gray-700 active:bg-gray-100",
            )}
          >
            {group.name}
          </button>
        ))}
        {loading.categories && (
          <Loader2 className="size-5 shrink-0 animate-spin text-main" />
        )}
        {packs.length > 0 && (
          <button
            onClick={togglePacksFirst}
            title={
              packsFirst
                ? "Mettre les services en haut"
                : "Mettre les packs en haut"
            }
            className="ml-auto shrink-0 rounded-full border bg-white p-2 text-gray-600"
          >
            <ArrowUpDownIcon className="size-4" />
          </button>
        )}
      </nav>

      {/* Categories Side */}
      <div className="hidden md:flex border-r rounded-l-lg border min-w-[12vw] h-full overflow-hidden flex-col bg-white shadow-sm">
        <div className="px-4 py-4 bg-gray-50">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold">
              Catégories (
              {(isBeldi ? 2 : categories.length + 1) +
                (packs.length > 0 ? 1 : 0)}
              )
            </h1>
            {packs.length > 0 && (
              <button
                onClick={togglePacksFirst}
                title={
                  packsFirst
                    ? "Mettre les services en haut"
                    : "Mettre les packs en haut"
                }
                className="shrink-0 rounded-md border bg-white p-2 text-gray-600 hover:bg-gray-100 hover:text-main"
              >
                <ArrowUpDownIcon className="size-5" />
              </button>
            )}
          </div>
          <hr className="border my-3" />
        </div>

        <section className="flex overflow-auto px-4 pt-4 h-full flex-col gap-4 pb-4">
          <div
            className={cn(
              "flex gap-4",
              packsFirst ? "flex-col-reverse" : "flex-col",
            )}
          >
            <CategoryCard
              isActive={isServiceSelected}
              name="Vos Services"
              isService={true}
              onClick={selectServices}
            />

            {packs.length > 0 && (
              <CategoryCard
                isActive={isPackSelected}
                name="Packs"
                onClick={selectPacks}
              />
            )}
          </div>

          <hr className="border" />

          {isBeldi ? (
            <CategoryCard
              isActive={!isServiceSelected && !isPackSelected}
              name="Articles"
              onClick={() => {
                setSelectedCategory(null);
                setIsPackSelected(false);
                setIsServiceSelected(false);
              }}
            />
          ) : loading.categories ? (
            <LoadingSpinning inline label="Chargement des catégories…" />
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                isActive={
                  !isServiceSelected &&
                  !isPackSelected &&
                  selectedCategory === category.id
                }
                name={category.name}
                image_url={category.image_url}
                id={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setIsPackSelected(false);
                  setIsServiceSelected(false);
                }}
              />
            ))
          )}
        </section>
      </div>

      {/* Products Side */}
      <div className="border-r col-span-3 border rounded-lg md:rounded-none min-h-0 md:h-full flex-1 md:flex-grow overflow-hidden flex flex-col bg-white shadow-sm">
        <div className="px-3 py-2 md:px-4 md:py-4 bg-gray-50 max-md:border-b">
          <h1 className="text-base md:text-2xl font-semibold">
            {isServiceSelected
              ? "Services"
              : isPackSelected
                ? "Packs"
                : "Produits"}{" "}
            ({currentItems.length}) :
          </h1>
          <hr className="hidden md:block border my-3" />
        </div>

        {loading.products || loading.services ? (
          <LoadingSpinning
            inline
            label={`Chargement des ${loading.products ? "produits" : "services"}…`}
          />
        ) : currentItems.length === 0 ? (
          <div className="flex flex-col gap-3 items-center justify-center my-16 md:my-32 text-xl text-center font-medium">
            <PackageXIcon className="size-16 text-main" />
            <p>
              Pas de{" "}
              {isServiceSelected
                ? "services"
                : isPackSelected
                  ? "packs"
                  : "produits"}
              !
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto">
            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 md:gap-4 md:p-4">
              {currentItems.map((item) => (
                <ProductCard
                  handleStock={handleStock && item.type === "product"}
                  key={`${item.type}-${item.id}`}
                  item={item}
                  openPrice={isTotalArticles(item)}
                  onAddToCart={() =>
                    isTotalArticles(item)
                      ? setShowAmount(true)
                      : addToCart(item)
                  }
                />
              ))}
            </section>
          </div>
        )}
      </div>

      {/* Phone: cart summary bar, opens the cart sheet */}
      <button
        onClick={() => setShowCart(true)}
        className={cn(
          "md:hidden shrink-0 mb-2 flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg transition-colors",
          cart.length > 0
            ? "bg-main text-white"
            : "border bg-white text-gray-500",
        )}
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="relative">
            <ShoppingBasketIcon className="size-6" />
            {totalQ > 0 && (
              <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-main">
                {totalQ}
              </span>
            )}
          </span>
          {cart.length > 0 ? "Voir le panier" : "Panier vide"}
        </span>
        <span className="flex items-center gap-1 text-lg font-bold">
          {totalPrice.toFixed(2)} DH
          <ChevronUpIcon className="size-5" />
        </span>
      </button>

      {showCart && (
        <div
          onClick={() => setShowCart(false)}
          className="md:hidden fixed inset-0 z-[60] bg-black/40"
        />
      )}

      {/* Cart Side (bottom sheet on phone) */}
      <div
        className={cn(
          "col-span-2 rounded-r-lg border min-w-[25vw] h-full overflow-hidden flex flex-col bg-white shadow-sm",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[60] max-md:h-[85dvh] max-md:min-w-0 max-md:rounded-t-2xl max-md:rounded-b-none max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-2xl max-md:transition-transform max-md:duration-300",
          showCart ? "max-md:translate-y-0" : "max-md:translate-y-full",
        )}
      >
        <div className="px-4 pt-2 pb-3 md:py-4 bg-gray-50 max-md:border-b">
          <div className="md:hidden mx-auto mb-2 h-1.5 w-10 rounded-full bg-gray-300" />
          <div className="flex justify-between items-center gap-2">
            <h1 className="text-xl md:text-2xl font-semibold">
              Panier ({cart.length}) :
            </h1>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 max-md:rounded-md max-md:bg-red-50 max-md:px-3 max-md:py-2"
                >
                  <Trash2Icon size={16} />
                  Vider
                </button>
              )}
              <button
                onClick={() => setShowCart(false)}
                title="Fermer le panier"
                className="md:hidden rounded-md border bg-white p-2 text-gray-600"
              >
                <ChevronDownIcon className="size-5" />
              </button>
            </div>
          </div>
          <hr className="hidden md:block border my-3" />
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col gap-3 items-center justify-center my-16 md:my-32 text-xl text-center font-medium">
            <ShoppingBasketIcon className="size-16 text-main" />
            <p>Panier vide!</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-auto">
            <div className="overflow-y-auto flex-1 p-2 md:p-4">
              {cart.map((item) => (
                <CartItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onIncrease={() =>
                    isTotalArticles(item)
                      ? setShowAmount(true)
                      : addToCart(item)
                  }
                  onDecrease={() => decreaseQuantity(item.id, item.type)}
                  onRemove={() => removeFromCart(item.id, item.type)}
                  onRemovePackProduct={(productId) =>
                    changePackProduct(item.id, productId, 1)
                  }
                  onRestorePackProduct={(productId) =>
                    changePackProduct(item.id, productId, -1)
                  }
                />
              ))}
            </div>

            <div className="border-t p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">Quantité:</span>
                <span className="font-bold text-lg">{totalQ.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="font-medium">Total:</span>
                <span className="font-bold text-lg">
                  {totalPrice.toFixed(2)} DH
                </span>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 bg-main hover:bg-main-dark text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={() => {
                  setShowCart(false);
                  setShowPayment(true);
                }}
                disabled={isLoadingOrder || !shift.shift}
              >
                {isLoadingOrder && <Loader2 className="size-5 animate-spin" />}
                {isLoadingOrder
                  ? "Traitement..."
                  : shift.shift
                    ? "Valider la commande"
                    : "Aucun shift en cours"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!shift.loading && !shift.shift && (
        <NoShiftOverlay
          otherUser={shift.localShift?.user.name}
          onStart={shift.openStart}
        />
      )}

      <PaymentModal
        open={showPayment && !!shift.shift}
        total={totalPrice}
        onClose={() => setShowPayment(false)}
        onConfirm={handleSubmitOrder}
      />

      <AmountModal
        open={showAmount}
        title={TOTAL_ARTICLES}
        onClose={() => setShowAmount(false)}
        onSubmit={addTotalArticles}
      />

      <div className="print:block hidden" ref={contentRef}>
        <TikcetClient cart={cart} paidAmount={totalPrice} />
      </div>
    </main>
  );
}

/** Covers the POS while the user has no open shift */
function NoShiftOverlay({
  otherUser,
  onStart,
}: {
  /** another user has an open shift in this local */
  otherUser?: string;
  onStart: () => void;
}) {
  return (
    <div className="absolute inset-0 md:top-20 z-40 flex items-center justify-center bg-white/70 px-4 backdrop-blur-sm">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border bg-white p-6 md:p-8 text-center shadow-xl">
        <div className="flex size-16 items-center justify-center rounded-full bg-main/10">
          <LockIcon className="size-8 text-main" />
        </div>
        <h2 className="text-2xl font-semibold">Aucun shift en cours</h2>
        <p className="text-gray-600">
          {otherUser
            ? `Un shift est déjà en cours dans ce local par ${otherUser}. Il doit être clôturé avant que vous puissiez vendre.`
            : "Démarrez un shift avec votre fond de caisse pour commencer à vendre."}
        </p>
        <button
          onClick={onStart}
          className="w-full rounded-lg bg-main py-3 font-medium text-white transition-colors hover:bg-main-dark"
        >
          {otherUser ? "Voir le shift en cours" : "Démarrer un shift"}
        </button>
      </div>
    </div>
  );
}

interface CategoryCardProps {
  name: string;
  isActive: boolean;
  isService?: boolean;
  image_url?: string;
  id?: number;
  onClick: () => void;
}

function CategoryCard({
  name,
  isActive,
  onClick,
  image_url,
}: CategoryCardProps) {
  return (
    <section
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer rounded-lg transition-all bg-[#EFF1F3]",
        isActive ? "ring-2 ring-main opacity-80" : "hover:bg-gray-50",
      )}
    >
      <div className="bg-gray-100 rounded-t-lg flex items-center justify-center">
        <img
          src={image_url ? `${API_BASE_URL}${image_url}` : placeholder}
          alt={name}
          className="object-contain h-20 w-full aspect-square rounded-t-lg"
        />
      </div>
      <p className="bg-white border text-center text-xl py-1.5 truncate rounded-b-lg font-medium">
        {name}
      </p>
    </section>
  );
}

interface ProductCardProps {
  item: Item;
  handleStock: boolean;
  /** price is typed in when adding (TotalArticles) */
  openPrice?: boolean;
  onAddToCart: () => void;
}

function ProductCard({
  item,
  onAddToCart,
  handleStock,
  openPrice,
}: ProductCardProps) {
  const stock = handleStock ? item?.stock[0]?.quantity || 0 : 0;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onAddToCart();
  };

  return (
    <section
      onClick={(e) => handleClick(e)}
      className="w-full rounded-lg cursor-pointer relative border hover:shadow-md transition-all active:scale-[0.97] select-none"
    >
      <div className="bg-gray-100 h-28 md:h-32 relative rounded-t-lg flex items-center justify-center">
        {item.type === "pack" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-sm text-gray-600">
            <BoxesIcon className="size-8 text-main" />
            <p className="font-medium text-gray-800 truncate max-w-full">
              {item.serviceNames?.join(" + ")}
            </p>
            {!!item.packProducts?.length && (
              <p className="truncate max-w-full">
                + {item.packProducts.length} produit
                {item.packProducts.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
        ) : (
          <img
            src={
              item.image_url ? `${API_BASE_URL}${item.image_url}` : placeholder
            }
            className="object-contain h-full w-full"
            alt={item.name}
          />
        )}

        {handleStock && (
          <p
            style={{
              backgroundColor: stock === 0 ? "red" : "green",
            }}
            className="absolute top-2 left-2 rounded-md text-white text-xs md:text-base font-medium px-2"
          >
            Stock : {stock || 0}
          </p>
        )}
      </div>
      <div className="p-2 flex justify-between bg-white rounded-b-lg">
        <p className="font-medium truncate">{item.name}</p>
        <span className="font-bold bg-main text-white absolute bottom-10 px-2 rounded-tl-lg py-0.5 right-0 text-sm md:text-base">
          {openPrice ? "Montant libre" : `${item.price} DH`}
        </span>
      </div>
    </section>
  );
}

interface CartItemProps {
  item: Item;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  /** takes one unit out of the pack */
  onRemovePackProduct: (productId: number) => void;
  /** puts one unit back */
  onRestorePackProduct: (productId: number) => void;
}

function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  onRemovePackProduct,
  onRestorePackProduct,
}: CartItemProps) {
  const qty = item.quantity || 1;

  return (
    <div className="p-3 border-b last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate text-base md:text-xl">
            {item.type === "pack" && (
              <BoxesIcon className="inline size-5 mr-1.5 -mt-1 text-main" />
            )}
            {item.name}
          </h3>
          <p className="text-gray-500 text-sm md:text-base">
            {item.price.toFixed(2)} DH{" "}
            {item.type !== "product" &&
              item.frais > 0 &&
              `dont ${item.frais} DH Frais de Kessal.`}
          </p>
        </div>

        {/* <div className="font-semibold flex-1">
        <p className="font-normal opacity-65">
          Qté: {item.quantity?.toFixed(2) || 1}
        </p>
        <p>{(item.price * (item.quantity || 1)).toFixed(2)} DH</p>
      </div> */}

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <div className="flex items-center border rounded-md">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDecrease();
              }}
              className="px-4 py-3 hover:bg-gray-100"
            >
              <MinusIcon size={14} />
            </button>
            <span className="px-2 font-medium">{item.quantity}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onIncrease();
              }}
              className="px-4 py-3 hover:bg-gray-100"
            >
              <PlusIcon size={14} />
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-red-500 hover:text-red-700 p-2 rounded-md bg-red-100 ml-1 md:ml-2"
          >
            <Trash2Icon className="size-5 md:size-6" />
          </button>
        </div>
      </div>

      {item.type === "pack" && (
        <ul className="mt-2 ml-2 border-l-2 border-main/30 pl-3 space-y-1 text-sm">
          {item.serviceNames?.map((name) => (
            <li key={name} className="text-gray-700">
              <span className="font-medium">{qty} ×</span> {name}{" "}
              <span className="text-gray-400">(service)</span>
            </li>
          ))}
          {item.packProducts?.map((p) => {
            const kept = keptQuantity(p, qty);
            const removed = p.quantity * qty - kept;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2"
              >
                <span
                  className={cn(
                    "truncate",
                    kept === 0 ? "text-gray-400 line-through" : "text-gray-700",
                  )}
                >
                  <span className="font-medium">{kept} ×</span> {p.name}
                  {removed > 0 && (
                    <span className="ml-1 text-xs text-red-500 no-underline">
                      (-{removed} retiré{removed > 1 ? "s" : ""})
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {removed > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestorePackProduct(p.id);
                      }}
                      title="Remettre 1 dans le pack"
                      className="rounded-md p-1.5 text-green-700 bg-green-100 hover:bg-green-200"
                    >
                      <Undo2Icon className="size-4" />
                    </button>
                  )}
                  {kept > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePackProduct(p.id);
                      }}
                      title="Retirer 1 du pack"
                      className="rounded-md p-1.5 text-red-500 bg-red-100 hover:bg-red-200"
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
