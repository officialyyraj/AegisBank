# backend/Dockerfile — AegisBank backend container (Doc 3 Part F).
#
# NOTE: In this sandbox the runnable demo is the Next.js app on port 3000.
# This Dockerfile targets the spec's original Express backend layout
# (backend/src → dist/server.js). It is provided as a deployment-ready
# reference artifact; the production CDK stack (infrastructure/cdk) builds
# and pushes this image to ECR. It is NOT executed in the sandbox.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
# Prisma needs the schema at runtime for the query engine + migrations
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
