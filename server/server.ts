import "dotenv/config";
import { app, prisma } from "./src/app";

// Hostinger (and most hosts) assign the port through the PORT env variable
const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  try {
    await prisma.$connect();
    console.log("Connected to the database");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
  }
});
