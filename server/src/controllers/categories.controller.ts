import { Request, Response } from "express";
import { prisma } from "../app";
interface props {
  name: string;
  locals_id: number[];
  price: number;
}

import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/categories/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
}).single("pic");

export const addCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const { name }: props = req.body;
    let pic = null;
    if (req.file) {
      pic = `/uploads/categories/${req.file.filename}`;
    }
    try {
      await prisma.categories.create({
        data: {
          name,
          image_url: pic,
        },
      });

      res.status(201).json({ message: "Category registered successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to add Category", error });
    }
  });
};

export const getcategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id, products } = req.query;
  let lang;

  if (id) {
    lang = {
      where: {
        id: +id,
      },
    };
  }

  try {
    const data = await prisma.categories.findMany({
      ...lang,
      include: { products: products === "true" },
    });

    res.status(201).json({ message: "categories fetched successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to get categories", error });
  }
};

export const editCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    let pic = null;
    if (req.file) {
      pic = `/uploads/categories/${req.file.filename}`;
    }
    const { name }: props = req.body;
    const { id } = req.params;

    try {
      const data = await prisma.categories.update({
        data: {
          name,
          image_url: pic || null,
        },
        where: { id: +id },
      });

      res.status(201).json({ message: "Local edited successfully", data });
    } catch (error) {
      res.status(500).json({ message: "Failed to edit local", error });
    }
  });
};

export const toggleHideCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { hide } = req.body;

  try {
    await prisma.categories.update({
      where: { id: +id },
      data: { hide },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to see users" });
  }
};
