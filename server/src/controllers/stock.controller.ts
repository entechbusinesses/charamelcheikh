import { prisma } from "../app";
import { notifyLowStock } from "../services/notify";

interface ReqProps {
  products: {
    id: number;
    quantity: number;
  }[];

  local_id: number;
  user_id: number;
}

export const addOrReduceStock = async (
  prodId: number,
  quantity: number,
  local_id: number,
  upordown: "up" | "down"
) => {
  const local = await prisma.locals.findUnique({
    where: {
      id: +local_id,
    },
  });

  if (!local || local?.type === "BELDI") return;

  try {
    const stock = await prisma.stock.upsert({
      where: {
        product_id_local_id: {
          product_id: +prodId,
          local_id: +local_id,
        },
      },
      update: {
        quantity:
          upordown === "up" ? { increment: quantity } : { decrement: quantity },
      },
      create: {
        local_id: local_id,
        product_id: prodId,
        quantity: upordown === "up" ? quantity : -quantity,
      },
    });

    if (upordown === "down") {
      notifyLowStock(+prodId, +local_id, stock.quantity + quantity, stock.quantity);
    }
  } catch (error) {
    console.error("Error updating stock:", error);
    throw new Error("Failed to update stock");
  }
};
