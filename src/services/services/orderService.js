const prisma = require("../lib/prisma");

function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${yyyy}${mm}${dd}-${random}`;
}

async function createUniqueOrderNumber() {
  for (let i = 0; i < 10; i += 1) {
    const orderNumber = generateOrderNumber();
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (!existing) return orderNumber;
  }
  throw new Error("Failed to generate a unique order number");
}

function safeNumber(value) {
  if (value == null) return null;
  return Number(value);
}

function safeBigInt(value) {
  if (value == null) return null;
  return typeof value === "bigint" ? value.toString() : value;
}

function serializeProduct(product) {
  if (!product) return null;

  return {
    ...product,
    price: safeNumber(product.price),
    fileSize: safeBigInt(product.fileSize),
    images: Array.isArray(product.images) ? product.images : [],
    files: Array.isArray(product.files)
      ? product.files.map((file) => ({
          ...file,
          fileSize: safeBigInt(file.fileSize),
        }))
      : [],
  };
}

function serializeOrderItem(item) {
  return {
    ...item,
    price: safeNumber(item.price),
    unitPrice: safeNumber(item.unitPrice),
    lineTotal: safeNumber(item.lineTotal),
    product: serializeProduct(item.product),
  };
}

function serializeOrder(order) {
  if (!order) return null;

  return {
    ...order,
    subtotalAmount: safeNumber(order.subtotalAmount),
    discountAmount: safeNumber(order.discountAmount),
    serviceFeeAmount: safeNumber(order.serviceFeeAmount),
    totalAmount: safeNumber(order.totalAmount),
    items: Array.isArray(order.items)
      ? order.items.map(serializeOrderItem)
      : [],
  };
}

async function createOrder(payload) {
  const { customerName, customerEmail, userId = null, items } = payload;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Order items are required");
  }

  const productIds = items.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      files: true,
    },
  });

  if (products.length !== productIds.length) {
    throw new Error("Some products are invalid or unavailable");
  }

  const normalizedItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);

    if (!product) {
      throw new Error(`Product not found for ID: ${item.productId}`);
    }

    const quantity = Number(item.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Invalid quantity for product: ${product.title}`);
    }

    const unitPrice = Number(product.price);
    const lineTotal = unitPrice * quantity;

    return {
      itemType: "product",
      productId: product.id,
      title: product.title,
      titleSnapshot: product.title,
      quantity,
      price: unitPrice,
      unitPrice,
      lineTotal,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const orderNumber = await createUniqueOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerEmail,
      subtotalAmount: subtotal,
      totalAmount: subtotal,
      currency: "USD",
      ...(userId
        ? {
            user: {
              connect: { id: userId },
            },
          }
        : {}),
      items: {
        create: normalizedItems.map((item) => ({
          itemType: item.itemType,
          productId: item.productId,
          title: item.title,
          titleSnapshot: item.titleSnapshot,
          quantity: item.quantity,
          price: item.price,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { sortOrder: "asc" },
              },
              files: true,
            },
          },
        },
      },
    },
  });

  return serializeOrder(order);
}

async function getOrderById(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { sortOrder: "asc" },
              },
              files: true,
            },
          },
        },
      },
    },
  });

  return serializeOrder(order);
}

async function getOrdersByUserId(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              price: true,
              fileSize: true,
              images: {
                orderBy: { sortOrder: "asc" },
              },
              files: {
                orderBy: {
                  isPrimary: "desc",
                },
                select: {
                  id: true,
                  fileName: true,
                  filePath: true,
                  isPrimary: true,
                  version: true,
                  fileSize: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map(serializeOrder);
}

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByUserId,
};