import { pgTable, serial, text, integer, timestamp, unique, index } from 'drizzle-orm/pg-core';

export const operators = pgTable('operators', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const rawRecords = pgTable('raw_records', {
  id: serial('id').primaryKey(),
  operatorName: text('operator_name').notNull(),
  dateStr: text('date_str').notNull(),
  timeStr: text('time_str').notNull(),
  product: text('product').notNull().default(''),
  volumes: integer('volumes').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('unique_record').on(table.operatorName, table.dateStr, table.timeStr, table.product),
  index('idx_records_operator').on(table.operatorName),
  index('idx_records_date').on(table.dateStr),
]);
