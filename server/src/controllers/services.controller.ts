import { Request, Response } from "express";
import { prisma } from "../app";
import multer from "multer";
import path from "path";
interface props {
  name: string;
  locals_id: number[];
  price: number;
  frais: number;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/services/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
}).single("pic");

export const deleteservice = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    await prisma.services.delete({
      where: {
        id: +id,
      },
    });

    res.status(201).json({ message: "Service registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add service", error });
  }
};
export const addservice = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    const { name, locals_id, price, frais }: props = req.body;

    let pic = null;
    if (req.file) {
      pic = `/uploads/services/${req.file.filename}`;
    }

    if (typeof locals_id !== "object" || locals_id.length < 0) {
      res
        .status(500)
        .json({ message: "Failed to add service, Locals_id must be an array" });
      return;
    }

    try {
      locals_id.forEach(async (element) => {
        await prisma.services.createMany({
          data: {
            name,
            local_id: +element,
            price: +price,
            image_url: pic,
            frais: +frais,
          },
        });
      });

      res.status(201).json({ message: "Service registered successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to add service", error });
    }
  });
};

export const getservices = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { hidden, type, local, local_id } = req.query;
  let where = {};

  if (type) {
    where = { ...where, local: { type: type } };
  }
  if (local_id) {
    where = { ...where, local_id: Number(local_id) };
  }

  if (hidden !== "true") {
    where = { ...where, hidden: false };
  }

  try {
    const data = await prisma.services.findMany({
      where,
      include: {
        local: local === "true",
      },
    });

    res.status(201).json({ message: "Services fetched successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to get services", error });
  }
};

export const editservice = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    let pic = null;
    if (req.file) {
      pic = `/uploads/services/${req.file.filename}`;
    }
    const { name, price, frais }: props = req.body;
    const { id } = req.params;

    try {
      const data = await prisma.services.update({
        data: {
          name,
          frais: +frais,
          price: +price,
          image_url: pic,
        },
        where: { id: +id },
      });

      res.status(201).json({ message: "Local edited successfully", data });
    } catch (error) {
      res.status(500).json({ message: "Failed to edit local", error });
    }
  });
};

export const toggleHide = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { hidden } = req.body;

  try {
    await prisma.services.update({
      where: { id: +id },
      data: { hidden },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to see users" });
  }
};
