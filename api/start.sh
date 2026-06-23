#!/bin/bash

# Extract host and port from the DATABASE_URL
host=$(echo $DATABASE_URL | sed -E 's|.*@([^:/]+):([0-9]+).*|\1|')
port=$(echo $DATABASE_URL | sed -E 's|.*@([^:/]+):([0-9]+).*|\2|')

echo "Waiting for PostgreSQL at $host:$port..."

# Wait for the DB to be ready
until nc -z -v -w30 "$host" "$port"
do
  echo "Still waiting for PostgreSQL at $host:$port..."
  sleep 3
done

echo "Database is up. Running Prisma migrations..."
npx prisma db push --accept-data-loss

echo "Starting Node app..."
pnpm start
