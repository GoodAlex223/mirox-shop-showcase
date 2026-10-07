import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/stores/cart.store";

describe("Cart Store", () => {
  beforeEach(() => {
    // Reset store before each test
    useCartStore.setState({ items: [], isOpen: false });
  });

  describe("addItem", () => {
    it("should add a new item to the cart", () => {
      const { addItem } = useCartStore.getState();

      addItem({
        productId: "prod-1",
        name: "Test Product",
        price: 29.99,
        maxStock: 10,
      });

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toMatchObject({
        productId: "prod-1",
        name: "Test Product",
        price: 29.99,
        quantity: 1,
      });
    });

    it("should increment quantity for existing item", () => {
      const { addItem } = useCartStore.getState();

      addItem({
        productId: "prod-1",
        name: "Test Product",
        price: 29.99,
        maxStock: 10,
      });

      addItem({
        productId: "prod-1",
        name: "Test Product",
        price: 29.99,
        maxStock: 10,
      });

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(2);
    });

    it("should not exceed maxStock when adding items", () => {
      const { addItem } = useCartStore.getState();

      addItem({
        productId: "prod-1",
        name: "Test Product",
        price: 29.99,
        maxStock: 3,
        quantity: 5,
      });

      const state = useCartStore.getState();
      expect(state.items[0].quantity).toBe(3);
    });

    it("should treat different variants as separate items", () => {
      const { addItem } = useCartStore.getState();

      addItem({
        productId: "prod-1",
        variantId: "var-1",
        name: "Test Product - Red",
        price: 29.99,
        maxStock: 10,
      });

      addItem({
        productId: "prod-1",
        variantId: "var-2",
        name: "Test Product - Blue",
        price: 29.99,
        maxStock: 10,
      });

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(2);
    });

    it("should not increment quantity when productId matches but variantId differs", () => {
      const { addItem } = useCartStore.getState();

      addItem({
        productId: "prod-1",
        variantId: "var-1",
        name: "Test Product - Red",
        price: 29.99,
        maxStock: 10,
        quantity: 2,
      });

      addItem({
        productId: "prod-1",
        variantId: "var-2",
        name: "Test Product - Blue",
        price: 29.99,
        maxStock: 10,
        quantity: 3,
      });

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.items[0].quantity).toBe(2);
      expect(state.items[1].quantity).toBe(3);
    });

    it("should increment correct variant and leave others unchanged", () => {
      useCartStore.setState({
        items: [
          {
            productId: "prod-1",
            variantId: "var-1",
            name: "Test Red",
            price: 10,
            quantity: 1,
            maxStock: 10,
          },
          {
            productId: "prod-1",
            variantId: "var-2",
            name: "Test Blue",
            price: 10,
            quantity: 1,
            maxStock: 10,
          },
        ],
      });

      const { addItem } = useCartStore.getState();
      addItem({
        productId: "prod-1",
        variantId: "var-1",
        name: "Test Red",
        price: 10,
        maxStock: 10,
        quantity: 2,
      });

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.items[0].quantity).toBe(3); // 1 + 2
      expect(state.items[1].quantity).toBe(1); // unchanged
    });

    it("carries optional color and size through addItem", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        variantId: "v1",
        name: "Худі Mirox Basic",
        price: 1290,
        maxStock: 5,
        color: "Чорний",
        size: "L",
      });
      const item = useCartStore.getState().items[0];
      expect(item.color).toBe("Чорний");
      expect(item.size).toBe("L");
    });

    it("accepts legacy items without color/size (old persisted carts)", () => {
      useCartStore.getState().addItem({
        productId: "p2",
        name: "Худі Mirox Basic — L",
        price: 1290,
        maxStock: 5,
      });
      const item = useCartStore.getState().items[0];
      expect(item.color).toBeUndefined();
      expect(item.size).toBeUndefined();
    });
  });

  describe("removeItem", () => {
    it("should remove an item from the cart", () => {
      useCartStore.setState({
        items: [
          { productId: "prod-1", name: "Test", price: 10, quantity: 1, maxStock: 10 },
          { productId: "prod-2", name: "Test 2", price: 20, quantity: 2, maxStock: 10 },
        ],
      });

      const { removeItem } = useCartStore.getState();
      removeItem("prod-1");

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].productId).toBe("prod-2");
    });

    it("should remove correct variant", () => {
      useCartStore.setState({
        items: [
          {
            productId: "prod-1",
            variantId: "var-1",
            name: "Test Red",
            price: 10,
            quantity: 1,
            maxStock: 10,
          },
          {
            productId: "prod-1",
            variantId: "var-2",
            name: "Test Blue",
            price: 10,
            quantity: 1,
            maxStock: 10,
          },
        ],
      });

      const { removeItem } = useCartStore.getState();
      removeItem("prod-1", "var-1");

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].variantId).toBe("var-2");
    });
  });

  describe("updateQuantity", () => {
    it("should update item quantity", () => {
      useCartStore.setState({
        items: [{ productId: "prod-1", name: "Test", price: 10, quantity: 1, maxStock: 10 }],
      });

      const { updateQuantity } = useCartStore.getState();
      updateQuantity("prod-1", 5);

      const state = useCartStore.getState();
      expect(state.items[0].quantity).toBe(5);
    });

    it("should not exceed maxStock", () => {
      useCartStore.setState({
        items: [{ productId: "prod-1", name: "Test", price: 10, quantity: 1, maxStock: 3 }],
      });

      const { updateQuantity } = useCartStore.getState();
      updateQuantity("prod-1", 10);

      const state = useCartStore.getState();
      expect(state.items[0].quantity).toBe(3);
    });

    it("should remove item when quantity is 0 or less", () => {
      useCartStore.setState({
        items: [{ productId: "prod-1", name: "Test", price: 10, quantity: 2, maxStock: 10 }],
      });

      const { updateQuantity } = useCartStore.getState();
      updateQuantity("prod-1", 0);

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(0);
    });

    it("should only update matching variant when productId is same but variantId differs", () => {
      useCartStore.setState({
        items: [
          {
            productId: "prod-1",
            variantId: "var-1",
            name: "Test Red",
            price: 10,
            quantity: 1,
            maxStock: 10,
          },
          {
            productId: "prod-1",
            variantId: "var-2",
            name: "Test Blue",
            price: 10,
            quantity: 1,
            maxStock: 10,
          },
        ],
      });

      const { updateQuantity } = useCartStore.getState();
      updateQuantity("prod-1", 5, "var-1");

      const state = useCartStore.getState();
      expect(state.items[0].quantity).toBe(5);
      expect(state.items[1].quantity).toBe(1);
    });
  });

  describe("clearCart", () => {
    it("should remove all items from the cart", () => {
      useCartStore.setState({
        items: [
          { productId: "prod-1", name: "Test 1", price: 10, quantity: 1, maxStock: 10 },
          { productId: "prod-2", name: "Test 2", price: 20, quantity: 2, maxStock: 10 },
        ],
      });

      const { clearCart } = useCartStore.getState();
      clearCart();

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(0);
    });
  });

  describe("getTotalItems", () => {
    it("should return total quantity of all items", () => {
      useCartStore.setState({
        items: [
          { productId: "prod-1", name: "Test 1", price: 10, quantity: 2, maxStock: 10 },
          { productId: "prod-2", name: "Test 2", price: 20, quantity: 3, maxStock: 10 },
        ],
      });

      const { getTotalItems } = useCartStore.getState();
      expect(getTotalItems()).toBe(5);
    });

    it("should return 0 for empty cart", () => {
      const { getTotalItems } = useCartStore.getState();
      expect(getTotalItems()).toBe(0);
    });
  });

  describe("getTotalPrice", () => {
    it("should return total price of all items", () => {
      useCartStore.setState({
        items: [
          { productId: "prod-1", name: "Test 1", price: 10, quantity: 2, maxStock: 10 },
          { productId: "prod-2", name: "Test 2", price: 20, quantity: 3, maxStock: 10 },
        ],
      });

      const { getTotalPrice } = useCartStore.getState();
      expect(getTotalPrice()).toBe(80); // (10*2) + (20*3)
    });

    it("should return 0 for empty cart", () => {
      const { getTotalPrice } = useCartStore.getState();
      expect(getTotalPrice()).toBe(0);
    });
  });

  describe("getItem", () => {
    it("should return item if it exists", () => {
      useCartStore.setState({
        items: [{ productId: "prod-1", name: "Test", price: 10, quantity: 1, maxStock: 10 }],
      });

      const { getItem } = useCartStore.getState();
      const item = getItem("prod-1");

      expect(item).toBeDefined();
      expect(item?.productId).toBe("prod-1");
    });

    it("should return undefined if item does not exist", () => {
      const { getItem } = useCartStore.getState();
      const item = getItem("non-existent");

      expect(item).toBeUndefined();
    });
  });

  describe("cart open/close", () => {
    it("should toggle cart", () => {
      const { toggleCart } = useCartStore.getState();

      expect(useCartStore.getState().isOpen).toBe(false);
      toggleCart();
      expect(useCartStore.getState().isOpen).toBe(true);
      toggleCart();
      expect(useCartStore.getState().isOpen).toBe(false);
    });

    it("should open cart", () => {
      const { openCart } = useCartStore.getState();
      openCart();
      expect(useCartStore.getState().isOpen).toBe(true);
    });

    it("should close cart", () => {
      useCartStore.setState({ isOpen: true });
      const { closeCart } = useCartStore.getState();
      closeCart();
      expect(useCartStore.getState().isOpen).toBe(false);
    });
  });
});
