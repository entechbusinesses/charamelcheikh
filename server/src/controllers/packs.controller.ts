import { Request, Response } from "express";
import { prisma } from "../app";

interface PackBody {
  name: string;
  price: number;
  service_ids: number[];
  products: { product_id: number; quantity: number }[];
}

const packInclude = {
  services: {
    select: {
      service_id: true,
      service: {
        select: {
          id: true,
          name: true,
          price: true,
          frais: true,
          hidden: true,
          local_id: true,
          local: { select: { id: true, name: true, type: true } },
        },
      },
    },
  },
  products: {
    select: {
      product_id: true,
      quantity: true,
      product: { select: { id: true, name: true, price: true } },
    },
  },
};

/** Validates the body; returns an error message or the clean data */
/** All services of a pack must exist and belong to the same local */
const checkServices = async (service_ids: number[]) => {
  const services = await prisma.services.findMany({
    where: { id: { in: service_ids } },
    select: { local_id: true },
  });
  if (services.length !== service_ids.length) return "Service introuvable";
  if (new Set(services.map((s) => s.local_id)).size > 1)
    return "Les services d'un pack doivent être du même local";
  return null;
};

const parsePack = (body: any): string | PackBody => {
  const name = String(body?.name || "").trim();
  const price = Number(body?.price);
  const service_ids: number[] = [
    ...new Set<number>(
      (Array.isArray(body?.service_ids) ? body.service_ids : []).map(Number)
    ),
  ].filter(Boolean);
  const products = Array.isArray(body?.products) ? body.products : [];

  if (!name) return "Le nom du pack est obligatoire";
  if (!Number.isInteger(price) || price < 0) return "Prix invalide";
  if (service_ids.length === 0) return "Choisissez au moins un service";

  const clean = new Map<number, number>();
  for (const p of products) {
    const id = Number(p?.product_id);
    const quantity = Number(p?.quantity) || 1;
    if (!id || !Number.isInteger(quantity) || quantity < 1)
      return "Produit invalide";
    clean.set(id, (clean.get(id) || 0) + quantity);
  }

  return {
    name,
    price,
    service_ids,
    products: [...clean].map(([product_id, quantity]) => ({
      product_id,
      quantity,
    })),
  };
};

export const getPacks = async (req: Request, res: Response): Promise<void> => {
  const { local_id, hidden } = req.query;

  const where: any = {};
  // POS: packs of the local whose services are all visible
  if (local_id)
    where.services = {
      some: { service: { local_id: +local_id } },
      every: { service: { hidden: false } },
    };
  if (hidden !== "true") where.hidden = false;

  try {
    const data = await prisma.packs.findMany({
      where,
      include: packInclude,
      orderBy: { name: "asc" },
    });

    res.status(200).json({ message: "Packs fetched successfully", data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get packs", error });
  }
};

export const addPack = async (req: Request, res: Response): Promise<void> => {
  const pack = parsePack(req.body);
  if (typeof pack === "string") {
    res.status(400).json({ message: pack });
    return;
  }

  const invalid = await checkServices(pack.service_ids);
  if (invalid) {
    res.status(400).json({ message: invalid });
    return;
  }

  try {
    const data = await prisma.packs.create({
      data: {
        name: pack.name,
        price: pack.price,
        services: {
          create: pack.service_ids.map((service_id) => ({ service_id })),
        },
        products: { create: pack.products },
      },
      include: packInclude,
    });

    res.status(201).json({ message: "Pack registered successfully", data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to add pack", error });
  }
};

export const editPack = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const pack = parsePack(req.body);
  if (typeof pack === "string") {
    res.status(400).json({ message: pack });
    return;
  }

  const invalid = await checkServices(pack.service_ids);
  if (invalid) {
    res.status(400).json({ message: invalid });
    return;
  }

  try {
    const data = await prisma.packs.update({
      where: { id: +id },
      data: {
        name: pack.name,
        price: pack.price,
        services: {
          deleteMany: {},
          create: pack.service_ids.map((service_id) => ({ service_id })),
        },
        products: { deleteMany: {}, create: pack.products },
      },
      include: packInclude,
    });

    res.status(200).json({ message: "Pack edited successfully", data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to edit pack", error });
  }
};

export const toggleHidePack = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { hidden } = req.body;

  try {
    await prisma.packs.update({
      where: { id: +id },
      data: { hidden: !!hidden },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle pack", error });
  }
};

export const deletePack = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    // past sales keep the pack name on their lines
    await prisma.packs.delete({ where: { id: +id } });
    res.status(200).json({ message: "Pack deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete pack", error });
  }
};
