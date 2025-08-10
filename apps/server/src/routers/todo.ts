import { eq } from "drizzle-orm";
import * as v from "valibot";
import { db } from "../db";
import { todo } from "../db/schema/todo";
import { publicProcedure } from "../lib/orpc";

export const todoRouter = {
  getAll: publicProcedure.handler(async () => {
    return await db.select().from(todo);
  }),

  create: publicProcedure
    .input(v.object({ text: v.pipe(v.string(), v.minLength(1)) }))
    .handler(async ({ input }) => {
      return await db
        .insert(todo)
        .values({
          text: input.text,
        });
    }),

  toggle: publicProcedure
    .input(v.object({ id: v.number(), completed: v.boolean() }))
    .handler(async ({ input }) => {
      return await db
        .update(todo)
        .set({ completed: input.completed })
        .where(eq(todo.id, input.id));
    }),

  delete: publicProcedure
    .input(v.object({ id: v.number() }))
    .handler(async ({ input }) => {
      return await db.delete(todo).where(eq(todo.id, input.id));
    }),
};

