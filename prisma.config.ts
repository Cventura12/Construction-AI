export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for CLI-level operations (migrations/introspection), fallback to pooled URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
};
