import { Request, Response } from "express";
import { prisma } from "../app";
interface props {
  name: string;
  category_id: number;
  price: number;
}

import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/products/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
}).single("pic");

export const addProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    let pic = null;
    if (req.file) {
      pic = `/uploads/products/${req.file.filename}`;
    }

    const { name, price, category_id }: props = req.body;

    try {
      await prisma.products.create({
        data: {
          name,
          price: +price,
          category_id: +category_id,
          image_url: pic || null,
        },
      });

      res.status(201).json({ message: "Product registered successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to add Product", error });
    }
  });
};

export const getproducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { category_id, local_id } = req.query;

  let lang;
  let local;

  if (category_id) {
    lang = {
      where: {
        category_id: +category_id,
      },
    };
  }

  if (local_id) {
    local = {
      where: {
        local_id: +local_id,
      },
    };
  }

  try {
    const data = await prisma.products.findMany({
      ...lang,
      include: {
        category: true,
        stock: {
          ...local,
          select: {
            quantity: true,
          },
        },
      },
    });

    res.status(201).json({ message: "products fetched successfully", data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get products", error });
  }
};

export const editProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  upload(req, res, async (err) => {
    let pic = null;
    if (req.file) {
      pic = `/uploads/products/${req.file.filename}`;
    }
    const { name, price, category_id }: props = req.body;
    const { id } = req.params;

    try {
      const data = await prisma.products.update({
        data: {
          name,
          price: +price,
          image_url: pic || null,
          category_id: +category_id,
        },
        where: { id: +id },
      });

      res.status(201).json({ message: "Local edited successfully", data });
    } catch (error) {
      res.status(500).json({ message: "Failed to edit local", error });
    }
  });
};

export const TOTAL_ARTICLES = "TotalArticles";

/**
 * Open-price product sold by BELDI locals instead of the real products.
 * Created (with its own hidden category) the first time it is asked for.
 */
export const getTotalArticles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let data = await prisma.products.findFirst({
      where: { name: TOTAL_ARTICLES },
    });

    if (!data) {
      const category = await prisma.categories.upsert({
        where: { name: TOTAL_ARTICLES },
        update: {},
        create: { name: TOTAL_ARTICLES, hide: true },
      });

      data = await prisma.products.create({
        data: {
          name: TOTAL_ARTICLES,
          price: 0,
          hidden: true,
          category_id: category.id,
        },
      });
    }

    res.status(200).json({ message: "product fetched successfully", data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get TotalArticles", error });
  }
};

export const toggleHideProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { hidden } = req.body;

  try {
    await prisma.products.update({
      where: { id: +id },
      data: { hidden },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to see users" });
  }
};
