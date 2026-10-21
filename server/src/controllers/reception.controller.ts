import { Request, Response } from "express";
import { prisma } from "../app";
import { notifyReception } from "../services/notify";
import { addOrReduceStock } from "./stock.controller";

// export const  = async (req: Request, res: Response): Promise<void> => {
//   const {  } = req.body;

//   try {
//     const data = await prisma.

//     res.status(201).json({ message: "Stat registered successfully", data });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to add Stat", error });
//   }
// };

export const addReception = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    date,
    description,
    products,
    from_id,
    to_id,
    isBought,
    user_id,
    total,
  } = req.body;

  try {
    const data = await prisma.receptionList.create({
      data: {
        date: new Date(date),
        user_id: +user_id,
        description: description || null,
        from_id: +from_id || null,
        to_id: +to_id,
        isBough: isBought || false,
        total: total || 0,
      },
    });

    products.forEach(
      async (element: { id: number; quantity: number; price: number }) => {
        await prisma.receptionProducts.create({
          data: {
            product_id: element.id,
            quantity: element.quantity,
            price: element.price,
            reception_id: data.id,
          },
        });

        await addOrReduceStock(+element.id, +element.quantity, +to_id, "up");

        if (!isBought) {
          await addOrReduceStock(
            +element.id,
            +element.quantity,
            +from_id,
            "down"
          );
        }
      }
    );

    notifyReception(data.id, products.length);
    res.status(201).json({ message: "Stat registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
    console.log(error);
  }
};

export const getReceptions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { to_id, from_id, user_id, from, to } = req.query;

  let where: any = {};

  if (from_id && from_id !== "tous") {
    where.from_id = +from_id;
  }

  if (from && to) {
    const startDate = new Date(from as string);
    const endDate = new Date(to as string);

    const startTime = new Date(startDate);
    startTime.setHours(5, 0, 0, 0);

    const endTime = new Date(endDate);
    endTime.setHours(5, 0, 0, 0);

    where.date = {
      gte: startTime,
      lt: endTime,
    };
  }

  if (user_id && user_id !== "tous") {
    where.user_id = +user_id;
  }

  if (to_id && to_id !== "tous") {
    where.to_id = +to_id;
  }

  try {
    const data = await prisma.receptionList.findMany({
      where,
      orderBy: {
        date: "desc",
      },
      include: {
        from: {
          select: {
            name: true,
            type: true,
          },
        },
        to: {
          select: {
            name: true,
            type: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    res.status(201).json({ message: "Stat registered successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
  }
};

export const getReceptionsItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.query;

  try {
    const data = await prisma.receptionProducts.findMany({
      where: {
        reception_id: +(id as string),
      },
      select: {
        quantity: true,
        price: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({ message: "Stat registered successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
  }
};

export const deleteReception = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    const data = await prisma.receptionList.findUnique({
      where: { id: +id },
      include: {
        products: {
          include: { product: true },
        },
      },
    });

    if (!data) return;
    if (data.products.length === 0) return;

    data.products.forEach(async (element) => {
      await addOrReduceStock(
        +element.product_id,
        +element.quantity,
        data.to_id,
        "down"
      );

      if (!data.isBough) {
        await addOrReduceStock(
          +element.product_id,
          +element.quantity,
          data.from_id as number,
          "up"
        );
      }
    });

    await prisma.receptionList.delete({
      where: { id: +id },
    });

    res.status(201).json({ message: "Stat registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
    console.log(error);
  }
};
