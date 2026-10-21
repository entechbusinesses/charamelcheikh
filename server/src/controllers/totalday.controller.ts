import { Request, Response } from "express";
import { prisma } from "../app";
import { notifyCloture } from "../services/notify";

export const getTotalDay = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { local_id } = req.query;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  try {
    const data = await prisma.totalDay.findMany({
      where: {
        local_id: +(local_id as string),
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    res
      .status(201)
      .json({ message: "Stat registered successfully", data: data[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
    console.log(error);
  }
};

export const addTotalDay = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { day, local_id, total_services, total_products, total, user_id } =
    req.body;

  try {
    const data = await prisma.totalDay.create({
      data: {
        date: new Date(day),
        local_id,
        total_products,
        total_services,
        total,
        user_id,
      },
    });

    notifyCloture(data.id);
    res.status(201).json({ message: "Total Day added successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Total Day", error });
  }
};

export const getAllTotalDays = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { day, user_id, local_id } = req.query;

  let where: any = {};

  const startOfDay = new Date(day as string);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  if (local_id && local_id !== "tous") {
    where.local_id = +local_id;
  }

  if (user_id && user_id !== "tous") {
    where.user_id = +user_id;
  }

  try {
    const data = await prisma.totalDay.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
        ...where,
      },
      include: {
        local: true,
        user: true,
      },
    });

    res.status(200).json({ message: "Total Days fetched successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch Total Days", error });
    console.log(error);
  }
};

export const editTotalDay = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id, total_services, total_products, total } = req.body;

  try {
    const previous = await prisma.totalDay.findUnique({
      where: { id: +id },
      select: { total: true },
    });
    const data = await prisma.totalDay.update({
      where: { id: +id },
      data: {
        total_services,
        total_products,
        total,
      },
    });

    notifyCloture(data.id, previous?.total);
    res.status(200).json({ message: "Total Day updated successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to update Total Day", error });
  }
};
