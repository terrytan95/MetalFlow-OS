import { Worker } from "bullmq";
import { db } from "../../../packages/database/index.js";
import { executeAIJob } from "./job.js";
const worker = new Worker("metalflow-ai", (job) => executeAIJob(job.data.id), {
  connection: { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" },
  concurrency: 2,
});
worker.on("error", () => console.error("Worker connection error"));
process.on("SIGTERM", async () => {
  await worker.close();
  await db.$disconnect();
  process.exit(0);
});
console.log("MetalFlow worker ready");
